/**
 * Unified Receipt Upload API
 * 
 * Handles the complete receipt upload flow:
 * 1. Accept image or PDF
 * 2. Convert image to PDF if needed
 * 3. Run AI recognition
 * 4. Generate receipt number
 * 5. Save to R2 (storage) + D1 (database)
 * 6. Return complete receipt data
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { R2Bucket } from '@cloudflare/workers-types';
import { recognizeReceipt, type AIConfig } from '$lib/server/ai-workers';
import { getFiscalYear } from '$lib/utils/fiscal';
import { calculateGSTFromInclusive } from '$lib/utils/gst';
import { getCategoryName, getCategoryByAIName } from '$lib/categories';
import { formatReceiptNumber, getFiscalYearKey } from '$lib/utils/receiptNumber';
import { imageToPdf, isPdf, detectMimeType, uint8ArrayToBase64 } from '$lib/utils/pdf';
import { receipts, appSettings } from '$lib/server/db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { requireAuth } from '$lib/server/auth/helpers';
import type { Currency } from '$lib/types';

// Supported currencies
const VALID_CURRENCIES: Currency[] = ['HKD', 'JPY', 'TWD', 'USD', 'CNY', 'EUR', 'GBP'];

/**
 * Normalize currency code from AI response
 * Maps various currency representations to standard codes
 */
function normalizeCurrency(currencyInput: string | null | undefined): Currency {
    if (!currencyInput) return 'HKD';

    const currency = currencyInput.toUpperCase().trim();

    // Direct match
    if (VALID_CURRENCIES.includes(currency as Currency)) {
        return currency as Currency;
    }

    // Common aliases
    const aliases: Record<string, Currency> = {
        'NT$': 'TWD',
        'NTD': 'TWD',
        'NT': 'TWD',
        '新台幣': 'TWD',
        '台幣': 'TWD',
        'HK$': 'HKD',
        '港幣': 'HKD',
        '港元': 'HKD',
        '¥': 'JPY', // Default ¥ to JPY, CNY context handled by AI
        '円': 'JPY',
        '日元': 'JPY',
        '日圓': 'JPY',
        'YEN': 'JPY',
        'RMB': 'CNY',
        '人民币': 'CNY',
        '人民幣': 'CNY',
        '元': 'CNY', // Default 元 to CNY
        'US$': 'USD',
        '美元': 'USD',
        '€': 'EUR',
        '歐元': 'EUR',
        '£': 'GBP',
        '英鎊': 'GBP',
    };

    return aliases[currency] ?? 'HKD';
}

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed input types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight
export const OPTIONS: RequestHandler = async () => {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
    });
};

