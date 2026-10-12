/**
 * Cloudflare Remote Infrastructure Test
 * Tests uploading data and images to REAL Cloudflare D1 and R2
 *
 * Usage:
 *   1. Set CLOUDFLARE_API_TOKEN environment variable
 *   2. Start remote dev: pnpm dev:cf:remote
 *   3. Run tests: pnpm test:remote
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8787';

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    details?: any;
}

const results: TestResult[] = [];

async function getFetch(): Promise<typeof fetch> {
    const gf = (globalThis as any).fetch as typeof fetch | undefined;
    if (gf) return gf;
    const mod = await import('undici');
    return (mod as any).fetch as typeof fetch;
}

// ============================================
// D1 Database Tests
// ============================================

async function testD1CreateReceipt(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'D1 Remote - Create Receipt';
    const testReceipt = {
        vendor: `REMOTE-TEST-${Date.now()}`,
        amount: 888.88,
        date: new Date().toISOString().slice(0, 10),
        category: 'Travel',
        categoryName: 'Business Travel',
        status: 'approved',
        taxDeductible: true,
        receiptImageUrl: null,
        auditInfo: {
            businessPurpose: 'Remote Cloudflare D1 database test - verifying production connectivity',
            projectCode: 'CF-REMOTE-001',
            location: 'Cloud'
        }
    };

    try {
        const res = await fetch(`${BASE_URL}/api/receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testReceipt)
        });

        if (!res.ok) {
            return { name: testName, passed: false, error: `HTTP ${res.status}: ${await res.text()}` };
        }

        const result = await res.json();
        return {
            name: testName,
            passed: !!result.id,
            details: { createdId: result.id, vendor: testReceipt.vendor }
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

async function testD1ListReceipts(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'D1 Remote - List Receipts';

    try {
        const res = await fetch(`${BASE_URL}/api/receipts`);
        if (!res.ok) {
            return { name: testName, passed: false, error: `HTTP ${res.status}: ${await res.text()}` };
        }

        const receipts = await res.json();
        return {
            name: testName,
            passed: Array.isArray(receipts),
            details: { count: receipts.length, sample: receipts.slice(0, 2).map((r: any) => ({ id: r.id, vendor: r.vendor })) }
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

// ============================================
// R2 Storage Tests - Text Files
// ============================================

async function testR2UploadText(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'R2 Remote - Upload Text File';

    try {
        const res = await fetch(`${BASE_URL}/api/storage/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: `remote-test-${Date.now()}.txt`,
                content: `This file was uploaded to Cloudflare R2 at ${new Date().toISOString()}`,
                contentType: 'text/plain'
            })
        });

        if (!res.ok) {
            return { name: testName, passed: false, error: `HTTP ${res.status}: ${await res.text()}` };
        }

        const result = await res.json();
        return {
            name: testName,
            passed: !!result.key,
            details: result
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

// ============================================
// R2 Storage Tests - Image Upload (Base64)
// ============================================

async function testR2UploadImage(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'R2 Remote - Upload Image (PNG)';

    // 1x1 red pixel PNG (smallest valid PNG)
    const redPixelPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    try {
        const res = await fetch(`${BASE_URL}/api/storage/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: `receipt-image-${Date.now()}.png`,
                content: redPixelPngBase64,
                contentType: 'image/png',
                base64: true
            })
        });

        if (!res.ok) {
            return { name: testName, passed: false, error: `HTTP ${res.status}: ${await res.text()}` };
        }

        const result = await res.json();
        return {
            name: testName,
            passed: !!result.key,
            details: { key: result.key, url: result.url }
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

async function testR2UploadLargerImage(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'R2 Remote - Upload Larger Image (simulated receipt)';

    // Create a simple BMP-style test data (simulating an image)
    // In real usage, you'd read from a file
    const testImageData = Buffer.from('FAKE_RECEIPT_IMAGE_DATA_' + Date.now()).toString('base64');

    try {
        const res = await fetch(`${BASE_URL}/api/storage/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: `receipt-scan-${Date.now()}.jpg`,
                content: testImageData,
                contentType: 'image/jpeg',
                base64: true
            })
        });

        if (!res.ok) {
            return { name: testName, passed: false, error: `HTTP ${res.status}: ${await res.text()}` };
        }

        const result = await res.json();
        return {
            name: testName,
            passed: !!result.key,
            details: result
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

// ============================================
// R2 List and Verify
// ============================================

async function testR2ListFiles(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'R2 Remote - List All Files';

    try {
        const res = await fetch(`${BASE_URL}/api/storage/list`);
        if (!res.ok) {
            return { name: testName, passed: false, error: `HTTP ${res.status}: ${await res.text()}` };
        }

        const result = await res.json();
        const files = result.objects || [];

        return {
            name: testName,
            passed: true,
            details: {
                totalFiles: files.length,
                files: files.slice(0, 5).map((f: any) => ({
                    key: f.key,
                    size: f.size,
                    uploaded: f.uploaded
                }))
            }
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

// ============================================
// Full Receipt with Image Flow
// ============================================

async function testFullReceiptWithImage(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'Full Flow - Create Receipt with Image URL';

    try {
        // 1. Upload an "image" first
        const imageRes = await fetch(`${BASE_URL}/api/storage/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: `full-flow-receipt-${Date.now()}.png`,
                content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
                contentType: 'image/png',
                base64: true
            })
        });

        if (!imageRes.ok) {
            return { name: testName, passed: false, error: `Image upload failed: ${await imageRes.text()}` };
        }

        const imageResult = await imageRes.json();
        const imageUrl = imageResult.url;

        // 2. Create receipt with the image URL
        const receiptRes = await fetch(`${BASE_URL}/api/receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vendor: `FULL-FLOW-TEST-${Date.now()}`,
                amount: 1234.56,
                date: new Date().toISOString().slice(0, 10),
                category: 'Meals',
                categoryName: 'Business Meals',
                status: 'approved',
                taxDeductible: true,
                receiptImageUrl: imageUrl,
                auditInfo: {
                    businessPurpose: 'Full flow test - receipt with attached image stored in R2',
                    projectCode: 'FULL-FLOW-001',
                    location: 'Cloud Test',
                    businessMeal: true
                }
            })
        });

        if (!receiptRes.ok) {
            return { name: testName, passed: false, error: `Receipt creation failed: ${await receiptRes.text()}` };
        }

        const receiptResult = await receiptRes.json();

        return {
            name: testName,
            passed: !!receiptResult.id,
            details: {
                receiptId: receiptResult.id,
                imageKey: imageResult.key,
                imageUrl: imageUrl
            }
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

// ============================================
// Main Test Runner
// ============================================

async function runTests() {
    console.log('\n' + '='.repeat(70));
    console.log('🌐 CLOUDFLARE REMOTE INFRASTRUCTURE TEST');
    console.log(`   Target: ${BASE_URL}`);
    console.log('   Mode: Testing against REAL Cloudflare D1 and R2');
    console.log('='.repeat(70) + '\n');

    const fetch = await getFetch();

    // Check if server is reachable
    try {
        const healthCheck = await fetch(BASE_URL);
        console.log(`✓ Server reachable (status: ${healthCheck.status})\n`);
    } catch (err) {
        console.error('❌ Cannot reach server at', BASE_URL);
        console.error('   Make sure to run: pnpm dev:cf:remote\n');
        process.exit(1);
    }

    console.log('📦 D1 Database Tests (Remote)\n');
    results.push(await testD1CreateReceipt(fetch));
    results.push(await testD1ListReceipts(fetch));

    console.log('\n📂 R2 Storage Tests (Remote)\n');
    results.push(await testR2UploadText(fetch));
    results.push(await testR2UploadImage(fetch));
    results.push(await testR2UploadLargerImage(fetch));
    results.push(await testR2ListFiles(fetch));

    console.log('\n🔄 Full Integration Tests\n');
    results.push(await testFullReceiptWithImage(fetch));

    // Print results
    console.log('\n' + '='.repeat(70));
    console.log('📋 TEST RESULTS');
    console.log('='.repeat(70) + '\n');

    let passed = 0;
    let failed = 0;

    for (const result of results) {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.name}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
        if (result.details) {
            console.log(`   Details: ${JSON.stringify(result.details, null, 2).split('\n').join('\n   ')}`);
        }
        result.passed ? passed++ : failed++;
    }

    console.log('\n' + '-'.repeat(70));
    console.log(`Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('-'.repeat(70) + '\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
