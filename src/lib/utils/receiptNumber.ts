/**
 * Receipt Numbering System
 * 
 * Generates sequential receipt numbers in format: RCP-{FY}-{NNNN}-{UUID6}
 * e.g., RCP-2025-0001-a1b2c3, RCP-2025-0002-d4e5f6, etc.
 * The UUID suffix adds security by preventing ID enumeration attacks.
 */

import { getFiscalYear } from './fiscal';

export interface ReceiptCounters {
    [fiscalYearKey: string]: number;
}

/**
 * Generate a 6-character UUID prefix for security
 */
export function generateUuidSuffix(): string {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 6);
}

/**
 * Generate the next receipt number for a given fiscal year
 * This should be called from the server-side with DB access
 */
export function formatReceiptNumber(fiscalYear: number, sequenceNumber: number, uuidSuffix?: string): string {
    const suffix = uuidSuffix || generateUuidSuffix();
    return `RCP-${fiscalYear}-${String(sequenceNumber).padStart(4, '0')}-${suffix}`;
}

/**
 * Parse a receipt number into its components
 */
export function parseReceiptNumber(receiptNumber: string): {
    prefix: string;
    fiscalYear: number;
    sequence: number;
    uuidSuffix?: string;
} | null {
    // Support both old format (RCP-2025-0001) and new format (RCP-2025-0001-a1b2c3)
    const matchNew = receiptNumber.match(/^RCP-(\d{4})-(\d{4})-([a-f0-9]{6})$/);
    if (matchNew) {
        return {
            prefix: 'RCP',
            fiscalYear: parseInt(matchNew[1], 10),
            sequence: parseInt(matchNew[2], 10),
            uuidSuffix: matchNew[3]
        };
    }

    // Fallback to old format for backwards compatibility
    const matchOld = receiptNumber.match(/^RCP-(\d{4})-(\d{4})$/);
    if (matchOld) {
        return {
            prefix: 'RCP',
            fiscalYear: parseInt(matchOld[1], 10),
            sequence: parseInt(matchOld[2], 10)
        };
    }

    return null;
}

/**
 * Validate a receipt number format (supports both old and new formats)
 */
export function isValidReceiptNumber(receiptNumber: string): boolean {
    return /^RCP-\d{4}-\d{4}(-[a-f0-9]{6})?$/.test(receiptNumber);
}

/**
 * Get the fiscal year key for storage
 */
export function getFiscalYearKey(fiscalYear: number): string {
    return `FY${fiscalYear}`;
}

/**
 * Server-side helper to get next receipt number
 * Call this from API routes with database access
 */
export async function getNextReceiptNumber(
    getCounters: () => Promise<ReceiptCounters>,
    saveCounters: (counters: ReceiptCounters) => Promise<void>,
    date?: Date
): Promise<string> {
    const fiscalYear = getFiscalYear(date || new Date());
    const fyKey = getFiscalYearKey(fiscalYear);

    // Get current counters
    const counters = await getCounters();
    const currentCount = counters[fyKey] ?? 0;
    const nextCount = currentCount + 1;

    // Update counters
    counters[fyKey] = nextCount;
    await saveCounters(counters);

    return formatReceiptNumber(fiscalYear, nextCount);
}

/**
 * Generate a temporary ID for client-side use before server assigns real number
 */
export function generateTempReceiptId(): string {
    return `TEMP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Check if an ID is a temporary ID
 */
export function isTempReceiptId(id: string): boolean {
    return id.startsWith('TEMP-');
}
