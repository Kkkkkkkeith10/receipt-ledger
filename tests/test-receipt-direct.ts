/**
 * Direct Receipt Test - Tests PDF conversion and AI recognition
 * Works without the full server since it calls the utility functions directly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .dev.vars
const devVarsPath = path.join(__dirname, '..', '.dev.vars');
if (fs.existsSync(devVarsPath)) {
    const content = fs.readFileSync(devVarsPath, 'utf-8');
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
        }
    });
}

// Import the utilities (they should work in Node.js)
import { imageToPdf, isPdf, detectMimeType, uint8ArrayToBase64 } from '../src/lib/utils/pdf.js';
import { formatReceiptNumber, getFiscalYearKey } from '../src/lib/utils/receiptNumber.js';

// Import LlamaIndex for AI
import { AzureOpenAI } from '@llamaindex/azure';
import { Settings, type ChatMessage } from 'llamaindex';

const IMAGES_DIR = path.join(__dirname, 'recieptImages');
const OUTPUT_DIR = path.join(__dirname, 'output');

interface TestResult {
    file: string;
    pdfConverted: boolean;
    pdfSize?: number;
    receiptNumber?: string;
    aiResult?: {
        vendor?: string;
        amount?: number;
        date?: string;
        category?: string;
        confidence?: number;
    };
    error?: string;
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function recognizeWithAI(imageBase64: string, mimeType: string): Promise<any> {
    const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
    const key = process.env.AZURE_FOUNDRY_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-mini';

    if (!endpoint || !key) {
        return { error: 'AI credentials not configured' };
    }

    try {
        const llm = new AzureOpenAI({
            apiKey: key,
            endpoint,
            deployment
        });
        Settings.llm = llm as any;

        const systemPrompt = `You are an expert receipt analyzer. Analyze the receipt image and extract:
1. vendor: The store/business name
2. amount: Total amount (number only)
3. date: Receipt date in YYYY-MM-DD format
4. category: One of: office_supplies, software, travel, meals, professional_services, utilities, marketing, equipment, other
5. items: Array of line items with description and amount
6. gstAmount: GST/tax amount if visible (Australian GST is 10%)

Respond ONLY with valid JSON, no markdown.`;

        const userPrompt = `Analyze this receipt image and extract the data as JSON.`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    { type: 'text', text: userPrompt },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${mimeType};base64,${imageBase64}`
                        }
                    }
                ]
            }
        ];

        const response = await Settings.llm.chat({
            messages,
            stream: false
        });

        const content = response?.message?.content;
        const text = typeof content === 'string' ? content : JSON.stringify(content);

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return { error: 'No JSON found in response', raw: text };
    } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
    }
}

async function testReceipt(imagePath: string, index: number): Promise<TestResult> {
    const fileName = path.basename(imagePath);
    console.log(`\n📄 Testing: ${fileName}`);

    try {
        // Read image
        const imageBuffer = fs.readFileSync(imagePath);
        const imageUint8 = new Uint8Array(imageBuffer);

        // Detect MIME type
        const mimeType = detectMimeType(imageUint8) || 'image/jpeg';
        console.log(`   📋 Detected type: ${mimeType}`);

        // Generate receipt number
        const fiscalYear = 2026; // Current FY
        const receiptNumber = formatReceiptNumber(fiscalYear, index + 1);
        console.log(`   🔢 Receipt number: ${receiptNumber}`);

        // Convert to PDF
        console.log(`   🔄 Converting to PDF...`);
        const pdfData = await imageToPdf(imageUint8, mimeType, {
            receiptNumber,
            creationDate: new Date(),
            title: `Receipt ${receiptNumber}`
        });

        // Save PDF
        const pdfPath = path.join(OUTPUT_DIR, `${receiptNumber}.pdf`);
        fs.writeFileSync(pdfPath, pdfData);
        console.log(`   ✅ PDF created: ${pdfData.length} bytes → ${pdfPath}`);

        // Run AI recognition
        console.log(`   🤖 Running AI recognition...`);
        const imageBase64 = uint8ArrayToBase64(imageUint8);
        const aiResult = await recognizeWithAI(imageBase64, mimeType);

        if (aiResult.error) {
            console.log(`   ⚠️  AI Error: ${aiResult.error}`);
        } else {
            console.log(`   ✅ AI Results:`);
            console.log(`      • Vendor: ${aiResult.vendor || '(not found)'}`);
            console.log(`      • Amount: $${aiResult.amount?.toFixed(2) || '0.00'}`);
            console.log(`      • Date: ${aiResult.date || '(not found)'}`);
            console.log(`      • Category: ${aiResult.category || '(not found)'}`);
            if (aiResult.gstAmount) {
                console.log(`      • GST: $${aiResult.gstAmount.toFixed(2)}`);
            }
        }

        return {
            file: fileName,
            pdfConverted: true,
            pdfSize: pdfData.length,
            receiptNumber,
            aiResult: aiResult.error ? undefined : aiResult
        };
    } catch (err) {
        console.log(`   ❌ Error: ${err instanceof Error ? err.message : String(err)}`);
        return {
            file: fileName,
            pdfConverted: false,
            error: err instanceof Error ? err.message : String(err)
        };
    }
}

async function runTests() {
    console.log('🧪 Receipt Processing Test Suite');
    console.log('================================\n');

    // Check for AI credentials
    const hasAI = !!(process.env.AZURE_FOUNDRY_ENDPOINT && process.env.AZURE_FOUNDRY_KEY);
    console.log(`AI Recognition: ${hasAI ? '✅ Enabled' : '❌ Disabled (missing credentials)'}`);

    // Get all images
    const files = fs.readdirSync(IMAGES_DIR)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map(f => path.join(IMAGES_DIR, f));

    console.log(`Found ${files.length} receipt images\n`);

    const results: TestResult[] = [];

    for (let i = 0; i < files.length; i++) {
        const result = await testReceipt(files[i], i);
        results.push(result);
    }

    // Summary
    console.log('\n================================');
    console.log('📊 Test Summary');
    console.log('================================\n');

    const pdfSuccess = results.filter(r => r.pdfConverted).length;
    const aiSuccess = results.filter(r => r.aiResult).length;

    console.log(`PDF Conversion: ${pdfSuccess}/${results.length}`);
    console.log(`AI Recognition: ${aiSuccess}/${results.length}`);

    console.log('\n📋 Results:');
    results.forEach(r => {
        const status = r.pdfConverted ? '✅' : '❌';
        const aiStatus = r.aiResult ? `$${r.aiResult.amount?.toFixed(2) || '?'} @ ${r.aiResult.vendor || '?'}` : '(no AI)';
        console.log(`${status} ${r.receiptNumber || r.file}: ${aiStatus}`);
    });

    // Save full results
    const resultsPath = path.join(OUTPUT_DIR, 'test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Full results saved to: ${resultsPath}`);
}

// Run tests
runTests().catch(console.error);
