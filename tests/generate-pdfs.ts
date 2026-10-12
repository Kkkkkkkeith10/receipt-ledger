/**
 * Sample Invoice PDF Generator
 * 
 * Generates PDF invoices for AI testing using PDFKit.
 * Run with: pnpm generate:invoices
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use pdfkit from temp folder
const require = createRequire(import.meta.url);
const PDFDocument = require('../temp-pdf/node_modules/pdfkit');

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
        filename: 'thai-restaurant-lunch',
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
            { description: 'Seat Selection - Extra Legroom', quantity: 1, unitPrice: 35.00 }
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

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function generatePDF(invoice: InvoiceData): Promise<string> {
    return new Promise((resolve, reject) => {
        const calc = calculateInvoice(invoice.items);
        const filepath = path.join(FIXTURES_DIR, `${invoice.filename}.pdf`);

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Header - Vendor Name
        doc.fontSize(24).font('Helvetica-Bold').text(invoice.vendor.name, 50, 50);

        // Vendor details
        doc.fontSize(10).font('Helvetica')
            .text(`ABN: ${invoice.vendor.abn}`, 50, 80)
            .text(invoice.vendor.address, 50, 95)
            .text(`Phone: ${invoice.vendor.phone}`, 50, 110);

        // TAX INVOICE header (right side)
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#0066cc')
            .text('TAX INVOICE', 350, 50, { width: 200, align: 'right' });

        doc.fontSize(10).font('Helvetica').fillColor('black')
            .text(`Invoice No: ${invoice.invoiceNumber}`, 350, 80, { width: 200, align: 'right' })
            .text(`Date: ${formatDate(invoice.date)}`, 350, 95, { width: 200, align: 'right' });

        if (invoice.paymentMethod) {
            doc.text(`Payment: ${invoice.paymentMethod}`, 350, 110, { width: 200, align: 'right' });
        }

        // Line separator
        doc.moveTo(50, 140).lineTo(545, 140).strokeColor('#333333').lineWidth(2).stroke();

        // Table header
        const tableTop = 160;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333');
        doc.text('Description', 50, tableTop);
        doc.text('Qty', 320, tableTop, { width: 50, align: 'center' });
        doc.text('Unit Price', 380, tableTop, { width: 70, align: 'right' });
        doc.text('Amount', 460, tableTop, { width: 80, align: 'right' });

        // Table header line
        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#333333').lineWidth(1).stroke();

        // Table rows
        let y = tableTop + 25;
        doc.font('Helvetica').fontSize(10);

        for (const item of invoice.items) {
            const amount = item.quantity * item.unitPrice;
            doc.fillColor('black')
                .text(item.description, 50, y, { width: 260 })
                .text(item.quantity.toString(), 320, y, { width: 50, align: 'center' })
                .text(`$${item.unitPrice.toFixed(2)}`, 380, y, { width: 70, align: 'right' })
                .text(`$${amount.toFixed(2)}`, 460, y, { width: 80, align: 'right' });

            // Row separator
            doc.moveTo(50, y + 15).lineTo(545, y + 15).strokeColor('#eeeeee').lineWidth(0.5).stroke();
            y += 25;
        }

        // Totals section
        y += 20;
        const totalsX = 380;

        doc.font('Helvetica')
            .text('Subtotal (Ex GST):', totalsX, y)
            .text(`$${calc.subtotal.toFixed(2)}`, 460, y, { width: 80, align: 'right' });

        y += 18;
        doc.text('GST (10%):', totalsX, y)
            .text(`$${calc.gst.toFixed(2)}`, 460, y, { width: 80, align: 'right' });

        y += 5;
        doc.moveTo(totalsX, y + 10).lineTo(545, y + 10).strokeColor('#333333').lineWidth(1).stroke();

        y += 18;
        doc.font('Helvetica-Bold').fontSize(12)
            .text('TOTAL (Inc GST):', totalsX, y)
            .text(`$${calc.total.toFixed(2)}`, 460, y, { width: 80, align: 'right' });

        // Notes section
        if (invoice.notes) {
            y += 50;
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333')
                .text('Notes:', 50, y);
            doc.font('Helvetica').fillColor('#666666')
                .text(invoice.notes, 50, y + 15);
        }

        // Footer
        doc.fontSize(8).font('Helvetica').fillColor('#999999')
            .text('* All prices include GST where applicable. This document is a valid tax invoice for GST purposes.', 50, 720)
            .text('Thank you for your business!', 50, 750, { align: 'center', width: 495 });

        doc.end();

        stream.on('finish', () => resolve(filepath));
        stream.on('error', reject);
    });
}

async function generateAllPDFs(): Promise<void> {
    // Ensure fixtures directory exists
    if (!fs.existsSync(FIXTURES_DIR)) {
        fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    console.log('\n📄 Generating Invoice PDFs...\n');

    for (const invoice of sampleInvoices) {
        try {
            const filepath = await generatePDF(invoice);
            const calc = calculateInvoice(invoice.items);
            console.log(`✅ ${invoice.filename}.pdf - ${invoice.vendor.name} - $${calc.total.toFixed(2)}`);
        } catch (error) {
            console.log(`❌ Failed to generate ${invoice.filename}.pdf: ${error}`);
        }
    }

    // Generate manifest
    const manifest = sampleInvoices.map(inv => {
        const calc = calculateInvoice(inv.items);
        return {
            filename: `${inv.filename}.pdf`,
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

    console.log(`\n📋 Manifest saved: invoice-manifest.json`);
    console.log(`\n✨ PDFs generated in: ${FIXTURES_DIR}\n`);
}

// Run
generateAllPDFs().catch(console.error);