export const POST: RequestHandler = async (event) => {
    try {
        await requireAuth(event);
        const { request, platform, locals } = event;
        console.log('=== UPLOAD POST REQUEST START ===');
        console.log('Content-Type:', request.headers.get('content-type'));
        console.log('Method:', request.method);
        console.log('Platform:', !!platform);
        console.log('Locals:', Object.keys(locals || {}));

        const DB = locals.DB;
        const R2 = platform?.env?.RECEIPTS as R2Bucket | undefined;

        console.log('DB available:', !!DB);
        console.log('R2 available:', !!R2);

        if (!DB) {
            console.error('[ERROR] Database not available');
            return json({ error: 'Database not available' }, { status: 503, headers: CORS_HEADERS });
        }

        if (!R2) {
            return json({ error: 'Storage not available' }, { status: 503, headers: CORS_HEADERS });
        }

        // Get AI config from environment
        const env = platform?.env as {
            AZURE_OPENAI_ENDPOINT?: string;
            AZURE_OPENAI_KEY?: string;
            AZURE_OPENAI_DEPLOYMENT?: string;
            AZURE_FOUNDRY_ENDPOINT?: string;
            AZURE_FOUNDRY_KEY?: string;
        };

        const aiConfig: AIConfig | null =
            env?.AZURE_OPENAI_ENDPOINT && env?.AZURE_OPENAI_KEY
                ? {
                    endpoint: env.AZURE_OPENAI_ENDPOINT,
                    key: env.AZURE_OPENAI_KEY,
                    deployment: env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4-vision-preview'
                }
                : env?.AZURE_FOUNDRY_ENDPOINT && env?.AZURE_FOUNDRY_KEY
                    ? {
                        endpoint: env.AZURE_FOUNDRY_ENDPOINT,
                        key: env.AZURE_FOUNDRY_KEY,
                        deployment: env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-mini'
                    }
                    : null;

        try {
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            const aiImageFiles = formData
                .getAll('aiImage')
                .filter((value): value is File => value instanceof File);
            const aiText = formData.get('aiText');
            const skipAI = formData.get('skipAI') === 'true';

            if (!file) {
                return json({ error: 'No file provided' }, { status: 400, headers: CORS_HEADERS });
            }

            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
                return json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400, headers: CORS_HEADERS });
            }

            // Get file data
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const pdfUpload = isPdf(uint8Array);

            const renderedAiImages: Array<{ imageBase64: string; mimeType: string }> = [];
            const supplementalAiText = typeof aiText === 'string' && aiText.trim().length > 0
                ? aiText.trim().slice(0, 12000)
                : null;

            for (const aiImageFile of aiImageFiles) {
                const aiArrayBuffer = await aiImageFile.arrayBuffer();
                const aiBytes = new Uint8Array(aiArrayBuffer);
                const detectedAiType = detectMimeType(aiBytes) || aiImageFile.type;

                if (!['image/jpeg', 'image/png', 'image/webp'].includes(detectedAiType)) {
                    return json(
                        { error: `Invalid AI image type: ${detectedAiType}. Allowed: JPEG, PNG, WebP.` },
                        { status: 400, headers: CORS_HEADERS }
                    );
                }

                renderedAiImages.push({
                    imageBase64: uint8ArrayToBase64(aiBytes),
                    mimeType: detectedAiType
                });
            }

            // Detect actual MIME type from magic bytes
            const detectedType = detectMimeType(uint8Array);
            const mimeType = detectedType || file.type;

            if (!ALLOWED_TYPES.includes(mimeType)) {
                return json(
                    { error: `Invalid file type: ${mimeType}. Allowed: JPEG, PNG, WebP, PDF.` },
                    { status: 400, headers: CORS_HEADERS }
                );
            }

            // Get receipt date (for fiscal year calculation)
            const receiptDateParam = formData.get('date') as string | null;
            const receiptDate = receiptDateParam ? new Date(receiptDateParam) : new Date();
            const fiscalYear = getFiscalYear(receiptDate);

            // Generate receipt number
            const receiptNumber = await generateReceiptNumber(DB, fiscalYear);

            // Convert image to PDF if needed
            let pdfData: Uint8Array;
            let originalImageBase64: string | null = null;

            if (pdfUpload) {
                pdfData = uint8Array;
            } else {
                // Store original image for AI recognition
                originalImageBase64 = uint8ArrayToBase64(uint8Array);

                // Convert to PDF
                pdfData = await imageToPdf(uint8Array, mimeType, {
                    receiptNumber,
                    creationDate: receiptDate,
                    title: `Receipt ${receiptNumber}`
                });
            }

            // Save PDF to R2 storage
            const pdfKey = `receipts/${fiscalYear}/${receiptNumber}.pdf`;
            await R2.put(pdfKey, pdfData, {
                httpMetadata: {
                    contentType: 'application/pdf'
                },
                customMetadata: {
                    receiptNumber,
                    fiscalYear: String(fiscalYear),
                    originalType: mimeType,
                    uploadedAt: new Date().toISOString()
                }
            });

            // Also save original image if it was converted
            let originalImageKey: string | null = null;
            if (originalImageBase64) {
                const ext = mimeType.split('/')[1] || 'jpg';
                originalImageKey = `receipts/${fiscalYear}/${receiptNumber}-original.${ext}`;
                await R2.put(originalImageKey, uint8Array, {
                    httpMetadata: {
                        contentType: mimeType
                    }
                });
            }

            // Run AI recognition if config available and not skipped
            let aiResult: any = null;
            if (aiConfig && !skipAI) {
                try {
                    console.log('[INFO] Starting AI recognition...');
                    const aiInputs = originalImageBase64
                        ? [{ imageBase64: originalImageBase64, mimeType }]
                        : renderedAiImages;

                    if (aiInputs.length === 0) {
                        console.log('[INFO] Skipping AI recognition for PDF without rendered preview image');
                    } else {
                        const result = await recognizeReceipt(aiInputs, aiConfig, supplementalAiText);

                        console.log('[AI] Raw result:', JSON.stringify(result, null, 2));

                        if (!('error' in result)) {
                            aiResult = result;
                            console.log('[INFO] AI recognition successful');
                            console.log('[AI] Extracted data:', {
                                vendor: aiResult.vendor,
                                amount: aiResult.amount,
                                date: aiResult.date,
                                category: aiResult.category,
                                description: aiResult.description
                            });
                        } else {
                            console.warn('[WARN] AI recognition failed:', result.error);
                        }
                    }
                } catch (err) {
                    console.error('[ERROR] AI recognition error:', err);
                }
            } else {
                console.log('[INFO] AI recognition skipped - config:', !!aiConfig, 'skipAI:', skipAI);
            }

            // Build receipt data
            const now = new Date().toISOString();
            const dateString = receiptDateParam || now.split('T')[0];

            // Map AI category to our category code
            let categoryCode = 'other';
            if (aiResult?.category) {
                const mappedCategory = getCategoryByAIName(aiResult.category);
                if (mappedCategory) {
                    categoryCode = mappedCategory.id;
                }
            }

            // Normalize currency code from AI result
            const detectedCurrency = normalizeCurrency(aiResult?.currency);

            // Calculate GST (only for currencies with GST/VAT)
            const amount = aiResult?.amount || 0;
            const gstBreakdown = aiResult?.gstAmount
                ? { gst: aiResult.gstAmount, net: amount - aiResult.gstAmount }
                : calculateGSTFromInclusive(amount);

            // ---- Duplicate detection -------------------------------------------------
            // Flag receipts with same currency, amount within ±1%, and date within ±3 days.
            // Vendor similarity (Jaro-like normalized substring match) ranks the matches.
            const aiVendor = (aiResult?.vendor || '').trim();
            const aiDate = aiResult?.date || dateString;
            const possibleDuplicates = await findPossibleDuplicates(DB, {
                vendor: aiVendor,
                amount,
                currency: detectedCurrency,
                date: aiDate
            });
            // -------------------------------------------------------------------------

            const receiptData = {
                id: receiptNumber,
                vendor: aiResult?.vendor || '',
                amount: amount,
                currency: detectedCurrency,
                gstAmount: gstBreakdown.gst,
                netAmount: gstBreakdown.net,
                gstFree: false,
                date: aiResult?.date || dateString,
                fiscalYear,
                category: categoryCode,
                categoryName: getCategoryName(categoryCode),
                status: 'pending' as const,
                taxDeductible: true,
                paymentMethod: aiResult?.paymentMethod || undefined,
                receiptImageUrl: `/api/upload/${pdfKey}`,
                receiptImageKey: pdfKey,
                originalImageKey: originalImageKey || undefined,
                notes: '',
                tags: [],
                auditInfo: {
                    businessPurpose: aiResult?.description || ''
                },
                ocrData: aiResult
                    ? {
                        extractedAt: now,
                        confidence: aiResult.confidence,
                        vendor: aiResult.vendor,
                        amount: aiResult.amount,
                        date: aiResult.date,
                        gstAmount: aiResult.gstAmount,
                        brNumber: aiResult.brNumber,
                        currency: detectedCurrency,
                        category: aiResult.category
                    }
                    : undefined,
                possibleDuplicates: possibleDuplicates.length > 0 ? possibleDuplicates : undefined,
                createdAt: now,
                updatedAt: now
            };

            // Save to database
            await DB.insert(receipts).values({
                id: receiptNumber,
                receiptData: receiptData as any
            });

            return json({
                success: true,
                receiptNumber,
                receipt: receiptData,
                aiRecognized: !!aiResult,
                possibleDuplicates,
                pdfUrl: `/api/upload/${pdfKey}`
            }, { headers: CORS_HEADERS });
        } catch (error) {
            console.error('[ERROR] Upload error:', error);
            if (error instanceof Error) {
                console.error('[ERROR] Stack:', error.stack);
            }
            return json(
                { error: error instanceof Error ? error.message : 'Upload failed' },
                { status: 500, headers: CORS_HEADERS }
            );
        }
    } catch (outerError) {
        console.error('[FATAL] Outer catch - request never processed:', outerError);
        if (outerError instanceof Error) {
            console.error('[FATAL] Stack:', outerError.stack);
        }
        return json(
            { error: 'Internal server error', details: outerError instanceof Error ? outerError.message : 'Unknown' },
            { status: 500, headers: CORS_HEADERS }
        );
    }
};

