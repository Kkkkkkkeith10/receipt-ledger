# AI Receipt Recognition Testing Plan

## Overview

Test the AI receipt recognition system using 6 sample Australian PDF invoices to validate:
1. Azure OpenAI connection and vision capabilities
2. Data extraction accuracy (vendor, amount, date, GST, ABN)
3. Category classification
4. Error handling and edge cases

---

## Test Invoices

| # | File | Vendor | Total | GST | Category |
|---|------|--------|-------|-----|----------|
| 1 | officeworks-supplies.pdf | Officeworks | $103.25 | $9.39 | office_supplies |
| 2 | bunnings-materials.pdf | Bunnings Warehouse | $281.45 | $25.59 | project_materials |
| 3 | caltex-fuel.pdf | Caltex Star Mart | $121.03 | $11.00 | fuel_vehicle |
| 4 | thai-restaurant-lunch.pdf | Thai Garden Restaurant | $111.50 | $10.14 | food_beverage |
| 5 | aws-subscription.pdf | Amazon Web Services | $66.40 | $6.04 | subscriptions |
| 6 | qantas-flight.pdf | Qantas Airways | $280.00 | $25.45 | travel |

Expected values stored in: `tests/fixtures/invoice-manifest.json`

---

## Phase 1: Connection Test

**Goal:** Verify Azure OpenAI credentials and vision capability work.

### Test 1.1: Basic Connection
```bash
pnpm test:ai:connection
```
- [ ] API key is valid
- [ ] Endpoint is reachable
- [ ] Model deployment exists
- [ ] Basic chat completion works

### Test 1.2: Vision Capability
- [ ] Model accepts image input
- [ ] Model returns text description of image
- [ ] No "vision not supported" errors

**Pass Criteria:** All connection tests pass without errors.

---

## Phase 2: Single Invoice Tests

**Goal:** Test each invoice individually to establish baseline accuracy.

### Test 2.1: Run Each Invoice Through API

For each PDF in `tests/fixtures/`:

1. Convert PDF to image (or use PDF directly if supported)
2. Send to `/api/receipts/recognize` endpoint
3. Compare extracted data against manifest

### Expected Extraction Fields

| Field | Required | Validation |
|-------|----------|------------|
| vendor | ✅ | Exact or close match |
| amount | ✅ | Within $0.01 |
| date | ✅ | Exact match (YYYY-MM-DD) |
| gstAmount | ✅ | Within $0.10 |
| category | ✅ | Exact match from list |
| abn | ⚠️ | If visible, extract correctly |
| confidence | ✅ | > 0.7 for clear invoices |

### Test Cases

#### Test 2.1.1: Officeworks (Office Supplies)
- Input: `officeworks-supplies.pdf`
- Expected:
  - vendor: "Officeworks"
  - amount: 103.25
  - date: "2025-01-03"
  - gstAmount: 9.39
  - category: "office_supplies"
  - abn: "36004763526"

#### Test 2.1.2: Bunnings (Project Materials)
- Input: `bunnings-materials.pdf`
- Expected:
  - vendor: "Bunnings Warehouse"
  - amount: 281.45
  - date: "2025-01-05"
  - gstAmount: 25.59
  - category: "project_materials"
  - abn: "18004278352"

#### Test 2.1.3: Caltex (Fuel)
- Input: `caltex-fuel.pdf`
- Expected:
  - vendor: "Caltex Star Mart"
  - amount: 121.03
  - date: "2025-01-06"
  - gstAmount: 11.00
  - category: "fuel_vehicle"
  - abn: "73004085616"

#### Test 2.1.4: Thai Garden (Food)
- Input: `thai-restaurant-lunch.pdf`
- Expected:
  - vendor: "Thai Garden Restaurant"
  - amount: 111.50
  - date: "2025-01-07"
  - gstAmount: 10.14
  - category: "food_beverage"
  - abn: "45123456789"

