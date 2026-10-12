/**
 * Single Receipt API - GET, PUT, DELETE
 */

import type { RequestHandler } from '@sveltejs/kit';
import { receipts } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getFiscalYear } from '$lib/utils/fiscal';
import { calculateGSTFromInclusive } from '$lib/utils/gst';
import { getCategoryName } from '$lib/categories';
import { normalizePaymentMethod } from '$lib/utils/paymentMethod';
import { requireAuth } from '$lib/server/auth/helpers';

const updateReceiptSchema = z.object({
    vendor: z.string().min(1, 'Vendor is required'),
    amount: z.number().positive('Amount must be positive'),
    currency: z.enum(['HKD', 'JPY', 'TWD', 'USD', 'CNY', 'EUR', 'GBP']).optional().default('HKD'),
    gstFree: z.boolean().optional().default(false),
    date: z.string(),
    category: z.string().min(1, 'Category is required'),
    subcategory: z.string().optional(),
    status: z.enum(['draft', 'pending', 'approved', 'rejected']).optional(),
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
    const { params, locals } = event;
    const DB = locals.DB;
    if (!DB) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
            status: 503,
            headers: { 'content-type': 'application/json' }
        });
    }

    const id = params.id;
    if (!id) {
        return new Response(JSON.stringify({ error: 'Receipt ID required' }), {
            status: 400,
            headers: { 'content-type': 'application/json' }
        });
    }

    const row = await DB.select().from(receipts).where(eq(receipts.id, id)).get();

    if (!row) {
        return new Response(JSON.stringify({ error: 'Receipt not found' }), {
            status: 404,
            headers: { 'content-type': 'application/json' }
        });
    }

    const rd = row.receiptData as any;
    const amount = Number(row.amount ?? rd.amount ?? 0);
    const gstBreakdown = rd.gstFree
        ? { gst: 0, net: amount }
        : calculateGSTFromInclusive(amount);

    const receipt = {
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
        originalImageKey: rd.originalImageKey,
        notes: rd.notes,
        tags: rd.tags ?? [],
        auditInfo: rd.auditInfo ?? {},
        ocrData: rd.ocrData,
        createdAt: row.createdAt ?? rd.createdAt,
        updatedAt: row.updatedAt ?? rd.updatedAt
    };

    return new Response(JSON.stringify(receipt), {
        headers: { 'content-type': 'application/json' }
    });
};

export const PUT: RequestHandler = async (event) => {
    await requireAuth(event);
    const { params, request, locals } = event;
    const DB = locals.DB;
    if (!DB) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
            status: 503,
            headers: { 'content-type': 'application/json' }
        });
    }

    const id = params.id;
    if (!id) {
        return new Response(JSON.stringify({ error: 'Receipt ID required' }), {
            status: 400,
            headers: { 'content-type': 'application/json' }
        });
    }

    // Get existing receipt
    const existing = await DB.select().from(receipts).where(eq(receipts.id, id)).get();

    if (!existing) {
        return new Response(JSON.stringify({ error: 'Receipt not found' }), {
            status: 404,
            headers: { 'content-type': 'application/json' }
        });
    }

    const body = await request.json().catch(() => null);
    const parsed = updateReceiptSchema.safeParse(body);

    if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
            status: 400,
            headers: { 'content-type': 'application/json' }
        });
    }

    const payload = parsed.data;
    const existingData = existing.receiptData as any;

    const receiptDate = new Date(payload.date);
    const fiscalYear = getFiscalYear(receiptDate);

    // Calculate GST
    const gstBreakdown = payload.gstFree
        ? { gst: 0, net: payload.amount, total: payload.amount }
        : calculateGSTFromInclusive(payload.amount);

    const now = new Date().toISOString();
    const updatedData = {
        ...existingData,
        vendor: payload.vendor,
        amount: payload.amount,
        currency: payload.currency ?? existingData.currency ?? 'HKD',
        gstAmount: gstBreakdown.gst,
        netAmount: gstBreakdown.net,
        gstFree: payload.gstFree ?? false,
        date: payload.date,
        fiscalYear,
        category: payload.category,
        subcategory: payload.subcategory,
        categoryName: getCategoryName(payload.category),
        status: payload.status ?? existingData.status ?? 'approved',
        taxDeductible: payload.taxDeductible ?? true,
        paymentMethod: payload.paymentMethod ?? existingData.paymentMethod,
        receiptImageUrl: payload.receiptImageUrl ?? existingData.receiptImageUrl,
        receiptImageKey: payload.receiptImageKey ?? existingData.receiptImageKey,
        notes: payload.notes ?? existingData.notes,
        tags: payload.tags ?? existingData.tags ?? [],
        auditInfo: {
            ...(existingData.auditInfo ?? {}),
            ...(payload.auditInfo ?? {})
        },
        updatedAt: now
    };

    await DB.update(receipts)
        .set({ receiptData: updatedData })
        .where(eq(receipts.id, id));

    return new Response(JSON.stringify({ id, ...updatedData }), {
        headers: { 'content-type': 'application/json' }
    });
};

export const DELETE: RequestHandler = async (event) => {
    await requireAuth(event);
    const { params, locals } = event;
    const DB = locals.DB;

    if (!DB) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
            status: 503,
            headers: { 'content-type': 'application/json' }
        });
    }

    const id = params.id;
    if (!id) {
        return new Response(JSON.stringify({ error: 'Receipt ID required' }), {
            status: 400,
            headers: { 'content-type': 'application/json' }
        });
    }

    // Get existing receipt
    const existing = await DB.select().from(receipts).where(eq(receipts.id, id)).get();

    if (!existing) {
        return new Response(JSON.stringify({ error: 'Receipt not found' }), {
            status: 404,
            headers: { 'content-type': 'application/json' }
        });
    }

    // Archive instead of delete - set archived flag to true
    const existingData = existing.receiptData as any;
    const now = new Date().toISOString();
    const archivedData = {
        ...existingData,
        archived: true,
        archivedAt: now,
        updatedAt: now
    };

    await DB.update(receipts)
        .set({ receiptData: archivedData })
        .where(eq(receipts.id, id));

    // Note: Files are kept in R2 for potential recovery
    return new Response(JSON.stringify({ success: true, id, archived: true }), {
        headers: { 'content-type': 'application/json' }
    });
};
