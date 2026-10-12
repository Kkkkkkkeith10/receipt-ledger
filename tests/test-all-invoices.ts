/**
 * Test All Invoices Against AI Recognition - Using LlamaIndex
 * 
 * Tests PDF invoices through AI recognition and validates accuracy.
 * Run with: pnpm test:ai:invoices
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .dev.vars from project root
dotenv.config({ path: path.join(__dirname, '..', '.dev.vars') });

import { AzureOpenAI } from '@llamaindex/azure';
import { Settings, type ChatMessage, type LLMChatParamsNonStreaming } from 'llamaindex';
import { Poppler } from 'node-poppler';
import * as os from 'os';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// Load environment variables
const AZURE_FOUNDRY_ENDPOINT = process.env.AZURE_FOUNDRY_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || '';
const AZURE_FOUNDRY_KEY = process.env.AZURE_FOUNDRY_KEY || process.env.AZURE_OPENAI_KEY || '';
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

const RECEIPT_RECOGNITION_PROMPT = `Please review the following expense receipt/invoice. Help recognize all the details in the document.

You should recognize the following details:
(1) The date of the expense (in YYYY-MM-DD format)
(2) Name of the company/vendor (English is preferred when available)
(3) Description of the expense (keep it short and simple, within 10 words)
(4) Expense Category (the following are available: 'project_materials', 'office_supplies', 'travel', 'food_beverage', 'fuel_vehicle', 'subscriptions', 'professional_services', 'utilities', 'marketing', 'training', 'other')
(5) Total Amount Spent including GST (should be a number with 2 decimal places, be careful of other numbers like change given, card numbers, or balance amounts - we want the TOTAL amount paid)
(6) GST Amount if shown separately (should be a number with 2 decimal places, often shown as "GST" or "Tax")
(7) Currency (if not specified, assume AUD for Australian dollars)
(8) ABN (Australian Business Number) of the vendor if visible (11 digits, no spaces)
(9) Payment method if visible (cash, card, eftpos, etc.)

Return null for any field if the information is not available or cannot be recognized. Do not provide any information that is not clearly visible in the document.

Give your response in the following JSON format:
{
  "date": string | null,
  "vendor": string | null,
  "description": string | null,
  "category": string | null,
  "amount": number | null,
  "gstAmount": number | null,
  "currency": string,
  "abn": string | null,
  "paymentMethod": string | null,
  "confidence": number
}

The "confidence" field should be a number between 0 and 1 indicating how confident you are in the accuracy of the extracted data (1 = very confident, 0 = very uncertain).
`;

interface ExpectedValues {
    vendor: string;
    abn: string;
    date: string;
    category: string;
    amount: number;
    gstAmount: number;
    paymentMethod: string | null;
}

interface ManifestEntry {
    filename: string;
    expected: ExpectedValues;
}

interface RecognizedReceipt {
    date: string | null;
    vendor: string | null;
    description: string | null;
    category: string | null;
    amount: number | null;
    gstAmount: number | null;
    currency: string;
    abn: string | null;
    paymentMethod: string | null;
    confidence: number;
}

interface TestResult {
    filename: string;
    passed: boolean;
    score: number;
    maxScore: number;
    duration: number;
    expected: ExpectedValues;
    actual: RecognizedReceipt | null;
    fieldResults: Record<string, { passed: boolean; expected: any; actual: any }>;
    error?: string;
}

function createClient(): void {
    const client = new AzureOpenAI({
        apiKey: AZURE_FOUNDRY_KEY,
        endpoint: AZURE_FOUNDRY_ENDPOINT,
        deployment: AZURE_OPENAI_DEPLOYMENT
    });
    Settings.llm = client as any;
}

async function renderPdfToImages(pdfFilePath: string): Promise<Buffer[]> {
    // Create temp directory
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-render-'));
    const outStem = path.join(tmpRoot, 'page');

    const poppler = new Poppler();

    try {
        await poppler.pdfToCairo(pdfFilePath, outStem, { pngFile: true });
    } catch (err: any) {
        throw new Error(`node-poppler failed to render PDF: ${err?.message || err}`);
    }

    const files = fs
        .readdirSync(tmpRoot)
        .filter((n) => /^page.*\.png$/i.test(n))
        .sort((a, b) => a.localeCompare(b));

    if (!files.length) {
        throw new Error('node-poppler did not produce any PNG files');
    }

    const results: Buffer[] = [];
    for (const file of files) {
        const p = path.join(tmpRoot, file);
        results.push(fs.readFileSync(p));
    }

    // Clean up temp directory
    try {
        for (const file of fs.readdirSync(tmpRoot)) {
            fs.unlinkSync(path.join(tmpRoot, file));
        }
        fs.rmdirSync(tmpRoot);
    } catch {
        // Ignore cleanup errors
    }

    return results;
}

async function recognizeReceipt(pdfFilePath: string): Promise<RecognizedReceipt> {
    // Convert PDF to images using node-poppler
    const images = await renderPdfToImages(pdfFilePath);

    if (!images || images.length === 0) {
        throw new Error('Failed to render PDF to image');
    }

    // Use the first page image
    const imageBase64 = images[0].toString('base64');

    const messages: ChatMessage[] = [
        {
            role: 'user',
            content: [
                { type: 'text', text: RECEIPT_RECOGNITION_PROMPT },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/png;base64,${imageBase64}`,
                        detail: 'high'
                    }
                }
            ] as any
        }
    ];

    const chatOptions: LLMChatParamsNonStreaming = {
        messages,
        stream: false,
        additionalChatOptions: {
            temperature: 1,
            top_p: 1,
            response_format: { type: 'json_object' }
        }
    };

    const response = await Settings.llm.chat(chatOptions);
    const content = String(response?.message?.content);

    if (!content) {
        throw new Error('No response from AI');
    }

    return JSON.parse(content);
}

function compareValues(expected: ExpectedValues, actual: RecognizedReceipt): {
    score: number;
    maxScore: number;
    fieldResults: Record<string, { passed: boolean; expected: any; actual: any }>
} {
    const fieldResults: Record<string, { passed: boolean; expected: any; actual: any }> = {};
    let score = 0;
    const maxScore = 6;

    // Vendor (fuzzy match)
    const vendorMatch = actual.vendor?.toLowerCase().includes(expected.vendor.toLowerCase().split(' ')[0]) ||
        expected.vendor.toLowerCase().includes(actual.vendor?.toLowerCase().split(' ')[0] || '');
    fieldResults['vendor'] = { passed: vendorMatch, expected: expected.vendor, actual: actual.vendor };
    if (vendorMatch) score++;

    // Amount (within $0.02)
    const amountMatch = actual.amount !== null && Math.abs(actual.amount - expected.amount) <= 0.02;
    fieldResults['amount'] = { passed: amountMatch, expected: expected.amount, actual: actual.amount };
    if (amountMatch) score++;

    // Date (exact match)
    const dateMatch = actual.date === expected.date;
    fieldResults['date'] = { passed: dateMatch, expected: expected.date, actual: actual.date };
    if (dateMatch) score++;

    // GST (within 10% tolerance)
    const gstTolerance = expected.gstAmount * 0.1;
    const gstMatch = actual.gstAmount !== null && Math.abs(actual.gstAmount - expected.gstAmount) <= gstTolerance;
    fieldResults['gstAmount'] = { passed: gstMatch, expected: expected.gstAmount, actual: actual.gstAmount };
    if (gstMatch) score++;

    // Category (exact match)
    const categoryMatch = actual.category === expected.category;
    fieldResults['category'] = { passed: categoryMatch, expected: expected.category, actual: actual.category };
    if (categoryMatch) score++;

    // ABN (exact match, removing spaces)
    const actualAbn = actual.abn?.replace(/\s/g, '') || null;
    const abnMatch = actualAbn === expected.abn;
    fieldResults['abn'] = { passed: abnMatch, expected: expected.abn, actual: actualAbn };
    if (abnMatch) score++;

    return { score, maxScore, fieldResults };
}

async function testInvoice(entry: ManifestEntry): Promise<TestResult> {
    const filepath = path.join(FIXTURES_DIR, entry.filename);

    if (!fs.existsSync(filepath)) {
        return {
            filename: entry.filename,
            passed: false,
            score: 0,
            maxScore: 6,
            duration: 0,
            expected: entry.expected,
            actual: null,
            fieldResults: {},
            error: `File not found: ${filepath}`
        };
    }

    const startTime = Date.now();

    try {
        const actual = await recognizeReceipt(filepath);
        const duration = Date.now() - startTime;

        const { score, maxScore, fieldResults } = compareValues(entry.expected, actual);

        return {
            filename: entry.filename,
            passed: score >= 5, // Pass if 5/6 fields correct
            score,
            maxScore,
            duration,
            expected: entry.expected,
            actual,
            fieldResults
        };
    } catch (error: any) {
        return {
            filename: entry.filename,
            passed: false,
            score: 0,
            maxScore: 6,
            duration: Date.now() - startTime,
            expected: entry.expected,
            actual: null,
            fieldResults: {},
            error: error.message
        };
    }
}

function printResult(result: TestResult): void {
    const status = result.passed ? '✅' : '❌';
    const scoreColor = result.score >= 5 ? '\x1b[32m' : result.score >= 3 ? '\x1b[33m' : '\x1b[31m';

    console.log(`\n${status} ${result.filename}`);
    console.log(`   Score: ${scoreColor}${result.score}/${result.maxScore}\x1b[0m | Duration: ${result.duration}ms`);

    if (result.error) {
        console.log(`   Error: \x1b[31m${result.error}\x1b[0m`);
        return;
    }

    console.log('   Fields:');
    for (const [field, data] of Object.entries(result.fieldResults)) {
        const icon = data.passed ? '✓' : '✗';
        const color = data.passed ? '\x1b[32m' : '\x1b[31m';
        console.log(`     ${color}${icon}\x1b[0m ${field}: expected "${data.expected}" → got "${data.actual}"`);
    }

    if (result.actual?.confidence !== undefined) {
        console.log(`   Confidence: ${(result.actual.confidence * 100).toFixed(0)}%`);
    }
}

async function runAllTests(): Promise<void> {
    console.log('\n📄 AI Receipt Recognition Test Suite (LlamaIndex)\n');
    console.log('='.repeat(60));

    // Check credentials
    if (!AZURE_FOUNDRY_ENDPOINT || !AZURE_FOUNDRY_KEY) {
        console.log('\n❌ Missing Azure OpenAI credentials!');
        console.log('Set environment variables:');
        console.log('  $env:AZURE_FOUNDRY_ENDPOINT = "https://your-resource.openai.azure.com/"');
        console.log('  $env:AZURE_FOUNDRY_KEY = "your-api-key"');
        process.exit(1);
    }

    // Initialize LlamaIndex client
    createClient();

    // Load manifest
    const manifestPath = path.join(FIXTURES_DIR, 'invoice-manifest.json');
    if (!fs.existsSync(manifestPath)) {
        console.log('\n❌ Manifest not found! Run: pnpm generate:invoices');
        process.exit(1);
    }

    const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    console.log(`\nTesting ${manifest.length} invoices...\n`);

    const results: TestResult[] = [];

    for (const entry of manifest) {
        console.log(`\n⏳ Testing ${entry.filename}...`);
        const result = await testInvoice(entry);
        results.push(result);
        printResult(result);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SUMMARY\n');

    const passed = results.filter(r => r.passed).length;
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const maxTotalScore = results.reduce((sum, r) => sum + r.maxScore, 0);
    const avgDuration = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length);
    const accuracy = ((totalScore / maxTotalScore) * 100).toFixed(1);

    console.log(`   Invoices Passed: ${passed}/${results.length}`);
    console.log(`   Total Score: ${totalScore}/${maxTotalScore} (${accuracy}%)`);
    console.log(`   Avg Duration: ${avgDuration}ms`);

    // Per-field accuracy
    console.log('\n   Field Accuracy:');
    const fields = ['vendor', 'amount', 'date', 'gstAmount', 'category', 'abn'];
    for (const field of fields) {
        const fieldPassed = results.filter(r => r.fieldResults[field]?.passed).length;
        const pct = ((fieldPassed / results.length) * 100).toFixed(0);
        const bar = '█'.repeat(Math.round(fieldPassed / results.length * 10)) + '░'.repeat(10 - Math.round(fieldPassed / results.length * 10));
        console.log(`     ${field.padEnd(12)} ${bar} ${fieldPassed}/${results.length} (${pct}%)`);
    }

    // Overall verdict
    console.log('\n' + '='.repeat(60));
    if (parseFloat(accuracy) >= 90) {
        console.log('\n🟢 EXCELLENT - Ready for production!\n');
    } else if (parseFloat(accuracy) >= 70) {
        console.log('\n🟡 GOOD - Minor prompt tuning may help.\n');
    } else if (parseFloat(accuracy) >= 50) {
        console.log('\n🟠 FAIR - Review AI configuration.\n');
    } else {
        console.log('\n🔴 POOR - Major changes needed.\n');
    }

    // Save report
    const reportPath = path.join(FIXTURES_DIR, 'test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: { passed, total: results.length, totalScore, maxTotalScore, accuracy, avgDuration },
        results
    }, null, 2));
    console.log(`📋 Full report saved: test-results.json\n`);

    process.exit(passed === results.length ? 0 : 1);
}

// Run
runAllTests().catch(console.error);