#### Test 2.1.5: AWS (Subscription)
- Input: `aws-subscription.pdf`
- Expected:
  - vendor: "Amazon Web Services"
  - amount: 66.40
  - date: "2025-01-01"
  - gstAmount: 6.04
  - category: "subscriptions"
  - abn: "64600643094"

#### Test 2.1.6: Qantas (Travel)
- Input: `qantas-flight.pdf`
- Expected:
  - vendor: "Qantas Airways"
  - amount: 280.00
  - date: "2024-12-28"
  - gstAmount: 25.45
  - category: "travel"
  - abn: "16009661901"

**Pass Criteria:** 5/6 invoices extract correctly with >80% field accuracy.

---

## Phase 3: Accuracy Metrics

### Scoring System

| Metric | Weight | Description |
|--------|--------|-------------|
| Vendor Match | 15% | Fuzzy match score (Levenshtein) |
| Amount Accuracy | 25% | Exact to 2 decimal places |
| Date Accuracy | 20% | Exact match |
| GST Accuracy | 15% | Within 10% tolerance |
| Category Match | 15% | Exact match |
| ABN Extraction | 10% | Correct 11-digit number |

### Accuracy Thresholds

| Level | Score | Action |
|-------|-------|--------|
| 🟢 Excellent | > 90% | Ready for production |
| 🟡 Good | 70-90% | Minor prompt tuning needed |
| 🟠 Fair | 50-70% | Significant prompt changes |
| 🔴 Poor | < 50% | Review AI configuration |

---

## Phase 4: Edge Case Tests

### Test 4.1: Image Quality
- [ ] Low resolution image
- [ ] Skewed/rotated image
- [ ] Partial image (cropped)
- [ ] Photo of printed receipt (not PDF)

### Test 4.2: Format Variations
- [ ] Handwritten receipt
- [ ] Foreign currency (should default AUD)
- [ ] No GST shown (calculate from total)
- [ ] Multiple pages

### Test 4.3: Error Handling
- [ ] Empty file
- [ ] Corrupted image
- [ ] Non-receipt image (e.g., photo of cat)
- [ ] Very large file (>10MB)
- [ ] Unsupported format (.bmp, .tiff)

**Pass Criteria:** System handles errors gracefully without crashing.

---

## Phase 5: Performance Tests

### Test 5.1: Response Time
- Target: < 5 seconds per receipt
- Measure: Average across 6 test invoices

### Test 5.2: Rate Limiting
- Test: 10 rapid requests
- Expected: Graceful handling, no 429 errors

### Test 5.3: Concurrent Requests
- Test: 3 simultaneous uploads
- Expected: All complete successfully

---

## Test Execution Commands

```bash
# 1. Run connection test first
pnpm test:ai:connection

# 2. Run full AI test suite
pnpm test:ai

# 3. Run specific invoice test
npx tsx tests/test-single-invoice.ts officeworks-supplies.pdf

# 4. Run all invoices with report
npx tsx tests/test-all-invoices.ts --report
```

---

## Test Results Template

### Run Date: ____________

| Invoice | Vendor | Amount | Date | GST | Category | ABN | Score |
|---------|--------|--------|------|-----|----------|-----|-------|
| officeworks | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | _/6 |
| bunnings | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | _/6 |
| caltex | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | _/6 |
| thai | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | _/6 |
| aws | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | _/6 |
| qantas | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | _/6 |

**Overall Score:** ___/36 (___%)

### Issues Found:
1. 
2. 
3. 

### Prompt Adjustments Needed:
1. 
2. 

---

## Next Steps After Testing

1. **If Pass:** Deploy to staging environment
2. **If Fail:** 
   - Review AI prompt in `src/lib/server/ai.ts`
   - Check model capabilities (gpt-4o vs gpt-4-vision)
   - Consider adding few-shot examples to prompt
   - Test with real receipts from user
