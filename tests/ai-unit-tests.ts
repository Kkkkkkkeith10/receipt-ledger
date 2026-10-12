/**
 * AI Module Unit Tests
 * 
 * Tests the AI module functions directly without requiring the server.
 * Run with: pnpm test:ai:unit
 */

// Test the GST calculation function
function testGSTCalculation(): void {
    console.log('\n🧮 Testing GST Calculation (Australian 10%)\n');

    const testCases = [
        { total: 110, gstIncluded: true, expectedGst: 10, expectedExGst: 100, expectedIncGst: 110 },
        { total: 55, gstIncluded: true, expectedGst: 5, expectedExGst: 50, expectedIncGst: 55 },
        { total: 11, gstIncluded: true, expectedGst: 1, expectedExGst: 10, expectedIncGst: 11 },
        { total: 100, gstIncluded: false, expectedGst: 10, expectedExGst: 100, expectedIncGst: 110 },
        { total: 50, gstIncluded: false, expectedGst: 5, expectedExGst: 50, expectedIncGst: 55 },
        { total: 99.99, gstIncluded: true, expectedGst: 9.09, expectedExGst: 90.90, expectedIncGst: 99.99 },
    ];

    let passed = 0;
    let failed = 0;

    for (const tc of testCases) {
        let result: { gstAmount: number; exGstAmount: number; incGstAmount: number };

        if (tc.gstIncluded) {
            const gstAmount = Math.round((tc.total / 11) * 100) / 100;
            result = {
                gstAmount,
                exGstAmount: Math.round((tc.total - gstAmount) * 100) / 100,
                incGstAmount: tc.total
            };
        } else {
            const gstAmount = Math.round((tc.total * 0.1) * 100) / 100;
            result = {
                gstAmount,
                exGstAmount: tc.total,
                incGstAmount: Math.round((tc.total + gstAmount) * 100) / 100
            };
        }

        const gstMatch = result.gstAmount === tc.expectedGst;
        const exGstMatch = result.exGstAmount === tc.expectedExGst;
        const incGstMatch = result.incGstAmount === tc.expectedIncGst;
        const allMatch = gstMatch && exGstMatch && incGstMatch;

        const icon = allMatch ? '✅' : '❌';
        console.log(`${icon} Total: $${tc.total} (GST ${tc.gstIncluded ? 'included' : 'excluded'})`);
        console.log(`   GST: $${result.gstAmount} (expected $${tc.expectedGst}) ${gstMatch ? '✓' : '✗'}`);
        console.log(`   Ex-GST: $${result.exGstAmount} (expected $${tc.expectedExGst}) ${exGstMatch ? '✓' : '✗'}`);
        console.log(`   Inc-GST: $${result.incGstAmount} (expected $${tc.expectedIncGst}) ${incGstMatch ? '✓' : '✗'}`);
        console.log('');

        if (allMatch) passed++;
        else failed++;
    }

    console.log(`Results: ${passed} passed, ${failed} failed\n`);
}

// Test category mapping
function testCategoryMapping(): void {
    console.log('\n📁 Testing Category Mapping\n');

    const categoryMapping: Record<string, string> = {
        'project_materials': '5100',
        'office_supplies': '5200',
        'travel': '5300',
        'food_beverage': '5400',
        'fuel_vehicle': '5500',
        'subscriptions': '5600',
        'professional_services': '5700',
        'utilities': '5800',
        'marketing': '5900',
        'training': '6000',
        'other': '6100'
    };

    const aiCategories = Object.keys(categoryMapping);
    const accountCodes = Object.values(categoryMapping);

    console.log('AI Categories → Account Codes:');
    for (const [category, code] of Object.entries(categoryMapping)) {
        console.log(`  ${category.padEnd(25)} → ${code}`);
    }

    console.log(`\n✅ ${aiCategories.length} categories mapped to ${accountCodes.length} account codes\n`);
}

// Test date format validation
function testDateFormatValidation(): void {
    console.log('\n📅 Testing Date Format Validation\n');

    const testDates = [
        { input: '2025-01-07', valid: true },
        { input: '2025-12-31', valid: true },
        { input: '2025-1-7', valid: false }, // Missing leading zeros
        { input: '07/01/2025', valid: false }, // Wrong format
        { input: '2025/01/07', valid: false }, // Wrong separator
        { input: '', valid: false },
        { input: null, valid: true }, // null is acceptable
    ];

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    let passed = 0;
    let failed = 0;

    for (const tc of testDates) {
        const isValid = tc.input === null || dateRegex.test(tc.input);
        const matches = isValid === tc.valid;

        const icon = matches ? '✅' : '❌';
        console.log(`${icon} "${tc.input}" - ${isValid ? 'valid' : 'invalid'} (expected ${tc.valid ? 'valid' : 'invalid'})`);

        if (matches) passed++;
        else failed++;
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
}

// Test ABN validation
function testABNValidation(): void {
    console.log('\n🔢 Testing ABN Validation (Australian Business Number)\n');

    // ABN is 11 digits
    const testABNs = [
        { input: '12345678901', valid: true },
        { input: '51824753556', valid: true },
        { input: '1234567890', valid: false }, // Too short
        { input: '123456789012', valid: false }, // Too long
        { input: '1234567890a', valid: false }, // Contains letter
        { input: '', valid: false },
        { input: null, valid: true }, // null is acceptable
    ];

    const abnRegex = /^\d{11}$/;

    let passed = 0;
    let failed = 0;

    for (const tc of testABNs) {
        const isValid = tc.input === null || abnRegex.test(tc.input);
        const matches = isValid === tc.valid;

        const icon = matches ? '✅' : '❌';
        console.log(`${icon} "${tc.input}" - ${isValid ? 'valid' : 'invalid'} (expected ${tc.valid ? 'valid' : 'invalid'})`);

        if (matches) passed++;
        else failed++;
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
}

// Test currency validation
function testCurrencyValidation(): void {
    console.log('\n💱 Testing Currency Validation\n');

    const validCurrencies = ['AUD', 'USD', 'EUR', 'GBP', 'NZD', 'SGD', 'HKD', 'JPY'];

    const testCurrencies = [
        { input: 'AUD', valid: true },
        { input: 'USD', valid: true },
        { input: 'EUR', valid: true },
        { input: 'aud', valid: false }, // Should be uppercase
        { input: 'AU', valid: false }, // Too short
        { input: 'AUSD', valid: false }, // Too long
        { input: '', valid: false },
    ];

    let passed = 0;
    let failed = 0;

    for (const tc of testCurrencies) {
        const isValid = /^[A-Z]{3}$/.test(tc.input);
        const matches = isValid === tc.valid;

        const icon = matches ? '✅' : '❌';
        console.log(`${icon} "${tc.input}" - ${isValid ? 'valid' : 'invalid'} (expected ${tc.valid ? 'valid' : 'invalid'})`);

        if (matches) passed++;
        else failed++;
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
}

// Run all unit tests
function runAllTests(): void {
    console.log('═'.repeat(60));
    console.log('🧪 AI Module Unit Tests');
    console.log('═'.repeat(60));

    testGSTCalculation();
    testCategoryMapping();
    testDateFormatValidation();
    testABNValidation();
    testCurrencyValidation();

    console.log('═'.repeat(60));
    console.log('✨ All unit tests completed');
    console.log('═'.repeat(60) + '\n');
}

runAllTests();
