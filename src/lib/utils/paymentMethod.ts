import type { PaymentMethod } from '$lib/types';

const VALID: ReadonlySet<PaymentMethod> = new Set(['cash', 'card', 'bank_transfer', 'other']);

/**
 * Normalize a free-form payment method string (e.g. from an AI extraction or
 * legacy data) into one of the canonical PaymentMethod values. Returns
 * undefined when the input is empty so the caller can omit the field.
 */
export function normalizePaymentMethod(input: unknown): PaymentMethod | undefined {
    if (input === null || input === undefined) return undefined;
    if (typeof input !== 'string') return undefined;

    const raw = input.trim();
    if (!raw) return undefined;

    const lower = raw.toLowerCase().replace(/[\s-]+/g, '_');

    if (VALID.has(lower as PaymentMethod)) {
        return lower as PaymentMethod;
    }

    // Cash-like
    if (/(^|_)cash(_|$)/.test(lower)) return 'cash';

    // Bank transfer / wire / ACH / FPS / direct deposit
    if (
        /bank|transfer|wire|ach|fps|direct_deposit|remittance|swift|tt\b/.test(lower)
    ) {
        return 'bank_transfer';
    }

    // Card-like (covers credit/debit/visa/master/amex/eftpos and digital wallets
    // backed by cards)
    if (
        /card|visa|master|amex|american_express|diners|discover|jcb|unionpay|debit|credit|eftpos|tap|contactless|apple_pay|google_pay|samsung_pay|octopus|alipay|wechat|payme|paypal|stripe|square/.test(
            lower
        )
    ) {
        return 'card';
    }

    // Cheque, money order, gift card, voucher, crypto, etc.
    if (/cheque|check|money_order|voucher|gift|crypto|bitcoin|other/.test(lower)) {
        return 'other';
    }

    return 'other';
}
