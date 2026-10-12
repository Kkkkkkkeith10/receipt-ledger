/**
 * Tax Utilities for Hong Kong
 * Hong Kong does not have GST/VAT - these utilities are for compatibility
 * and for handling imported goods or overseas receipts that may include tax
 */

export const GST_RATE = 0; // Hong Kong has no GST/VAT

/**
 * Calculate tax from a tax-inclusive amount
 * For HK, this returns 0 tax as there is no GST/VAT
 * Kept for compatibility with overseas receipts
 */
export function calculateGSTFromInclusive(totalInclusive: number): {
    total: number;
    net: number;
    gst: number;
} {
    // Hong Kong has no GST - entire amount is net
    return {
        total: round2(totalInclusive),
        net: round2(totalInclusive),
        gst: 0
    };
}

/**
 * Calculate tax from a tax-exclusive amount
 * For HK, this returns 0 tax as there is no GST/VAT
 */
export function calculateGSTFromExclusive(netExclusive: number): {
    total: number;
    net: number;
    gst: number;
} {
    // Hong Kong has no GST - total equals net
    return {
        total: round2(netExclusive),
        net: round2(netExclusive),
        gst: 0
    };
}

/**
 * Round to 2 decimal places
 */
function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Check if a category is typically tax-free
 * In Hong Kong, all categories are effectively "tax-free" as there's no GST/VAT
 */
export function isGSTFreeCategory(categoryId: string): boolean {
    // All categories in HK are tax-free (no GST/VAT)
    return true;
}

/**
 * Format amount breakdown for display
 * For HK, shows just the total as there's no GST
 */
export function formatGSTBreakdown(amount: number, isInclusive: boolean = true): string {
    return `Total: HK$${amount.toFixed(2)}`;
}

/**
 * Expense summary for Hong Kong (no GST)
 */
export interface GSTSummary {
    totalSales: number;
    gstOnSales: number;
    totalPurchases: number;
    gstOnPurchases: number;
    gstPayable: number;
}

export function calculateGSTSummary(
    salesInclusive: number,
    purchasesInclusive: number
): GSTSummary {
    // Hong Kong has no GST - return zeros for tax amounts
    return {
        totalSales: round2(salesInclusive),
        gstOnSales: 0,
        totalPurchases: round2(purchasesInclusive),
        gstOnPurchases: 0,
        gstPayable: 0
    };
}
