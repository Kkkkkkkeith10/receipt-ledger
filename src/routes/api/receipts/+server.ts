import type { RequestHandler } from '@sveltejs/kit';
import { receipts } from '$lib/server/db';
import { desc, eq, and, gte, lte, like, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getFiscalYear } from '$lib/utils/fiscal';
import { calculateGSTFromInclusive } from '$lib/utils/gst';
import { getCategoryName } from '$lib/categories';
import { normalizePaymentMethod } from '$lib/utils/paymentMethod';
import { requireAuth } from '$lib/server/auth/helpers';

const createReceiptSchema = z.object({
  id: z.string().optional(),
  vendor: z.string().min(1, 'Vendor is required'),
  amount: z.number().positive('Amount must be positive'),
  gstFree: z.boolean().optional().default(false),
  date: z.string(),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  status: z.enum(['draft', 'pending', 'approved', 'rejected']).default('approved'),
  taxDeductible: z.boolean().optional().default(true),
  paymentMethod: z.preprocess(
    (v) => normalizePaymentMethod(v),
    z.enum(['cash', 'card', 'bank_transfer', 'other']).optional()
  ),
  receiptImageUrl: z.string().nullable().optional(),
  receiptImageKey: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  auditInfo: z
    .object({
      businessPurpose: z.string().optional(),
      projectCode: z.string().optional(),
      location: z.string().optional(),
      attendees: z.string().optional(),
      businessMeal: z.boolean().optional(),
      travelRelated: z.boolean().optional()
    })
    .optional()
});

export const GET: RequestHandler = async (event) => {
  await requireAuth(event);
  const { locals, url } = event;
  const DB = locals.DB;
  if (!DB)
    return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });

  try {
    // Parse query params for filtering
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const fiscalYear = url.searchParams.get('fiscalYear');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const query = url.searchParams.get('query');
    const limit = parseInt(url.searchParams.get('limit') ?? '100');

    // Build conditions - always exclude archived receipts unless explicitly requested
    const conditions = [];
    const includeArchived = url.searchParams.get('includeArchived') === 'true';

    if (!includeArchived) {
      // Filter out archived receipts (archived is false or null)
      conditions.push(sql`COALESCE(json_extract(receipt_data, '$.archived'), 0) = 0`);
    }

    if (category) {
      conditions.push(eq(receipts.category, category));
    }
    if (status) {
      conditions.push(eq(receipts.status, status));
    }
    if (fiscalYear) {
      conditions.push(eq(receipts.fiscalYear, parseInt(fiscalYear)));
    }
    if (dateFrom) {
      conditions.push(gte(receipts.date, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(receipts.date, dateTo));
    }
    if (query) {
      conditions.push(like(receipts.vendor, `%${query}%`));
    }

    const data =
      conditions.length > 0
        ? await DB.select()
          .from(receipts)
          .where(and(...conditions))
          .orderBy(desc(receipts.date))
          .limit(limit)
        : await DB.select().from(receipts).orderBy(desc(receipts.date)).limit(limit);

    const list = data.map((row) => {
      const rd = row.receiptData as any;
      const amount = Number(row.amount ?? rd.amount ?? 0);
      const gstBreakdown = rd.gstFree ? { gst: 0, net: amount } : calculateGSTFromInclusive(amount);

      return {
        id: row.id,
        vendor: row.vendor ?? rd.vendor,
        amount,
        currency: rd.currency ?? 'HKD',
        gstAmount: rd.gstAmount ?? gstBreakdown.gst,
        netAmount: rd.netAmount ?? gstBreakdown.net,
        gstFree: rd.gstFree ?? false,
        date: row.date ?? rd.date,
        fiscalYear: row.fiscalYear ?? rd.fiscalYear,
        category: row.category ?? rd.category,
        subcategory: rd.subcategory,
        categoryName: rd.categoryName ?? getCategoryName(row.category ?? rd.category ?? ''),
        status: row.status ?? rd.status ?? 'approved',
        taxDeductible: Boolean(row.taxDeductible ?? rd.taxDeductible ?? true),
        paymentMethod: rd.paymentMethod,
        receiptImageUrl: rd.receiptImageUrl ?? null,
        receiptImageKey: rd.receiptImageKey,
        notes: rd.notes,
        tags: rd.tags ?? [],
        auditInfo: rd.auditInfo ?? {},
        createdAt: row.createdAt ?? rd.createdAt,
        updatedAt: row.updatedAt ?? rd.updatedAt
      };
    });

    return new Response(JSON.stringify(list), { headers: { 'content-type': 'application/json' } });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch receipts', details: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
};

export const POST: RequestHandler = async (event) => {
  await requireAuth(event);
  const { request, locals } = event;
  const DB = locals.DB;
  if (!DB) return new Response('Database not available', { status: 500 });

  const body = await request.json().catch(() => null);
  const parsed = createReceiptSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const payload = parsed.data;
  const id = payload.id ?? `RCP-${Date.now()}`;
  const receiptDate = new Date(payload.date);
  const fiscalYear = getFiscalYear(receiptDate);

  // Calculate GST
  const gstBreakdown = payload.gstFree
    ? { gst: 0, net: payload.amount, total: payload.amount }
    : calculateGSTFromInclusive(payload.amount);

  const now = new Date().toISOString();
  const receiptData = {
    id,
    vendor: payload.vendor,
    amount: payload.amount,
    gstAmount: gstBreakdown.gst,
    netAmount: gstBreakdown.net,
    gstFree: payload.gstFree ?? false,
    date: payload.date,
    fiscalYear,
    category: payload.category,
    subcategory: payload.subcategory,
    categoryName: getCategoryName(payload.category),
    status: payload.status,
    taxDeductible: payload.taxDeductible ?? true,
    paymentMethod: payload.paymentMethod,
    receiptImageUrl: payload.receiptImageUrl ?? null,
    receiptImageKey: payload.receiptImageKey,
    notes: payload.notes,
    tags: payload.tags ?? [],
    auditInfo: payload.auditInfo ?? {},
    createdAt: now,
    updatedAt: now
  };

  await DB.insert(receipts).values({ id, receiptData });

  return new Response(JSON.stringify({ id, ...receiptData }), {
    status: 201,
    headers: { 'content-type': 'application/json' }
  });
};