/**
 * Generate next receipt number for the fiscal year
 */
async function generateReceiptNumber(DB: any, fiscalYear: number): Promise<string> {
    const fyKey = getFiscalYearKey(fiscalYear);

    // Get current counters
    const setting = await DB.select()
        .from(appSettings)
        .where(eq(appSettings.key, 'receiptCounters'))
        .get();

    const counters = (setting?.value as Record<string, number>) || {};
    const currentCount = counters[fyKey] || 0;
    const nextCount = currentCount + 1;

    // Update counters
    counters[fyKey] = nextCount;

    if (setting) {
        await DB.update(appSettings)
            .set({ value: counters, updatedAt: new Date().toISOString() })
            .where(eq(appSettings.key, 'receiptCounters'));
    } else {
        await DB.insert(appSettings).values({
            key: 'receiptCounters',
            value: counters
        });
    }

    return formatReceiptNumber(fiscalYear, nextCount);
}

// ============================================================================
// Duplicate detection (DB query; ranking via $lib/utils/duplicates)
// ============================================================================

import {
    rankDuplicates,
    buildSearchWindow,
    type DuplicateCandidate,
    type DuplicateInput,
    type ExistingReceipt,
} from '$lib/utils/duplicates';

/**
 * Find existing receipts that are likely duplicates of an incoming receipt.
 * The ranking heuristic lives in $lib/utils/duplicates so it can be unit-tested
 * without a DB.
 */
async function findPossibleDuplicates(
    DB: any,
    input: DuplicateInput
): Promise<DuplicateCandidate[]> {
    const win = buildSearchWindow(input);
    if (!win) return [];

    let rows: any[] = [];
    try {
        rows = await DB.select({
            id: receipts.id,
            receiptData: receipts.receiptData,
            vendor: receipts.vendor,
            amount: receipts.amount,
            date: receipts.date
        })
            .from(receipts)
            .where(
                and(
                    gte(receipts.amount, win.minAmount),
                    lte(receipts.amount, win.maxAmount),
                    gte(receipts.date, win.fromDate),
                    lte(receipts.date, win.toDate),
                    eq(receipts.archived, false)
                )
            )
            .limit(20);
    } catch (err) {
        console.warn('[duplicate-check] query failed', err);
        return [];
    }

    const candidates: ExistingReceipt[] = rows.map((row) => {
        const data = (row.receiptData ?? {}) as any;
        return {
            id: row.id,
            vendor: row.vendor ?? data.vendor ?? null,
            amount: row.amount ?? null,
            currency: data.currency ?? null,
            date: row.date ?? null,
            archived: false
        };
    });

    return rankDuplicates(input, candidates);
}
