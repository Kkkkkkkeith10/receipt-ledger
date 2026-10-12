/**
 * Test Receipt Upload Flow
 * 
 * Tests the complete flow: Image → PDF conversion → AI recognition → Save
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use localhost:5173 for dev server
const API_URL = 'http://localhost:5173/api/receipts/upload';
const IMAGES_DIR = path.join(__dirname, 'recieptImages');

interface UploadResult {
    success: boolean;
    receiptNumber?: string;
    vendor?: string;
    amount?: number;
    date?: string;
    category?: string;
    confidence?: number;
    error?: string;
}

async function uploadReceipt(imagePath: string): Promise<UploadResult> {
    const fileName = path.basename(imagePath);
    console.log(`\n📤 Uploading: ${fileName}`);

    try {
        const imageBuffer = fs.readFileSync(imagePath);
        const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append('file', blob, fileName);

        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.error || `HTTP ${response.status}`
            };
        }

        return {
            success: true,
            receiptNumber: result.id,
            vendor: result.vendor,
            amount: result.amount,
            date: result.date,
            category: result.categoryName,
            confidence: result.ocrData?.confidence
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err)
        };
    }
}

async function runTests() {
    console.log('🧪 Receipt Upload Test Suite');
    console.log('============================\n');

    // Get all images
    const files = fs.readdirSync(IMAGES_DIR)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map(f => path.join(IMAGES_DIR, f));

    console.log(`Found ${files.length} receipt images to test\n`);

    const results: UploadResult[] = [];

    for (const file of files) {
        const result = await uploadReceipt(file);
        results.push(result);

        if (result.success) {
            console.log(`   ✅ Receipt Number: ${result.receiptNumber}`);
            console.log(`   📍 Vendor: ${result.vendor || '(not detected)'}`);
            console.log(`   💰 Amount: $${result.amount?.toFixed(2) || '0.00'}`);
            console.log(`   📅 Date: ${result.date || '(not detected)'}`);
            console.log(`   📁 Category: ${result.category || '(not detected)'}`);
            if (result.confidence) {
                console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(0)}%`);
            }
        } else {
            console.log(`   ❌ Error: ${result.error}`);
        }
    }

    // Summary
    console.log('\n============================');
    console.log('📊 Test Summary');
    console.log('============================');

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Successful: ${successful}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);

    if (successful > 0) {
        const avgConfidence = results
            .filter(r => r.success && r.confidence)
            .reduce((sum, r) => sum + (r.confidence || 0), 0) / successful;

        if (avgConfidence > 0) {
            console.log(`🎯 Average Confidence: ${(avgConfidence * 100).toFixed(0)}%`);
        }

        console.log('\n📋 Created Receipts:');
        results
            .filter(r => r.success)
            .forEach(r => {
                console.log(`   • ${r.receiptNumber}: ${r.vendor || 'Unknown'} - $${r.amount?.toFixed(2) || '0.00'}`);
            });
    }
}

// Run tests
runTests().catch(console.error);
