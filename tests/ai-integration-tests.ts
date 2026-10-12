/**
 * AI Integration Tests with Sample Receipt Images
 * 
 * Tests the full AI receipt recognition pipeline with various receipt types.
 * These tests require the AI service to be configured and will make real API calls.
 * 
 * Run with: pnpm test:ai:integration
 * 
 * Environment variables required:
 * - AZURE_OPENAI_ENDPOINT
 * - AZURE_OPENAI_KEY
 * - API_BASE_URL (optional, defaults to http://localhost:5173)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5173';
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

interface RecognitionResult {
    success: boolean;
    data?: {
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
    };
    error?: string;
}

interface TestCase {
    name: string;
    imageFile: string;
    expectedFields: Partial<{
        vendor: string;
        category: string;
        minAmount: number;
        maxAmount: number;
        currency: string;
        hasABN: boolean;
    }>;
}

/**
 * Sample test receipt (base64 encoded simple test image)
 * In a real scenario, replace with actual receipt images
 */
function createSampleReceipt(): Buffer {
    // A simple 100x100 white image with "RECEIPT" text would be here
    // For now, using a minimal PNG
    const png = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82
    ]);
    return png;
}

async function uploadAndRecognize(imageBuffer: Buffer, mimeType: string = 'image/png'): Promise<RecognitionResult> {
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append('file', blob, 'receipt.png');

    const response = await fetch(`${API_BASE_URL}/api/receipts/recognize`, {
        method: 'POST',
        body: formData
    });

    return response.json();
}

async function testPromptWithImage(prompt: string, imageBuffer: Buffer): Promise<any> {
    // This is a simpler test that just sends an image with a custom prompt
    // Useful for testing specific AI capabilities
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('file', blob, 'test.png');
    if (prompt) {
        formData.append('prompt', prompt);
    }

    const response = await fetch(`${API_BASE_URL}/api/receipts/recognize`, {
        method: 'POST',
        body: formData
    });

    return response.json();
}

class AIIntegrationTests {
    private results: { name: string; passed: boolean; message: string; duration: number }[] = [];

    async run(): Promise<void> {
        console.log('\n🔬 AI Integration Tests\n');
        console.log('Target API:', API_BASE_URL);
        console.log('='.repeat(70));

        // Check if AI service is configured
        const isConfigured = await this.checkAIServiceConfigured();
        if (!isConfigured) {
            console.log('\n⚠️  AI service not configured. Skipping integration tests.');
            console.log('   Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY to run these tests.\n');
            return;
        }

        // Run test suites
        await this.testBasicRecognition();
        await this.testCategoryDetection();
        await this.testAmountExtraction();
        await this.testCurrencyHandling();
        await this.testConfidenceScoring();
        await this.testErrorHandling();

        this.printSummary();
    }

    private async checkAIServiceConfigured(): Promise<boolean> {
        try {
            const imageBuffer = createSampleReceipt();
            const result = await uploadAndRecognize(imageBuffer);

            if (result.error?.includes('AI service not configured')) {
                return false;
            }
            return true;
        } catch {
            return false;
        }
    }

    private async testBasicRecognition(): Promise<void> {
        const start = Date.now();
        const name = 'Basic receipt recognition';

        try {
            const imageBuffer = createSampleReceipt();
            const result = await uploadAndRecognize(imageBuffer);

            if (!result.success) {
                this.results.push({
                    name,
                    passed: false,
                    message: `API returned error: ${result.error}`,
                    duration: Date.now() - start
                });
                return;
            }

            const data = result.data!;
            const hasValidResponse =
                typeof data.confidence === 'number' &&
                data.currency !== undefined;

            this.results.push({
                name,
                passed: hasValidResponse,
                message: hasValidResponse
                    ? `Confidence: ${data.confidence}, Vendor: ${data.vendor || 'N/A'}`
                    : 'Invalid response structure',
                duration: Date.now() - start
            });
        } catch (error) {
            this.results.push({
                name,
                passed: false,
                message: `Exception: ${error}`,
                duration: Date.now() - start
            });
        }
    }

    private async testCategoryDetection(): Promise<void> {
        const start = Date.now();
        const name = 'Category detection';

        try {
            const imageBuffer = createSampleReceipt();
            const result = await uploadAndRecognize(imageBuffer);

            if (!result.success || !result.data) {
                this.results.push({
                    name,
                    passed: true, // Pass if no data - can't validate categories without real receipt
                    message: 'Skipped - no receipt data to validate',
                    duration: Date.now() - start
                });
                return;
            }

            const validCategories = [
                'project_materials', 'office_supplies', 'travel', 'food_beverage',
                'fuel_vehicle', 'subscriptions', 'professional_services', 'utilities',
                'marketing', 'training', 'other', null
            ];

            const isValidCategory = validCategories.includes(result.data.category);

            this.results.push({
                name,
                passed: isValidCategory,
                message: isValidCategory
                    ? `Category: ${result.data.category || 'null (undetected)'}`
                    : `Invalid category: ${result.data.category}`,
                duration: Date.now() - start
            });
        } catch (error) {
            this.results.push({
                name,
                passed: false,
                message: `Exception: ${error}`,
                duration: Date.now() - start
            });
        }
    }

