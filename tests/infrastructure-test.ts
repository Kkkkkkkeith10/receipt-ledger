/**
 * Infrastructure Test Script
 * Tests D1 Database (via Drizzle ORM) and R2 Bucket connectivity
 *
 * Usage:
 *   1. Start wrangler dev first: pnpm dev:cf
 *   2. Run tests: pnpm test:infra
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
    try {
        const mod = await import('undici');
        return (mod as any).fetch as typeof fetch;
    } catch {
        throw new Error('No fetch available. Please run on Node >=18 or install undici.');
    }
}

// ============================================
// D1 / Drizzle ORM Tests
// ============================================

async function testD1Connection(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'D1 Connection - GET /api/receipts';
    try {
        const res = await fetch(`${BASE_URL}/api/receipts`);
        if (!res.ok) {
            return { name: testName, passed: false, error: `HTTP ${res.status}: ${await res.text()}` };
        }
        const data = await res.json();
        return {
            name: testName,
            passed: true,
            details: { receiptCount: Array.isArray(data) ? data.length : 'N/A' }
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

async function testD1CreateReceipt(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'D1 Create - POST /api/receipts';
    const testReceipt = {
        vendor: `TEST-VENDOR-${Date.now()}`,
        amount: 99.99,
        date: new Date().toISOString().slice(0, 10),
        category: 'Office',
        categoryName: 'Office Supplies',
        status: 'approved',
        taxDeductible: true,
        receiptImageUrl: null,
        auditInfo: {
            businessPurpose: 'Infrastructure test - testing D1 database write operations',
            projectCode: 'TEST-001',
            location: 'Test Location'
        }
    };

    try {
        const res = await fetch(`${BASE_URL}/api/receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testReceipt)
        });

        if (!res.ok) {
            const errText = await res.text();
            return { name: testName, passed: false, error: `HTTP ${res.status}: ${errText}` };
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

async function testD1ReadAfterWrite(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'D1 Read After Write - Verify persistence';
    const uniqueVendor = `PERSIST-TEST-${Date.now()}`;

    try {
        // Create
        const createRes = await fetch(`${BASE_URL}/api/receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vendor: uniqueVendor,
                amount: 123.45,
                date: new Date().toISOString().slice(0, 10),
                category: 'Travel',
                categoryName: 'Travel & Transportation',
                status: 'pending',
                taxDeductible: false,
                auditInfo: {
                    businessPurpose: 'Testing read-after-write consistency in D1'
                }
            })
        });

        if (!createRes.ok) {
            return { name: testName, passed: false, error: `Create failed: ${await createRes.text()}` };
        }

        // Read back
        const readRes = await fetch(`${BASE_URL}/api/receipts`);
        if (!readRes.ok) {
            return { name: testName, passed: false, error: `Read failed: ${await readRes.text()}` };
        }

        const receipts = await readRes.json();
        const found = receipts.find((r: any) => r.vendor === uniqueVendor);

        return {
            name: testName,
            passed: !!found,
            details: found ? { id: found.id, amount: found.amount } : { error: 'Receipt not found after write' }
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

async function testD1GeneratedColumns(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'D1 Generated Columns - Verify JSON extraction';
    const testVendor = `GEN-COL-TEST-${Date.now()}`;
    const testAmount = 456.78;
    const testDate = '2024-12-25';
    const testCategory = 'Office';

    try {
        // Create receipt with specific values
        const createRes = await fetch(`${BASE_URL}/api/receipts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vendor: testVendor,
                amount: testAmount,
                date: testDate,
                category: testCategory,
                categoryName: 'Office Supplies',
                status: 'approved',
                taxDeductible: true,
                auditInfo: {
                    businessPurpose: 'Testing generated columns in SQLite with JSON extraction'
                }
            })
        });

        if (!createRes.ok) {
            return { name: testName, passed: false, error: `Create failed: ${await createRes.text()}` };
        }

        // Read and verify the generated columns match the JSON data
        const readRes = await fetch(`${BASE_URL}/api/receipts`);
        if (!readRes.ok) {
            return { name: testName, passed: false, error: `Read failed: ${await readRes.text()}` };
        }

        const receipts = await readRes.json();
        const found = receipts.find((r: any) => r.vendor === testVendor);

        if (!found) {
            return { name: testName, passed: false, error: 'Receipt not found' };
        }

        // Validate generated columns match expected values
        const checks = {
            vendor: found.vendor === testVendor,
            amount: found.amount === testAmount,
            date: found.date === testDate,
            category: found.category === testCategory,
            taxDeductible: found.taxDeductible === true
        };

        const allPassed = Object.values(checks).every(Boolean);

        return {
            name: testName,
            passed: allPassed,
            details: {
                expected: { vendor: testVendor, amount: testAmount, date: testDate, category: testCategory },
                actual: { vendor: found.vendor, amount: found.amount, date: found.date, category: found.category },
                checks
            }
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

// ============================================
// R2 Bucket Tests
// ============================================

async function testR2Upload(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'R2 Upload - POST /api/storage/upload';

    try {
        const res = await fetch(`${BASE_URL}/api/storage/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: `test-${Date.now()}.txt`,
                content: 'Hello from infrastructure test!',
                contentType: 'text/plain'
            })
        });

        if (res.status === 404) {
            return { name: testName, passed: false, error: 'Endpoint not implemented (404)' };
        }

        if (!res.ok) {
            return { name: testName, passed: false, error: `HTTP ${res.status}: ${await res.text()}` };
        }

        const result = await res.json();
        return {
            name: testName,
            passed: !!result.key || !!result.url,
            details: result
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

async function testR2List(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'R2 List - GET /api/storage/list';

    try {
        const res = await fetch(`${BASE_URL}/api/storage/list`);

        if (res.status === 404) {
            return { name: testName, passed: false, error: 'Endpoint not implemented (404)' };
        }

        if (!res.ok) {
            return { name: testName, passed: false, error: `HTTP ${res.status}: ${await res.text()}` };
        }

        const result = await res.json();
        return {
            name: testName,
            passed: true,
            details: { objectCount: Array.isArray(result.objects) ? result.objects.length : 'N/A' }
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

async function testR2ReadAndDelete(fetch: typeof globalThis.fetch): Promise<TestResult> {
    const testName = 'R2 Full Cycle - Upload, Read, Delete';
    const testContent = `Test content created at ${new Date().toISOString()}`;
    const filename = `cycle-test-${Date.now()}.txt`;

    try {
        // 1. Upload
        const uploadRes = await fetch(`${BASE_URL}/api/storage/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename,
                content: testContent,
                contentType: 'text/plain'
            })
        });

        if (!uploadRes.ok) {
            return { name: testName, passed: false, error: `Upload failed: ${await uploadRes.text()}` };
        }

        const uploadResult = await uploadRes.json();
        const key = uploadResult.key;

        // 2. Read back
        const readRes = await fetch(`${BASE_URL}/api/storage/file/${encodeURIComponent(key)}`);
        if (!readRes.ok) {
            return { name: testName, passed: false, error: `Read failed: ${await readRes.text()}` };
        }

        const readContent = await readRes.text();
        if (readContent !== testContent) {
            return {
                name: testName,
                passed: false,
                error: `Content mismatch. Expected: "${testContent}", Got: "${readContent}"`
            };
        }

        // 3. Delete
        const deleteRes = await fetch(`${BASE_URL}/api/storage/file/${encodeURIComponent(key)}`, {
            method: 'DELETE'
        });

        if (!deleteRes.ok) {
            return { name: testName, passed: false, error: `Delete failed: ${await deleteRes.text()}` };
        }

        // 4. Verify deletion (should return 404)
        const verifyRes = await fetch(`${BASE_URL}/api/storage/file/${encodeURIComponent(key)}`);
        if (verifyRes.status !== 404) {
            return {
                name: testName,
                passed: false,
                error: `File still exists after delete (status: ${verifyRes.status})`
            };
        }

        return {
            name: testName,
            passed: true,
            details: { uploadedKey: key, contentMatched: true, deleted: true }
        };
    } catch (err: any) {
        return { name: testName, passed: false, error: err.message };
    }
}

// ============================================
// Main Test Runner
// ============================================

async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 INFRASTRUCTURE TEST SUITE');
    console.log(`   Target: ${BASE_URL}`);
    console.log('='.repeat(60) + '\n');

    const fetch = await getFetch();

    // Check if server is reachable
    try {
        await fetch(BASE_URL, { method: 'HEAD' });
    } catch {
        console.error('❌ Cannot reach server at', BASE_URL);
        console.error('   Make sure to run: pnpm dev:cf\n');
        process.exit(1);
    }

    console.log('📦 D1 Database / Drizzle ORM Tests\n');

    results.push(await testD1Connection(fetch));
    results.push(await testD1CreateReceipt(fetch));
    results.push(await testD1ReadAfterWrite(fetch));
    results.push(await testD1GeneratedColumns(fetch));

    console.log('\n📂 R2 Bucket Tests\n');

    results.push(await testR2Upload(fetch));
    results.push(await testR2List(fetch));
    results.push(await testR2ReadAndDelete(fetch));

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST RESULTS');
    console.log('='.repeat(60) + '\n');

    let passed = 0;
    let failed = 0;

    for (const result of results) {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.name}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
        if (result.details) {
            console.log(`   Details: ${JSON.stringify(result.details)}`);
        }
        result.passed ? passed++ : failed++;
    }

    console.log('\n' + '-'.repeat(60));
    console.log(`Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('-'.repeat(60) + '\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
