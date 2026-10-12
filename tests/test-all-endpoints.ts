/**
 * Comprehensive API Endpoint Test Script
 * 
 * Tests all API endpoints with and without authentication.
 * 
 * Usage: 
 *   npx tsx tests/test-all-endpoints.ts
 * 
 * Prerequisites:
 *   1. Dev server running: pnpm dev (or wrangler pages dev)
 *   2. Auth tables migrated
 *   3. Test user created in database
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:8787';
const TEST_USER = {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || ''
};

interface TestResult {
    endpoint: string;
    method: string;
    description: string;
    success: boolean;
    status?: number;
    error?: string;
    response?: any;
}

const results: TestResult[] = [];

// Store session cookie after login
let sessionCookie: string | null = null;

// Color helpers for console output
const colors = {
    green: (s: string) => `\x1b[32m${s}\x1b[0m`,
    red: (s: string) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
    cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
    bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

function log(message: string) {
    console.log(message);
}

function logSection(title: string) {
    console.log('\n' + '='.repeat(60));
    console.log(colors.bold(colors.cyan(title)));
    console.log('='.repeat(60));
}

function logResult(result: TestResult) {
    const statusIcon = result.success ? colors.green('✓') : colors.red('✗');
    const statusCode = result.status ? ` [${result.status}]` : '';
    console.log(`${statusIcon} ${result.method.padEnd(6)} ${result.endpoint}${statusCode}`);
    console.log(`  ${result.description}`);
    if (result.error) {
        console.log(`  ${colors.red('Error:')} ${result.error}`);
    }
}

async function makeRequest(
    method: string,
    endpoint: string,
    options: {
        body?: any;
        authenticated?: boolean;
        contentType?: string;
        formData?: FormData;
    } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
    const url = `${BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {};

    if (options.authenticated && sessionCookie) {
        headers['Cookie'] = sessionCookie;
    }

    if (options.body && !options.formData) {
        headers['Content-Type'] = options.contentType || 'application/json';
    }

    const fetchOptions: RequestInit = {
        method,
        headers,
        credentials: 'include',
    };

    if (options.body) {
        fetchOptions.body = JSON.stringify(options.body);
    }

    if (options.formData) {
        fetchOptions.body = options.formData;
    }

    const response = await fetch(url, fetchOptions);

    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    return { status: response.status, data, headers: response.headers };
}

// ============================================
// Test: Authentication Flow
// ============================================

async function testAuth() {
    logSection('Authentication Tests');

    // Test 1: Login with invalid credentials
    try {
        const result = await makeRequest('POST', '/auth/callback/credentials', {
            body: { email: 'invalid@test.com', password: 'wrongpassword' },
            contentType: 'application/x-www-form-urlencoded'
        });

        results.push({
            endpoint: '/auth/callback/credentials',
            method: 'POST',
            description: 'Login with invalid credentials (should fail)',
            success: result.status === 401 || result.status === 302,
            status: result.status,
        });
        logResult(results[results.length - 1]);
    } catch (error: any) {
        results.push({
            endpoint: '/auth/callback/credentials',
            method: 'POST',
            description: 'Login with invalid credentials',
            success: false,
            error: error.message,
        });
        logResult(results[results.length - 1]);
    }

    // Test 2: Check session without auth (should be empty)
    try {
        const result = await makeRequest('GET', '/auth/session');

        results.push({
            endpoint: '/auth/session',
            method: 'GET',
            description: 'Get session without auth (should be empty)',
            success: result.status === 200,
            status: result.status,
            response: result.data,
        });
        logResult(results[results.length - 1]);
    } catch (error: any) {
        results.push({
            endpoint: '/auth/session',
            method: 'GET',
            description: 'Get session without auth',
            success: false,
            error: error.message,
        });
        logResult(results[results.length - 1]);
    }

    // Test 3: Login with valid credentials (using signIn form)
    try {
        // Auth.js uses form POST for credentials
        const formBody = new URLSearchParams({
            email: TEST_USER.email,
            password: TEST_USER.password,
            csrfToken: '', // Auth.js may require this
            callbackUrl: BASE_URL,
            json: 'true'
        });

        const response = await fetch(`${BASE_URL}/auth/callback/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formBody,
            redirect: 'manual',
            credentials: 'include',
        });

        // Get cookies from response
        const cookies = response.headers.getSetCookie?.() || [];
        const sessionCookies = cookies.filter(c =>
            c.includes('authjs.session-token') ||
            c.includes('next-auth.session-token') ||
            c.includes('__Secure-authjs.session-token')
        );

        if (sessionCookies.length > 0) {
            sessionCookie = sessionCookies.map(c => c.split(';')[0]).join('; ');
            log(colors.green(`  Session cookie obtained`));
        }

        results.push({
            endpoint: '/auth/callback/credentials',
            method: 'POST',
            description: 'Login with valid credentials',
            success: response.status === 200 || response.status === 302 || sessionCookies.length > 0,
            status: response.status,
        });
        logResult(results[results.length - 1]);
    } catch (error: any) {
        results.push({
            endpoint: '/auth/callback/credentials',
            method: 'POST',
            description: 'Login with valid credentials',
            success: false,
            error: error.message,
        });
        logResult(results[results.length - 1]);
    }
}

// ============================================
// Test: Unauthenticated API Access (should fail)
// ============================================

async function testUnauthenticatedAccess() {
    logSection('Unauthenticated API Access Tests (should return 401)');

    const endpoints = [
        { method: 'GET', path: '/api/receipts', desc: 'List receipts' },
        { method: 'GET', path: '/api/reports/2024', desc: 'Get fiscal year report' },
        { method: 'GET', path: '/api/storage/list', desc: 'List storage files' },
    ];

    for (const ep of endpoints) {
        try {
            const result = await makeRequest(ep.method, ep.path, { authenticated: false });

            results.push({
                endpoint: ep.path,
                method: ep.method,
                description: `${ep.desc} (unauthenticated - should be 401)`,
                success: result.status === 401,
                status: result.status,
            });
            logResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                endpoint: ep.path,
                method: ep.method,
                description: `${ep.desc} (unauthenticated)`,
                success: false,
                error: error.message,
            });
            logResult(results[results.length - 1]);
        }
    }
}

// ============================================
// Test: Authenticated API Access
// ============================================

async function testAuthenticatedAccess() {
    logSection('Authenticated API Access Tests');

    if (!sessionCookie) {
        log(colors.yellow('⚠ No session cookie - skipping authenticated tests'));
        log(colors.yellow('  Make sure a test user exists in the database'));
        return;
    }

    // Test GET /api/receipts
    try {
        const result = await makeRequest('GET', '/api/receipts', { authenticated: true });

        results.push({
            endpoint: '/api/receipts',
            method: 'GET',
            description: 'List receipts (authenticated)',
            success: result.status === 200,
            status: result.status,
            response: Array.isArray(result.data) ? `${result.data.length} receipts` : result.data,
        });
        logResult(results[results.length - 1]);
    } catch (error: any) {
        results.push({
            endpoint: '/api/receipts',
            method: 'GET',
            description: 'List receipts (authenticated)',
            success: false,
            error: error.message,
        });
        logResult(results[results.length - 1]);
    }

    // Test POST /api/receipts (create receipt)
    let createdReceiptId: string | null = null;
    try {
        const testReceipt = {
            vendor: 'Test Vendor',
            amount: 99.99,
            date: new Date().toISOString().split('T')[0],
            category: 'office',
            status: 'draft',
            notes: 'Test receipt from API test script'
        };

        const result = await makeRequest('POST', '/api/receipts', {
            authenticated: true,
            body: testReceipt
        });

        createdReceiptId = result.data?.id || result.data?.receipt?.id;

        results.push({
            endpoint: '/api/receipts',
            method: 'POST',
            description: 'Create receipt (authenticated)',
            success: result.status === 200 || result.status === 201,
            status: result.status,
            response: createdReceiptId ? `Created ID: ${createdReceiptId}` : result.data,
        });
        logResult(results[results.length - 1]);
    } catch (error: any) {
        results.push({
            endpoint: '/api/receipts',
            method: 'POST',
            description: 'Create receipt (authenticated)',
            success: false,
            error: error.message,
        });
        logResult(results[results.length - 1]);
    }

    // Test GET /api/receipts/[id]
    if (createdReceiptId) {
        try {
            const result = await makeRequest('GET', `/api/receipts/${createdReceiptId}`, {
                authenticated: true
            });

            results.push({
                endpoint: `/api/receipts/[id]`,
                method: 'GET',
                description: 'Get single receipt (authenticated)',
                success: result.status === 200,
                status: result.status,
            });
            logResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                endpoint: `/api/receipts/[id]`,
                method: 'GET',
                description: 'Get single receipt (authenticated)',
                success: false,
                error: error.message,
            });
            logResult(results[results.length - 1]);
        }

        // Test PUT /api/receipts/[id]
        try {
            const result = await makeRequest('PUT', `/api/receipts/${createdReceiptId}`, {
                authenticated: true,
                body: {
                    vendor: 'Updated Test Vendor',
                    amount: 150.00,
                    date: new Date().toISOString().split('T')[0],
                    category: 'office',
                    status: 'approved',
                    notes: 'Updated by API test'
                }
            });

            results.push({
                endpoint: `/api/receipts/[id]`,
                method: 'PUT',
                description: 'Update receipt (authenticated)',
                success: result.status === 200,
                status: result.status,
            });
            logResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                endpoint: `/api/receipts/[id]`,
                method: 'PUT',
                description: 'Update receipt (authenticated)',
                success: false,
                error: error.message,
            });
            logResult(results[results.length - 1]);
        }

        // Test DELETE /api/receipts/[id]
        try {
            const result = await makeRequest('DELETE', `/api/receipts/${createdReceiptId}`, {
                authenticated: true
            });

            results.push({
                endpoint: `/api/receipts/[id]`,
                method: 'DELETE',
                description: 'Delete receipt (authenticated)',
                success: result.status === 200 || result.status === 204,
                status: result.status,
            });
            logResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                endpoint: `/api/receipts/[id]`,
                method: 'DELETE',
                description: 'Delete receipt (authenticated)',
                success: false,
                error: error.message,
            });
            logResult(results[results.length - 1]);
        }
    }

    // Test GET /api/reports/[fy]
    try {
        const currentYear = new Date().getFullYear();
        const result = await makeRequest('GET', `/api/reports/${currentYear}`, {
            authenticated: true
        });

        results.push({
            endpoint: `/api/reports/[fy]`,
            method: 'GET',
            description: 'Get fiscal year report (authenticated)',
            success: result.status === 200,
            status: result.status,
        });
        logResult(results[results.length - 1]);
    } catch (error: any) {
        results.push({
            endpoint: `/api/reports/[fy]`,
            method: 'GET',
            description: 'Get fiscal year report (authenticated)',
            success: false,
            error: error.message,
        });
        logResult(results[results.length - 1]);
    }

    // Test GET /api/storage/list
    try {
        const result = await makeRequest('GET', '/api/storage/list', {
            authenticated: true
        });

        results.push({
            endpoint: '/api/storage/list',
            method: 'GET',
            description: 'List storage files (authenticated)',
            success: result.status === 200,
            status: result.status,
            response: Array.isArray(result.data?.files) ? `${result.data.files.length} files` : undefined,
        });
        logResult(results[results.length - 1]);
    } catch (error: any) {
        results.push({
            endpoint: '/api/storage/list',
            method: 'GET',
            description: 'List storage files (authenticated)',
            success: false,
            error: error.message,
        });
        logResult(results[results.length - 1]);
    }
}

// ============================================
// Test: Page Access
// ============================================

async function testPages() {
    logSection('Page Access Tests');

    const pages = [
        { path: '/', desc: 'Home page', expectAuth: true },
        { path: '/login', desc: 'Login page', expectAuth: false },
        { path: '/receipts', desc: 'Receipts page', expectAuth: true },
    ];

    for (const page of pages) {
        try {
            const response = await fetch(`${BASE_URL}${page.path}`, {
                redirect: 'manual',
            });

            const isRedirect = response.status === 302 || response.status === 307 || response.status === 308;
            const location = response.headers.get('location');
            const redirectsToLogin = location?.includes('/login');

            let success = false;
            let description = page.desc;

            if (page.expectAuth) {
                // Protected pages should redirect to login when not authenticated
                success = isRedirect && redirectsToLogin;
                description += ' (should redirect to login)';
            } else {
                // Public pages should be accessible
                success = response.status === 200 || (isRedirect && !redirectsToLogin);
                description += ' (public)';
            }

            results.push({
                endpoint: page.path,
                method: 'GET',
                description,
                success,
                status: response.status,
            });
            logResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                endpoint: page.path,
                method: 'GET',
                description: page.desc,
                success: false,
                error: error.message,
            });
            logResult(results[results.length - 1]);
        }
    }
}

// ============================================
// Test Summary
// ============================================

function printSummary() {
    logSection('Test Summary');

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = results.length;

    console.log(`\nTotal: ${total} tests`);
    console.log(colors.green(`Passed: ${passed}`));
    console.log(colors.red(`Failed: ${failed}`));
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
        console.log('\n' + colors.red('Failed Tests:'));
        results.filter(r => !r.success).forEach(r => {
            console.log(`  - ${r.method} ${r.endpoint}: ${r.error || `Status ${r.status}`}`);
        });
    }

    console.log('\n');
}

// ============================================
// Main
// ============================================

async function main() {
    console.log(colors.bold('\n🧪 Receipt Ledger API Test Suite\n'));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Test User: ${TEST_USER.email}`);

    try {
        // Run all tests
        await testPages();
        await testUnauthenticatedAccess();
        await testAuth();
        await testAuthenticatedAccess();

        // Print summary
        printSummary();

        // Exit with error code if any tests failed
        const failed = results.filter(r => !r.success).length;
        process.exit(failed > 0 ? 1 : 0);
    } catch (error) {
        console.error(colors.red('\n❌ Test suite failed:'), error);
        process.exit(1);
    }
}

main();