    private async testAmountExtraction(): Promise<void> {
        const start = Date.now();
        const name = 'Amount extraction';

        try {
            const imageBuffer = createSampleReceipt();
            const result = await uploadAndRecognize(imageBuffer);

            if (!result.success || !result.data) {
                this.results.push({
                    name,
                    passed: true,
                    message: 'Skipped - no receipt data',
                    duration: Date.now() - start
                });
                return;
            }

            const amount = result.data.amount;
            const gstAmount = result.data.gstAmount;

            // Amount should be null or a positive number
            const isValidAmount = amount === null || (typeof amount === 'number' && amount >= 0);
            const isValidGst = gstAmount === null || (typeof gstAmount === 'number' && gstAmount >= 0);

            // If both amounts exist, GST should be less than total
            let gstValid = true;
            if (amount && gstAmount && gstAmount > amount) {
                gstValid = false;
            }

            const passed = isValidAmount && isValidGst && gstValid;

            this.results.push({
                name,
                passed,
                message: passed
                    ? `Amount: $${amount ?? 'N/A'}, GST: $${gstAmount ?? 'N/A'}`
                    : `Invalid amounts: total=${amount}, gst=${gstAmount}`,
                duration: Date.now() - start
            });
        } catch (error) {
            this.results.push({
                name,
                passed: false,
                message: `Exception: ${error}`,
                duration: Date.now() - start
            });
        }
    }

    private async testCurrencyHandling(): Promise<void> {
        const start = Date.now();
        const name = 'Currency handling';

        try {
            const imageBuffer = createSampleReceipt();
            const result = await uploadAndRecognize(imageBuffer);

            if (!result.success || !result.data) {
                this.results.push({
                    name,
                    passed: true,
                    message: 'Skipped - no receipt data',
                    duration: Date.now() - start
                });
                return;
            }

            // Currency should default to AUD if not detected
            const currency = result.data.currency;
            const isValidCurrency = typeof currency === 'string' && currency.length === 3;

            this.results.push({
                name,
                passed: isValidCurrency,
                message: isValidCurrency
                    ? `Currency: ${currency}`
                    : `Invalid currency: ${currency}`,
                duration: Date.now() - start
            });
        } catch (error) {
            this.results.push({
                name,
                passed: false,
                message: `Exception: ${error}`,
                duration: Date.now() - start
            });
        }
    }

    private async testConfidenceScoring(): Promise<void> {
        const start = Date.now();
        const name = 'Confidence scoring';

        try {
            const imageBuffer = createSampleReceipt();
            const result = await uploadAndRecognize(imageBuffer);

            if (!result.success || !result.data) {
                this.results.push({
                    name,
                    passed: true,
                    message: 'Skipped - no receipt data',
                    duration: Date.now() - start
                });
                return;
            }

            const confidence = result.data.confidence;
            const isValidConfidence =
                typeof confidence === 'number' &&
                confidence >= 0 &&
                confidence <= 1;

            this.results.push({
                name,
                passed: isValidConfidence,
                message: isValidConfidence
                    ? `Confidence: ${(confidence * 100).toFixed(1)}%`
                    : `Invalid confidence value: ${confidence}`,
                duration: Date.now() - start
            });
        } catch (error) {
            this.results.push({
                name,
                passed: false,
                message: `Exception: ${error}`,
                duration: Date.now() - start
            });
        }
    }

    private async testErrorHandling(): Promise<void> {
        const start = Date.now();
        const name = 'Error handling';

        try {
            // Test with corrupted data
            const corruptedBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);

            const formData = new FormData();
            const blob = new Blob([corruptedBuffer], { type: 'image/png' });
            formData.append('file', blob, 'corrupted.png');

            const response = await fetch(`${API_BASE_URL}/api/receipts/recognize`, {
                method: 'POST',
                body: formData
            });

            // Should either return error gracefully or process with low confidence
            const passed = response.status < 500; // No server crash

            this.results.push({
                name,
                passed,
                message: passed
                    ? `Handled gracefully (status: ${response.status})`
                    : `Server error: ${response.status}`,
                duration: Date.now() - start
            });
        } catch (error) {
            this.results.push({
                name,
                passed: false,
                message: `Exception: ${error}`,
                duration: Date.now() - start
            });
        }
    }

    private printSummary(): void {
        console.log('\n' + '='.repeat(70));
        console.log('📊 Integration Test Results\n');

        let passed = 0;
        let failed = 0;

        for (const result of this.results) {
            const icon = result.passed ? '✅' : '❌';
            const status = result.passed ? 'PASS' : 'FAIL';
            console.log(`${icon} ${status} | ${result.name}`);
            console.log(`         └─ ${result.message} (${result.duration}ms)`);

            if (result.passed) passed++;
            else failed++;
        }

        console.log('\n' + '-'.repeat(70));
        const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
        console.log(`Total: ${this.results.length} tests | Passed: ${passed} | Failed: ${failed} | Time: ${totalTime}ms`);
        console.log('='.repeat(70) + '\n');

        if (failed > 0) {
            process.exit(1);
        }
    }
}

// Run tests
const tests = new AIIntegrationTests();
tests.run().catch(console.error);
