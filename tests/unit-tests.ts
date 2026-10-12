/**
 * Unit tests for the duplicate-receipt detection helpers + fiscal year utils
 * + upload-queue concurrency invariant.
 *
 * Pure JS — no DB, no network. Run with: pnpm tsx tests/unit-tests.ts
 */

import {
    normalizeVendor,
    vendorSimilarity,
    buildSearchWindow,
    rankDuplicates,
    type ExistingReceipt,
} from '../src/lib/utils/duplicates';

import {
    getFiscalYear,
    getFiscalYearRange,
    isInFiscalYear,
} from '../src/lib/utils/fiscal';

// --- tiny test framework -----------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];
const queue: Array<() => Promise<void>> = [];

function test(name: string, fn: () => void | Promise<void>) {
    queue.push(async () => {
        try {
            await fn();
            passed++;
            console.log(`  ✓ ${name}`);
        } catch (e) {
            failed++;
            const msg = e instanceof Error ? e.message : String(e);
            failures.push(`${name}: ${msg}`);
            console.log(`  ✗ ${name}\n      ${msg}`);
        }
    });
}

function eq<T>(actual: T, expected: T, label = '') {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${label}\n      expected: ${e}\n      actual:   ${a}`);
}

function assert(cond: boolean, label = '') {
    if (!cond) throw new Error(label || 'assertion failed');
}

function near(actual: number, expected: number, tol = 1e-6, label = '') {
    if (Math.abs(actual - expected) > tol) {
        throw new Error(`${label} expected ≈ ${expected}, got ${actual}`);
    }
}

function section(name: string) {
    queue.push(async () => console.log(`\n▸ ${name}`));
}

// --- normalizeVendor ---------------------------------------------------------

section('normalizeVendor');

test('lowercases and trims', () => {
    eq(normalizeVendor('  Starbucks  '), 'starbucks');
});

test('strips punctuation', () => {
    eq(normalizeVendor("McDonald's, Inc."), 'mcdonald s inc');
});

test('collapses whitespace', () => {
    eq(normalizeVendor('Pacific\t Coffee\n\nCo.'), 'pacific coffee co');
});

test('handles null/undefined/empty', () => {
    eq(normalizeVendor(null), '');
    eq(normalizeVendor(undefined), '');
    eq(normalizeVendor(''), '');
});

test('preserves CJK characters', () => {
    eq(normalizeVendor('星巴克 (中環店)'), '星巴克 中環店');
});

// --- vendorSimilarity --------------------------------------------------------

section('vendorSimilarity');

test('identical → 1.0', () => {
    near(vendorSimilarity('starbucks', 'starbucks'), 1.0);
});

test('substring → 0.9', () => {
    near(vendorSimilarity('starbucks', 'starbucks central'), 0.9);
    near(vendorSimilarity('starbucks central', 'starbucks'), 0.9);
});

test('empty → 0', () => {
    eq(vendorSimilarity('', 'starbucks'), 0);
    eq(vendorSimilarity('starbucks', ''), 0);
});

test('disjoint tokens → 0', () => {
    eq(vendorSimilarity('apple', 'banana'), 0);
});

test('partial token overlap is between 0 and 0.9', () => {
    const s = vendorSimilarity('pacific coffee co', 'pacific tea co');
    assert(s > 0 && s < 0.9, `got ${s}`);
});

test('token Jaccard correctness', () => {
    // {a,b,c} vs {a,c,d}: intersect=2, union=4 → 0.5
    near(vendorSimilarity('a b c', 'a c d'), 0.5);
});

// --- buildSearchWindow -------------------------------------------------------

section('buildSearchWindow');

test('±3 day window around date', () => {
    const w = buildSearchWindow({
        vendor: 'x',
        amount: 100,
        currency: 'HKD',
        date: '2026-01-10',
    });
    assert(w !== null);
    eq(w!.fromDate, '2026-01-07');
    eq(w!.toDate, '2026-01-13');
});

test('amount tolerance is max(1%, 1)', () => {
    const small = buildSearchWindow({
        vendor: 'x', amount: 50, currency: 'HKD', date: '2026-01-10',
    });
    near(small!.tolerance, 1, 1e-6); // 1% of 50 = 0.5, floor at 1

    const big = buildSearchWindow({
        vendor: 'x', amount: 10000, currency: 'HKD', date: '2026-01-10',
    });
    near(big!.tolerance, 100, 1e-6); // 1% of 10000 = 100
});

test('invalid date returns null', () => {
    const w = buildSearchWindow({
        vendor: 'x', amount: 50, currency: 'HKD', date: 'not-a-date',
    });
    eq(w, null);
});

// --- rankDuplicates ----------------------------------------------------------

section('rankDuplicates');

const baseInput = {
    vendor: 'Starbucks',
    amount: 50,
    currency: 'HKD',
    date: '2026-01-10',
};

test('flags exact same vendor+amount+date', () => {
    const out = rankDuplicates(baseInput, [
        { id: 'R1', vendor: 'Starbucks', amount: 50, currency: 'HKD', date: '2026-01-10' },
    ]);
    eq(out.length, 1);
    eq(out[0].id, 'R1');
    near(out[0].score, 1);
});

test('flags within amount tolerance', () => {
    const out = rankDuplicates(
        { ...baseInput, amount: 1000 },
        [
            // 1% tolerance = 10; 1005 is within ±10
            { id: 'R1', vendor: 'Starbucks', amount: 1005, currency: 'HKD', date: '2026-01-10' },
        ]
    );
    eq(out.length, 1);
});

test('skips different currency', () => {
    const out = rankDuplicates(baseInput, [
        { id: 'R1', vendor: 'Starbucks', amount: 50, currency: 'USD', date: '2026-01-10' },
    ]);
    eq(out, []);
});

test('skips archived', () => {
    const out = rankDuplicates(baseInput, [
        {
            id: 'R1', vendor: 'Starbucks', amount: 50,
            currency: 'HKD', date: '2026-01-10', archived: true,
        },
    ]);
    eq(out, []);
});

test('drops poor vendor + non-tight amount', () => {
    // Different vendor (score 0), amount within window but not "close" (>tol/2)
    // tolerance for 100 is 1, so >0.5 difference is "not close"
    const out = rankDuplicates(
        { ...baseInput, amount: 100 },
        [{ id: 'R1', vendor: 'Burger King', amount: 100.8, currency: 'HKD', date: '2026-01-10' }]
    );
    eq(out, []);
});

test('keeps poor vendor when amount is essentially exact', () => {
    const out = rankDuplicates(
        { ...baseInput, amount: 100 },
        [{ id: 'R1', vendor: 'Burger King', amount: 100.0, currency: 'HKD', date: '2026-01-10' }]
    );
    eq(out.length, 1);
});

test('ranks higher vendor score first', () => {
    const out = rankDuplicates(baseInput, [
        { id: 'R-different-vendor', vendor: 'Other Cafe', amount: 50, currency: 'HKD', date: '2026-01-10' },
        { id: 'R-exact', vendor: 'Starbucks', amount: 50, currency: 'HKD', date: '2026-01-10' },
        { id: 'R-substring', vendor: 'Starbucks Central', amount: 50, currency: 'HKD', date: '2026-01-10' },
    ]);
    eq(out[0].id, 'R-exact');
    eq(out[1].id, 'R-substring');
});

test('limits to 5 matches', () => {
    const candidates: ExistingReceipt[] = Array.from({ length: 10 }, (_, i) => ({
        id: `R${i}`, vendor: 'Starbucks', amount: 50, currency: 'HKD', date: '2026-01-10',
    }));
    const out = rankDuplicates(baseInput, candidates);
    eq(out.length, 5);
});

test('empty input → no matches', () => {
    eq(rankDuplicates(baseInput, []), []);
});

test('rejects zero or negative amount', () => {
    eq(rankDuplicates({ ...baseInput, amount: 0 },
        [{ id: 'R1', vendor: 'Starbucks', amount: 0, currency: 'HKD', date: '2026-01-10' }]), []);
});

test('case-insensitive vendor match', () => {
    const out = rankDuplicates(baseInput, [
        { id: 'R1', vendor: 'STARBUCKS', amount: 50, currency: 'HKD', date: '2026-01-10' },
    ]);
    eq(out.length, 1);
    near(out[0].score, 1);
});

test('punctuation differences still match', () => {
    const out = rankDuplicates(
        { ...baseInput, vendor: 'Pacific Coffee Co.' },
        [{ id: 'R1', vendor: 'pacific-coffee co', amount: 50, currency: 'HKD', date: '2026-01-10' }]
    );
    eq(out.length, 1);
});

test('null currency on candidate is allowed (treated as same)', () => {
    const out = rankDuplicates(baseInput, [
        { id: 'R1', vendor: 'Starbucks', amount: 50, currency: null, date: '2026-01-10' },
    ]);
    eq(out.length, 1);
});

// --- fiscal year -------------------------------------------------------------

section('fiscal year (HK: Apr 1 → Mar 31)');

test('Feb 2024 → FY2024', () => {
    eq(getFiscalYear(new Date('2024-02-15')), 2024);
});

test('Apr 2024 → FY2025', () => {
    eq(getFiscalYear(new Date('2024-04-01')), 2025);
});

test('Mar 31 2024 → FY2024', () => {
    eq(getFiscalYear(new Date('2024-03-31')), 2024);
});

test('Apr 1 2024 → FY2025', () => {
    eq(getFiscalYear(new Date('2024-04-01')), 2025);
});

test('range FY2024 = Apr 1 2023 → Mar 31 2024', () => {
    const r = getFiscalYearRange(2024);
    // Local date components (range is built in local time).
    eq([r.start.getFullYear(), r.start.getMonth(), r.start.getDate()], [2023, 3, 1]);
    eq([r.end.getFullYear(), r.end.getMonth(), r.end.getDate()], [2024, 2, 31]);
});

test('isInFiscalYear edges', () => {
    assert(isInFiscalYear(new Date('2023-04-01'), 2024));
    assert(isInFiscalYear(new Date('2024-03-31'), 2024));
    assert(!isInFiscalYear(new Date('2024-04-01'), 2024));
    assert(!isInFiscalYear(new Date('2023-03-31'), 2024));
});

// --- upload-queue concurrency invariant --------------------------------------
// We don't import the Svelte component (no Svelte runtime here),
// but we re-implement the same scheduler logic to guarantee the
// invariant we promised: at most MAX_CONCURRENT in flight.

section('upload-queue concurrency');

async function runQueueSim(jobCount: number, maxConcurrent: number, jobMs: number) {
    let active = 0;
    let peak = 0;

    type Job = { id: string; status: 'pending' | 'uploading' | 'done' };
    const jobs: Job[] = Array.from({ length: jobCount }, (_, i) => ({
        id: `j${i}`, status: 'pending',
    }));

    async function run(j: Job) {
        // Same loop as QuickUpload.svelte
        while (jobs.filter((x) => x.status === 'uploading').length >= maxConcurrent) {
            await new Promise((r) => setTimeout(r, 5));
        }
        j.status = 'uploading';
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, jobMs));
        active--;
        j.status = 'done';
    }

    await Promise.all(jobs.map(run));
    return { peak, allDone: jobs.every((j) => j.status === 'done') };
}

test('peak concurrency never exceeds MAX_CONCURRENT', async () => {
    const { peak, allDone } = await runQueueSim(10, 3, 30);
    assert(allDone, 'all jobs must finish');
    assert(peak <= 3, `peak was ${peak}`);
});

test('all jobs eventually complete with concurrency=1', async () => {
    const { peak, allDone } = await runQueueSim(5, 1, 10);
    assert(allDone);
    assert(peak === 1, `peak was ${peak}`);
});

// --- summary -----------------------------------------------------------------

(async () => {
    for (const t of queue) await t();
    console.log('\n────────────────────────────────────────');
    console.log(`  ${passed} passed · ${failed} failed`);
    if (failed > 0) {
        console.log('\nFailures:');
        for (const f of failures) console.log('  •', f);
        process.exit(1);
    }
})();
