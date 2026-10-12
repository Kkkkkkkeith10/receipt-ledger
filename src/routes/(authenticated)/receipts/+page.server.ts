import type { Actions, PageServerLoad } from './$types';
import { receipts } from '$lib/server/db';
import { desc, sql } from 'drizzle-orm';
import { z } from 'zod';

// Minimal server-side schema for creating a receipt
const createReceiptSchema = z.object({
  id: z.string().optional(),
  vendor: z.string().min(1),
  amount: z.coerce.number().positive(),
  date: z.string(),
  category: z.string().min(1),
  categoryName: z.string().optional(),
  status: z.enum(['draft', 'pending', 'approved', 'rejected']).default('approved'),
  taxDeductible: z.coerce.boolean().optional(),
  receiptImageUrl: z.string().nullable().optional(),
  auditInfo: z.object({
    businessPurpose: z.string().min(10),
    projectCode: z.string().optional(),
    location: z.string().optional(),
    attendees: z.string().optional(),
    businessMeal: z.boolean().optional(),
    travelRelated: z.boolean().optional()
  })
});

export const load: PageServerLoad = async ({ locals }) => {
  const DB = locals.DB;
  if (!DB) {
    return { receipts: [] };
  }

  // Filter out archived receipts
  const data = await DB.select()
    .from(receipts)
    .where(sql`COALESCE(json_extract(${receipts.receiptData}, '$.archived'), 0) = 0`)
    .orderBy(desc(receipts.createdAt));

  // Map DB shape (receiptData + generated cols) into UI Receipt type
  const uiReceipts = data.map((row) => {
    const rd = row.receiptData as any;
    return {
      id: row.id,
      vendor: row.vendor ?? rd.vendor,
      amount: Number(row.amount ?? rd.amount ?? 0),
      currency: rd.currency ?? 'HKD',
      date: row.date ?? rd.date,
      category: row.category ?? rd.category,
      categoryName: rd.categoryName ?? rd.category,
      status: (rd.status ?? 'approved') as 'draft' | 'pending' | 'approved' | 'rejected',
      taxDeductible: Boolean(row.taxDeductible ?? rd.taxDeductible ?? false),
      receiptImageUrl: rd.receiptImageUrl ?? null,
      auditInfo: rd.auditInfo ?? { businessPurpose: '' },
      createdAt: row.createdAt ?? rd.createdAt,
      updatedAt: row.updatedAt ?? rd.updatedAt
    };
  });

  return { receipts: uiReceipts };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const DB = locals.DB;
    if (!DB) {
      return new Response('Database not available', { status: 500 });
    }

    const form = await request.formData();
    const raw = Object.fromEntries(form.entries());

    // Parse JSON strings for nested objects when posted from client
    if (typeof raw.auditInfo === 'string') {
      try { raw.auditInfo = JSON.parse(raw.auditInfo as string); } catch { }
    }

    const parsed = createReceiptSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const payload = parsed.data;
    const id = payload.id ?? `RCP-${Date.now()}`;

    // Compose receipt record stored as JSON, leverage generated columns
    const receiptData = {
      id,
      vendor: payload.vendor,
      amount: payload.amount,
      date: payload.date,
      category: payload.category,
      categoryName: payload.categoryName,
      status: payload.status,
      taxDeductible: payload.taxDeductible ?? false,
      receiptImageUrl: payload.receiptImageUrl ?? null,
      auditInfo: payload.auditInfo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await DB.insert(receipts).values({
      id,
      receiptData
    });

    return new Response(JSON.stringify({ id }), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });
  }
};
