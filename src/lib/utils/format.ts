/**
 * Formatting utilities
 */

/**
 * Supported currencies with their configurations
 */
export type SupportedCurrency = 'HKD' | 'JPY' | 'TWD' | 'USD' | 'CNY' | 'EUR' | 'GBP';

const CURRENCY_CONFIG: Record<SupportedCurrency, {
    locale: string;
    symbol: string;
    decimals: number;
}> = {
    HKD: { locale: 'en-HK', symbol: 'HK$', decimals: 2 },
    JPY: { locale: 'ja-JP', symbol: '¥', decimals: 0 },
    TWD: { locale: 'zh-TW', symbol: 'NT$', decimals: 0 },
    USD: { locale: 'en-US', symbol: '$', decimals: 2 },
    CNY: { locale: 'zh-CN', symbol: '¥', decimals: 2 },
    EUR: { locale: 'de-DE', symbol: '€', decimals: 2 },
    GBP: { locale: 'en-GB', symbol: '£', decimals: 2 },
};

/**
 * Default exchange rates to HKD (1 unit of currency = X HKD)
 * These are fallback values - real rates should be fetched from settings/API
 */
export const DEFAULT_EXCHANGE_RATES: Record<SupportedCurrency, number> = {
    HKD: 1,
    JPY: 0.052,   // 1 JPY = 0.052 HKD
    TWD: 0.24,    // 1 TWD = 0.24 HKD
    USD: 7.8,     // 1 USD = 7.8 HKD
    CNY: 1.08,    // 1 CNY = 1.08 HKD
    EUR: 8.5,     // 1 EUR = 8.5 HKD
    GBP: 9.9,     // 1 GBP = 9.9 HKD
};

/**
 * Convert amount from one currency to HKD
 */
export function convertToHKD(
    amount: number,
    fromCurrency: SupportedCurrency,
    exchangeRates?: Partial<Record<SupportedCurrency, number>>
): number {
    const rates = { ...DEFAULT_EXCHANGE_RATES, ...exchangeRates };
    const rate = rates[fromCurrency] ?? 1;
    return amount * rate;
}

/**
 * Get exchange rate description
 */
export function getExchangeRateDescription(
    fromCurrency: SupportedCurrency,
    exchangeRates?: Partial<Record<SupportedCurrency, number>>
): string {
    if (fromCurrency === 'HKD') return '';
    const rates = { ...DEFAULT_EXCHANGE_RATES, ...exchangeRates };
    const rate = rates[fromCurrency] ?? 1;
    return `1 ${fromCurrency} = ${rate.toFixed(4)} HKD`;
}

/**
 * Format currency with multi-currency support
 * @param amount - The amount to format
 * @param options - Formatting options including currency code
 */
export function formatCurrency(
    amount: number | null | undefined,
    options?: {
        showSign?: boolean;
        compact?: boolean;
        currency?: SupportedCurrency;
    }
): string {
    const currency = options?.currency ?? 'HKD';
    const config = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.HKD;

    if (amount === null || amount === undefined) {
        return `${config.symbol}0${config.decimals > 0 ? '.' + '0'.repeat(config.decimals) : ''}`;
    }

    const { showSign = false, compact = false } = options ?? {};

    const formatter = new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: compact ? 0 : config.decimals,
        maximumFractionDigits: config.decimals,
        notation: compact && Math.abs(amount) >= 1000 ? 'compact' : 'standard'
    });

    const formatted = formatter.format(Math.abs(amount));

    if (showSign && amount !== 0) {
        return amount > 0 ? `+${formatted}` : `-${formatted}`;
    }

    return amount < 0 ? `-${formatted}` : formatted;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: SupportedCurrency = 'HKD'): string {
    return CURRENCY_CONFIG[currency]?.symbol ?? CURRENCY_CONFIG.HKD.symbol;
}

/**
 * Get all supported currencies
 */
export function getSupportedCurrencies(): { code: SupportedCurrency; symbol: string; name: string }[] {
    return [
        { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
        { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
        { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar' },
        { code: 'USD', symbol: '$', name: 'US Dollar' },
        { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
        { code: 'EUR', symbol: '€', name: 'Euro' },
        { code: 'GBP', symbol: '£', name: 'British Pound' },
    ];
}

/**
 * Format date for display
 */
export function formatDate(
    date: Date | string | null | undefined,
    format: 'short' | 'medium' | 'long' | 'iso' = 'medium'
): string {
    if (!date) return '';

    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    switch (format) {
        case 'short':
            return d.toLocaleDateString('en-HK', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit'
            });
        case 'medium':
            return d.toLocaleDateString('en-HK', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        case 'long':
            return d.toLocaleDateString('en-HK', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        case 'iso':
            return d.toISOString().split('T')[0];
        default:
            return d.toLocaleDateString('en-HK');
    }
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format percentage
 */
export function formatPercent(
    value: number,
    options?: { decimals?: number; showSign?: boolean }
): string {
    const { decimals = 1, showSign = false } = options ?? {};
    const formatted = `${Math.abs(value).toFixed(decimals)}%`;

    if (showSign && value !== 0) {
        return value > 0 ? `+${formatted}` : `-${formatted}`;
    }

    return value < 0 ? `-${formatted}` : formatted;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Slugify text for URLs
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .trim();
}
