/**
 * Duplicate-receipt detection helpers (pure / unit-testable).
 *
 * These do NOT touch the DB — `findPossibleDuplicates` accepts a list of
 * candidate receipts that the caller is responsible for fetching.
 */

export interface DuplicateCandidate {
    id: string;
    vendor: string | null;
    amount: number | null;
    currency: string;
    date: string | null;
    score: number;
}

export interface DuplicateInput {
    vendor: string;
    amount: number;
    currency: string;
    date: string;
}

export interface ExistingReceipt {
    id: string;
    vendor?: string | null;
    amount?: number | null;
    currency?: string | null;
    date?: string | null;
    archived?: boolean;
}

/**
 * Strip punctuation, lowercase, collapse whitespace.
 */
export function normalizeVendor(s: string | null | undefined): string {
    return (s || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Vendor similarity in [0,1]: 1.0 exact, 0.9 substring, else token Jaccard.
 * Inputs should already be normalized via normalizeVendor.
 */
export function vendorSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.9;

    const ta = new Set(a.split(' ').filter(Boolean));
    const tb = new Set(b.split(' ').filter(Boolean));
    if (ta.size === 0 || tb.size === 0) return 0;

    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter++;
    const union = ta.size + tb.size - inter;
    return union === 0 ? 0 : inter / union;
}

/**
 * Compute the date window (±days) and amount tolerance (max(1%, 1 unit))
 * used to constrain duplicate searches.
 */
export function buildSearchWindow(input: DuplicateInput, days = 3) {
    const target = new Date(input.date);
    if (isNaN(target.getTime())) return null;

    const fromDate = new Date(target);
    fromDate.setDate(fromDate.getDate() - days);
    const toDate = new Date(target);
    toDate.setDate(toDate.getDate() + days);

    const tolerance = Math.max(input.amount * 0.01, 1);
    return {
        fromDate: fromDate.toISOString().slice(0, 10),
        toDate: toDate.toISOString().slice(0, 10),
        minAmount: input.amount - tolerance,
        maxAmount: input.amount + tolerance,
        tolerance,
    };
}

/**
 * Score and rank candidate receipts against an incoming one.
 *
 * Caller must already have filtered by date window and amount window
 * (those are the indices we expect the DB to apply); this function
 * applies the cross-field heuristics and returns up to `limit` matches.
 */
export function rankDuplicates(
    input: DuplicateInput,
    candidates: ExistingReceipt[],
    limit = 5
): DuplicateCandidate[] {
    if (!input.amount || input.amount <= 0) return [];
    if (!input.date) return [];
    const win = buildSearchWindow(input);
    if (!win) return [];

    const inputVendor = normalizeVendor(input.vendor);
    const matches: DuplicateCandidate[] = [];

    for (const row of candidates) {
        if (row.archived) continue;
        if (row.currency && row.currency !== input.currency) continue;

        const candVendor = normalizeVendor(row.vendor || '');
        const vendorScore =
            inputVendor && candVendor ? vendorSimilarity(inputVendor, candVendor) : 0.5;

        const amountDiff = Math.abs((row.amount ?? 0) - input.amount);
        const amountClose = amountDiff <= win.tolerance / 2;

        if (vendorScore < 0.6 && !amountClose) continue;

        matches.push({
            id: row.id,
            vendor: row.vendor ?? null,
            amount: row.amount ?? null,
            currency: row.currency ?? input.currency,
            date: row.date ?? null,
            score: Math.round(vendorScore * 100) / 100,
        });
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, limit);
}

// ============================================================================
// Cluster detection (used by the "Check duplicates" button on /receipts)
// ============================================================================

export interface ClusterableReceipt {
    id: string;
    vendor?: string | null;
    amount?: number | null;
    currency?: string | null;
    date?: string | null;
    archived?: boolean;
}

/**
 * True if two receipts look like duplicates of each other.
 * Same heuristic as rankDuplicates but for a pairwise comparison.
 */
export function isLikelyDuplicate(a: ClusterableReceipt, b: ClusterableReceipt): boolean {
    if (a.id === b.id) return false;
    if (a.archived || b.archived) return false;

    const amtA = a.amount ?? 0;
    const amtB = b.amount ?? 0;
    if (amtA <= 0 || amtB <= 0) return false;

    if (a.currency && b.currency && a.currency !== b.currency) return false;

    if (!a.date || !b.date) return false;
    const dA = new Date(a.date).getTime();
    const dB = new Date(b.date).getTime();
    if (isNaN(dA) || isNaN(dB)) return false;
    const dayDiff = Math.abs(dA - dB) / 86_400_000;
    if (dayDiff > 3) return false;

    const tolerance = Math.max(Math.max(amtA, amtB) * 0.01, 1);
    const amtDiff = Math.abs(amtA - amtB);
    if (amtDiff > tolerance) return false;

    const vA = normalizeVendor(a.vendor ?? '');
    const vB = normalizeVendor(b.vendor ?? '');
    const vScore = vA && vB ? vendorSimilarity(vA, vB) : 0.5;

    // Need either close vendor OR very tight amount match
    return vScore >= 0.6 || amtDiff <= tolerance / 2;
}

/**
 * Group receipts into clusters of likely duplicates. Returns only
 * clusters of size ≥ 2. Each receipt appears in at most one cluster.
 */
export function findDuplicateClusters(receipts: ClusterableReceipt[]): string[][] {
    const n = receipts.length;
    const parent: number[] = receipts.map((_, i) => i);

    const find = (x: number): number => {
        while (parent[x] !== x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    };
    const union = (x: number, y: number) => {
        const rx = find(x);
        const ry = find(y);
        if (rx !== ry) parent[rx] = ry;
    };

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (isLikelyDuplicate(receipts[i], receipts[j])) {
                union(i, j);
            }
        }
    }

    const groups = new Map<number, string[]>();
    for (let i = 0; i < n; i++) {
        const root = find(i);
        const arr = groups.get(root) ?? [];
        arr.push(receipts[i].id);
        groups.set(root, arr);
    }

    return Array.from(groups.values()).filter((g) => g.length >= 2);
}
