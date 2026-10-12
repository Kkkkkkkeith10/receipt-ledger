/**
 * Seed sample invoices (receipts) by calling the app's API.
 *
 * Usage:
 *  - pnpm run seed:receipts            # uses BASE_URL or defaults to http://127.0.0.1:8787
 *  - BASE_URL=http://localhost:8787 pnpm run seed:receipts
 *  - pnpm run seed:receipts -- --base http://localhost:8787 --count 10
 */
// Prefer the runtime's global fetch; fallback to undici if not present.
async function getFetch(): Promise<typeof fetch> {
  const gf = (globalThis as any).fetch as typeof fetch | undefined;
  if (gf) return gf;
  try {
    const mod = await import('undici');
    return (mod as any).fetch as typeof fetch;
  } catch {
    throw new Error('No fetch available. Please run on Node >=18 with global fetch or install undici.');
  }
}

type AuditInfo = {
  businessPurpose: string;
  projectCode?: string;
  location?: string;
  attendees?: string;
  businessMeal?: boolean;
  travelRelated?: boolean;
};

type ReceiptInput = {
  vendor: string;
  amount: number;
  date: string; // ISO date
  category: string;
  categoryName?: string;
  status?: 'draft' | 'pending' | 'approved' | 'rejected';
  taxDeductible?: boolean;
  receiptImageUrl?: string | null;
  auditInfo: AuditInfo;
};

const sampleReceipts: ReceiptInput[] = [
  {
    vendor: 'Starbucks',
    amount: 7.85,
    date: new Date().toISOString().slice(0, 10),
    category: 'Meals',
    categoryName: 'Meals & Entertainment',
    status: 'approved',
    taxDeductible: true,
    receiptImageUrl: null,
    auditInfo: {
      businessPurpose: 'Coffee for client sync meeting',
      location: 'Seattle, WA',
      attendees: 'K. Lee, J. Park',
      businessMeal: true
    }
  },
  {
    vendor: 'Uber',
    amount: 23.4,
    date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    category: 'Travel',
    categoryName: 'Ground Transportation',
    status: 'approved',
    taxDeductible: true,
    receiptImageUrl: null,
    auditInfo: {
      businessPurpose: 'Ride to client office for project kickoff',
      location: 'San Francisco, CA',
      travelRelated: true
    }
  },
  {
    vendor: 'Delta Airlines',
    amount: 458.12,
    date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
    category: 'Travel',
    categoryName: 'Airfare',
    status: 'approved',
    taxDeductible: true,
    receiptImageUrl: null,
    auditInfo: {
      businessPurpose: 'Flight to annual strategy meeting',
      location: 'Atlanta, GA',
      travelRelated: true
    }
  },
  {
    vendor: 'WeWork',
    amount: 199.0,
    date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    category: 'Office',
    categoryName: 'Co-working Space',
    status: 'approved',
    taxDeductible: true,
    receiptImageUrl: null,
    auditInfo: {
      businessPurpose: 'Temporary workspace for remote team sprint',
      location: 'New York, NY'
    }
  },
  {
    vendor: 'Amazon Business',
    amount: 56.73,
    date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
    category: 'Supplies',
    categoryName: 'Office Supplies',
    status: 'approved',
    taxDeductible: true,
    receiptImageUrl: null,
    auditInfo: {
      businessPurpose: 'Notebooks and pens for workshop',
      projectCode: 'WRK-2025-08'
    }
  },
  {
    vendor: 'GitHub',
    amount: 9.0,
    date: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10),
    category: 'Software',
    categoryName: 'Developer Tools',
    status: 'approved',
    taxDeductible: true,
    receiptImageUrl: null,
    auditInfo: {
      businessPurpose: 'CI minutes for private repositories'
    }
  },
  {
    vendor: 'Google Cloud',
    amount: 142.19,
    date: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
    category: 'Cloud',
    categoryName: 'Hosting',
    status: 'approved',
    taxDeductible: true,
    receiptImageUrl: null,
    auditInfo: {
      businessPurpose: 'Monthly hosting for staging environment'
    }
  },
  {
    vendor: 'Stripe',
    amount: 12.0,
    date: new Date(Date.now() - 18 * 86400000).toISOString().slice(0, 10),
    category: 'Fees',
    categoryName: 'Payment Processing',
    status: 'approved',
    taxDeductible: true,
    receiptImageUrl: null,
    auditInfo: {
      businessPurpose: 'Payment processing fees for August'
    }
  }
];

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base' && argv[i + 1]) out.base = argv[++i];
    if (a === '--count' && argv[i + 1]) out.count = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const BASE_URL = args.base || process.env.BASE_URL || 'http://127.0.0.1:8787';
  const COUNT = Math.max(1, Math.min(1000, Number(args.count ?? sampleReceipts.length)));

  console.log(`Seeding ${COUNT} receipt(s) to ${BASE_URL}/api/receipts ...`);
  const $fetch = await getFetch();

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < COUNT; i++) {
    const payload = sampleReceipts[i % sampleReceipts.length];
    try {
  const res = await $fetch(`${BASE_URL}/api/receipts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`❌ ${payload.vendor} ${payload.amount} on ${payload.date} — ${res.status}: ${text}`);
        fail++;
      } else {
        const data = (await res.json()) as { id: string };
        console.log(`✅ Created receipt ${data.id} (${payload.vendor} $${payload.amount})`);
        ok++;
      }
    } catch (e: any) {
      console.error(`❌ Error creating receipt:`, e?.message ?? e);
      fail++;
    }
  }

  console.log(`\nDone. Success: ${ok}, Failed: ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main();
