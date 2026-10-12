/**
 * Test Script for Receipt Upload API
 * 
 * Tests the complete upload flow:
 * 1. Image → PDF conversion
 * 2. AI recognition
 * 3. R2 storage
 * 4. D1 database entry
 * 
 * Usage: npx tsx tests/test-upload.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = 'http://127.0.0.1:8787/api/receipts/upload';
const TEST_IMAGES_DIR = path.join(__dirname, 'recieptImages');

interface UploadResult {
    success: boolean;
    receiptNumber?: string;
    receipt?: {
        vendor?: string;
        amount?: number;
        date?: string;
        description?: string;
        category?: string;
    };
    aiRecognized?: boolean;
    pdfUrl?: string;
    error?: string;
}

async function testUpload(imagePath: string): Promise<UploadResult> {
    const fileName = path.basename(imagePath);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📤 Testing upload: ${fileName}`);
    console.log('='.repeat(60));

    const fileBuffer = fs.readFileSync(imagePath);

    const formData = new FormData();
    formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: 'image/jpeg'
    });

    const startTime = Date.now();

    try {
        const response = await axios.post(API_URL, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            validateStatus: () => true // Don't throw on any status
        });

        const elapsed = Date.now() - startTime;
        console.log(`⏱️  Response time: ${elapsed}ms`);
        console.log(`📊 Status: ${response.status} ${response.statusText}`);

        const result = response.data as UploadResult;

        if (response.status === 200 && result.success) {
            console.log('\n✅ UPLOAD SUCCESSFUL!');
            console.log(`   Receipt #: ${result.receiptNumber}`);
            console.log(`   AI Recognized: ${result.aiRecognized ? 'Yes' : 'No'}`);
            console.log(`   PDF URL: ${result.pdfUrl}`);

            if (result.receipt) {
                console.log('\n📋 Receipt Details:');
                console.log(`   Vendor: ${result.receipt.vendor || 'Not detected'}`);
                console.log(`   Amount: $${result.receipt.amount?.toFixed(2) || 'Not detected'}`);
                console.log(`   Date: ${result.receipt.date || 'Not detected'}`);
                console.log(`   Description: ${result.receipt.description || 'Not detected'}`);
                console.log(`   Category: ${result.receipt.category || 'Not detected'}`);
            }
        } else {
            console.log('\n❌ UPLOAD FAILED!');
            console.log(`   Error: ${result.error || 'Unknown error'}`);
        }

        return result;
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.log(`⏱️  Failed after: ${elapsed}ms`);
        console.log('\n❌ REQUEST FAILED!');
        if (axios.isAxiosError(error)) {
            console.log(`   Error: ${error.message}`);
            if (error.response) {
                console.log(`   Response: ${JSON.stringify(error.response.data)}`);
            }
        } else {
            console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return { success: false, error: String(error) };
    }
}

async function runAllTests() {
    console.log('\n🧪 RECEIPT UPLOAD TEST SUITE');
    console.log('='.repeat(60));
    console.log(`API Endpoint: ${API_URL}`);
    console.log(`Test Images: ${TEST_IMAGES_DIR}`);

    // Check if images exist
    if (!fs.existsSync(TEST_IMAGES_DIR)) {
        console.error(`\n❌ Test images directory not found: ${TEST_IMAGES_DIR}`);
        process.exit(1);
    }

    const images = fs.readdirSync(TEST_IMAGES_DIR)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map(f => path.join(TEST_IMAGES_DIR, f));

    if (images.length === 0) {
        console.error('\n❌ No test images found!');
        process.exit(1);
    }

    console.log(`Found ${images.length} test image(s)`);

    const results: { file: string; result: UploadResult }[] = [];

    for (const imagePath of images) {
        const result = await testUpload(imagePath);
        results.push({ file: path.basename(imagePath), result });

        // Wait a bit between uploads to avoid overwhelming the server
        if (images.indexOf(imagePath) < images.length - 1) {
            console.log('\n⏳ Waiting 2 seconds before next upload...');
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const successful = results.filter(r => r.result.success);
    const failed = results.filter(r => !r.result.success);

    console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);

    if (successful.length > 0) {
        console.log('\n📋 Successful Uploads:');
        for (const s of successful) {
            console.log(`   - ${s.file} → ${s.result.receiptNumber}`);
        }
    }

    if (failed.length > 0) {
        console.log('\n⚠️ Failed Uploads:');
        for (const f of failed) {
            console.log(`   - ${f.file}: ${f.result.error}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Test completed!');
    console.log('='.repeat(60) + '\n');
}

// Run tests
runAllTests().catch(console.error);
