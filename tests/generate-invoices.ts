/**
 * Sample Invoice Generator
 * 
 * Generates HTML invoices that can be converted to PDF or screenshots for AI testing.
 * Run with: pnpm generate:invoices
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

interface InvoiceData {
    id: string;
    filename: string;
    vendor: {
        name: string;
        abn: string;
        address: string;
        phone: string;
    };
    date: string;
    invoiceNumber: string;
    items: {
        description: string;
        quantity: number;
        unitPrice: number;
    }[];
    paymentMethod?: string;
    category: string;
    notes?: string;
}

// Sample Australian invoices for testing
const sampleInvoices: InvoiceData[] = [
    {
        id: 'inv-001',
        filename: 'officeworks-supplies',
        vendor: {
            name: 'Officeworks',
            abn: '36 004 763 526',
            address: '156 George St, Sydney NSW 2000',
            phone: '02 9264 1234'
        },
        date: '2025-01-03',
        invoiceNumber: 'OW-2025-78432',
        items: [
            { description: 'A4 Copy Paper 5 Ream Box', quantity: 2, unitPrice: 34.95 },
            { description: 'Pilot G2 Pen Pack (12)', quantity: 1, unitPrice: 18.50 },
            { description: 'Sticky Notes Assorted', quantity: 3, unitPrice: 4.95 }
        ],
        paymentMethod: 'EFTPOS',
        category: 'office_supplies'
    },
    {
        id: 'inv-002',
        filename: 'bunnings-materials',
        vendor: {
            name: 'Bunnings Warehouse',
            abn: '18 004 278 352',
            address: '89 Industrial Dr, Smithfield NSW 2164',
            phone: '02 9756 7800'
        },
        date: '2025-01-05',
        invoiceNumber: 'BUN-789456',
        items: [
            { description: 'Electrical Cable 2.5mm 100m', quantity: 1, unitPrice: 189.00 },
            { description: 'Safety Glasses - Clear', quantity: 5, unitPrice: 8.95 },
            { description: 'Work Gloves Heavy Duty', quantity: 3, unitPrice: 15.90 }
        ],
        paymentMethod: 'Company Card',
        category: 'project_materials'
    },
    {
        id: 'inv-003',
        filename: 'caltex-fuel',
        vendor: {
            name: 'Caltex Star Mart',
            abn: '73 004 085 616',
            address: '45 Parramatta Rd, Homebush NSW 2140',
            phone: '02 9746 2345'
        },
        date: '2025-01-06',
        invoiceNumber: 'CTX-112233',
        items: [
            { description: 'Unleaded 91 - 65.42 Litres @ $1.85/L', quantity: 1, unitPrice: 121.03 }
        ],
        paymentMethod: 'Company Card',
        category: 'fuel_vehicle',
        notes: 'Vehicle: Company Ute ABC-123'
    },
    {
        id: 'inv-004',
        filename: 'uber-eats-lunch',
        vendor: {
            name: 'Thai Garden Restaurant',
            abn: '45 123 456 789',
            address: '23 King St, Melbourne VIC 3000',
            phone: '03 9654 7890'
        },
        date: '2025-01-07',
        invoiceNumber: 'TG-20250107-001',
        items: [
            { description: 'Pad Thai (Large)', quantity: 3, unitPrice: 18.90 },
            { description: 'Green Curry with Rice', quantity: 2, unitPrice: 17.50 },
            { description: 'Spring Rolls (6pc)', quantity: 2, unitPrice: 9.90 }
        ],
        paymentMethod: 'Credit Card',
        category: 'food_beverage',
        notes: 'Team lunch - Project kickoff meeting'
    },
    {
        id: 'inv-005',
        filename: 'aws-subscription',
        vendor: {
            name: 'Amazon Web Services',
            abn: '64 600 643 094',
            address: 'Level 37, 2 Park St, Sydney NSW 2000',
            phone: '1800 123 456'
        },
        date: '2025-01-01',
        invoiceNumber: 'AWS-AU-2025-001234',
        items: [
            { description: 'EC2 Instance - t3.medium (720 hrs)', quantity: 1, unitPrice: 45.60 },
            { description: 'S3 Storage - 500GB', quantity: 1, unitPrice: 12.50 },
            { description: 'CloudFront Data Transfer', quantity: 1, unitPrice: 8.30 }
        ],
        paymentMethod: 'Direct Debit',
        category: 'subscriptions'
    },
    {
        id: 'inv-006',
        filename: 'qantas-flight',
        vendor: {
            name: 'Qantas Airways',
            abn: '16 009 661 901',
            address: '10 Bourke Rd, Mascot NSW 2020',
            phone: '13 13 13'
        },
        date: '2024-12-28',
        invoiceNumber: 'QF-BOOKING-8765432',
        items: [
            { description: 'Sydney to Melbourne - Economy', quantity: 1, unitPrice: 245.00 },
            { description: 'Seat Selection - Extra Legroom', quantity: 1, unitPrice: 35.00 },
            { description: 'Carry-on Bag Fee', quantity: 0, unitPrice: 0.00 }
        ],
        paymentMethod: 'Credit Card',
        category: 'travel',
        notes: 'Business travel - Client meeting in Melbourne'
    }
];

function calculateInvoice(items: InvoiceData['items']): { subtotal: number; gst: number; total: number } {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const total = Math.round(subtotal * 100) / 100;
    const gst = Math.round((total / 11) * 100) / 100;
    const exGst = Math.round((total - gst) * 100) / 100;
    return { subtotal: exGst, gst, total };
}

function generateInvoiceHTML(invoice: InvoiceData): string {
    const calc = calculateInvoice(invoice.items);

    const itemRows = invoice.items.map(item => `
		<tr>
			<td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
			<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
			<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
			<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(item.quantity * item.unitPrice).toFixed(2)}</td>
		</tr>
	`).join('');

    return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>Tax Invoice - ${invoice.invoiceNumber}</title>
	<style>
		body {
			font-family: Arial, sans-serif;
			max-width: 800px;
			margin: 0 auto;
			padding: 40px;
			background: white;
		}
		.header {
			display: flex;
			justify-content: space-between;
			border-bottom: 3px solid #333;
			padding-bottom: 20px;
			margin-bottom: 30px;
		}
		.vendor-info h1 {
			margin: 0 0 10px 0;
			font-size: 28px;
			color: #333;
		}
		.vendor-details {
			color: #666;
			font-size: 14px;
			line-height: 1.6;
		}
		.invoice-meta {
			text-align: right;
		}
		.invoice-meta h2 {
			margin: 0 0 15px 0;
			color: #007bff;
			font-size: 24px;
		}
		.invoice-meta p {
			margin: 5px 0;
			font-size: 14px;
		}
		.invoice-meta strong {
			color: #333;
		}
		table {
			width: 100%;
			border-collapse: collapse;
			margin: 30px 0;
		}
		th {
			background: #f5f5f5;
			padding: 12px 8px;
			text-align: left;
			border-bottom: 2px solid #333;
			font-weight: bold;
		}
		th:nth-child(2), th:nth-child(3), th:nth-child(4) {
			text-align: center;
		}
		th:nth-child(3), th:nth-child(4) {
			text-align: right;
		}
		.totals {
			margin-left: auto;
			width: 300px;
		}
		.totals-row {
			display: flex;
			justify-content: space-between;
			padding: 8px 0;
			border-bottom: 1px solid #eee;
		}
		.totals-row.total {
			border-bottom: none;
			border-top: 2px solid #333;
			font-size: 18px;
			font-weight: bold;
			padding-top: 12px;
		}
		.payment-info {
			background: #f9f9f9;
			padding: 15px;
			border-radius: 5px;
			margin-top: 30px;
		}
		.footer {
			margin-top: 40px;
			text-align: center;
			color: #999;
			font-size: 12px;
		}
		.gst-note {
			font-size: 12px;
			color: #666;
			margin-top: 10px;
		}
	</style>
</head>
<body>
	<div class="header">
		<div class="vendor-info">
			<h1>${invoice.vendor.name}</h1>
			<div class="vendor-details">
				<div>ABN: ${invoice.vendor.abn}</div>
				<div>${invoice.vendor.address}</div>
				<div>Phone: ${invoice.vendor.phone}</div>
			</div>
		</div>
		<div class="invoice-meta">
			<h2>TAX INVOICE</h2>
			<p><strong>Invoice No:</strong> ${invoice.invoiceNumber}</p>
			<p><strong>Date:</strong> ${formatDate(invoice.date)}</p>
			${invoice.paymentMethod ? `<p><strong>Payment:</strong> ${invoice.paymentMethod}</p>` : ''}
		</div>
	</div>

	<table>
		<thead>
			<tr>
				<th>Description</th>
				<th>Qty</th>
				<th>Unit Price</th>
				<th>Amount</th>
			</tr>
		</thead>
		<tbody>
			${itemRows}
		</tbody>
	</table>

	<div class="totals">
		<div class="totals-row">
			<span>Subtotal (Ex GST):</span>
			<span>$${calc.subtotal.toFixed(2)}</span>
		</div>
		<div class="totals-row">
			<span>GST (10%):</span>
			<span>$${calc.gst.toFixed(2)}</span>
		</div>
		<div class="totals-row total">
			<span>TOTAL (Inc GST):</span>
			<span>$${calc.total.toFixed(2)}</span>
		</div>
	</div>

	${invoice.notes ? `
	<div class="payment-info">
		<strong>Notes:</strong> ${invoice.notes}
	</div>
	` : ''}

	<div class="gst-note">
		* All prices include GST where applicable. This document is a valid tax invoice for GST purposes.
	</div>

	<div class="footer">
		Thank you for your business!
	</div>
</body>
</html>`;
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

// Generate invoice summary for user approval
function generateSummary(): void {
    console.log('\n📋 Sample Invoices Summary for Approval\n');
    console.log('='.repeat(80));

    for (const invoice of sampleInvoices) {
        const calc = calculateInvoice(invoice.items);
        console.log(`\n📄 ${invoice.filename}.html`);
        console.log('-'.repeat(40));
        console.log(`   Vendor:    ${invoice.vendor.name}`);
        console.log(`   ABN:       ${invoice.vendor.abn}`);
        console.log(`   Date:      ${invoice.date}`);
        console.log(`   Invoice#:  ${invoice.invoiceNumber}`);
        console.log(`   Category:  ${invoice.category}`);
        console.log(`   Items:     ${invoice.items.length}`);
        console.log(`   Subtotal:  $${calc.subtotal.toFixed(2)}`);
        console.log(`   GST:       $${calc.gst.toFixed(2)}`);
        console.log(`   Total:     $${calc.total.toFixed(2)}`);
        if (invoice.paymentMethod) console.log(`   Payment:   ${invoice.paymentMethod}`);
        if (invoice.notes) console.log(`   Notes:     ${invoice.notes}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ ${sampleInvoices.length} invoices ready to generate\n`);
}

// Generate HTML files
function generateInvoices(): void {
    // Ensure fixtures directory exists
    if (!fs.existsSync(FIXTURES_DIR)) {
        fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    console.log('\n📝 Generating Invoice HTML Files...\n');

    for (const invoice of sampleInvoices) {
        const html = generateInvoiceHTML(invoice);
        const filepath = path.join(FIXTURES_DIR, `${invoice.filename}.html`);
        fs.writeFileSync(filepath, html, 'utf-8');

        const calc = calculateInvoice(invoice.items);
        console.log(`✅ ${invoice.filename}.html - ${invoice.vendor.name} - $${calc.total.toFixed(2)}`);
    }

    // Generate a manifest JSON for the test suite
    const manifest = sampleInvoices.map(inv => {
        const calc = calculateInvoice(inv.items);
        return {
            filename: `${inv.filename}.html`,
            expected: {
                vendor: inv.vendor.name,
                abn: inv.vendor.abn.replace(/\s/g, ''),
                date: inv.date,
                category: inv.category,
                amount: calc.total,
                gstAmount: calc.gst,
                paymentMethod: inv.paymentMethod || null
            }
        };
    });

    const manifestPath = path.join(FIXTURES_DIR, 'invoice-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`\n📋 invoice-manifest.json - Test expectations saved`);

    console.log(`\n✨ All files generated in: ${FIXTURES_DIR}\n`);
    console.log('Next steps:');
    console.log('1. Open the HTML files in a browser to review');
    console.log('2. Take screenshots or convert to PDF');
    console.log('3. Run: pnpm test:ai:invoices to test AI recognition\n');
}

// Main
const args = process.argv.slice(2);

if (args.includes('--summary') || args.includes('-s')) {
    generateSummary();
} else if (args.includes('--generate') || args.includes('-g')) {
    generateInvoices();
} else {
    console.log('\nUsage:');
    console.log('  pnpm generate:invoices --summary   Show invoice summary for approval');
    console.log('  pnpm generate:invoices --generate  Generate HTML invoice files');
    console.log('');
    generateSummary();
    console.log('\nRun with --generate flag to create the files.\n');
}
