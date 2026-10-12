# Hong Kong Unlimited Company Compliance Guide

## Overview
This document outlines Hong Kong tax and accounting compliance requirements for unlimited companies (sole proprietorships and partnerships) and how this application supports these requirements.

---

## 1. Hong Kong Tax Requirements

### 1.1 Profits Tax
- **Rate Structure**: Two-tiered profits tax rates
  - First HK$2,000,000: 7.5% (unincorporated businesses) or 8.25% (corporations)
  - Above HK$2,000,000: 15% (unincorporated businesses) or 16.5% (corporations)
- **Tax Year**: April 1 to March 31
- **Filing Deadline**: Typically 1 month from date of tax return issue (can be extended)

**✅ Application Support:**
- Tracks revenue and expenses by financial year
- Categorizes expenses with tax deductibility flags
- Provides reports for tax return preparation

### 1.2 Business Registration
- **Requirement**: All businesses must register with Inland Revenue Department (IRD)
- **Business Registration Certificate**: Must be renewed annually
- **Branch Registration**: Required for each business location

**✅ Application Support:**
- Settings page for storing business registration details
- Ability to track multiple business locations

---

## 2. Record Keeping Requirements

### 2.1 Legal Requirements (IRD)
According to IRD guidelines, businesses must maintain:

1. **Minimum Retention Period**: 7 years from completion of transactions
2. **Required Records**:
   - All business receipts and invoices
   - Bank statements and records
   - Sales records
   - Purchase records
   - Expense vouchers
   - Employment records (if applicable)
   - Asset registers

**✅ Application Support:**
- Receipt storage in Cloudflare R2 with 7+ year retention
- Digital image storage for all receipts
- Searchable receipt database
- Categorized expense tracking

### 2.2 Document Requirements
Each receipt/expense must include:
- Date of transaction
- Vendor/supplier name
- Amount paid
- Description of goods/services
- Payment method
- Business purpose (for audit trail)

**✅ Application Support:**
- AI-powered receipt extraction captures all required fields
- Mandatory business purpose field for audit compliance
- Payment method tracking
- Comprehensive OCR data extraction

---

## 3. Tax Deductible Expenses

### 3.1 Fully Deductible (100%)
The following expenses are 100% deductible if incurred wholly and exclusively for business purposes:

1. **Office Supplies** (Code 5000)
   - Stationery, printing materials
   - Office equipment under capital allowance threshold

2. **Travel & Transportation** (Code 5100)
   - Business travel expenses
   - Local transportation for business
   - Hotel accommodation for business trips
   - ⚠️ Note: Private vehicle expenses require careful apportionment

3. **Professional Services** (Code 5300)
   - Legal fees
   - Accounting and audit fees
   - Consulting fees
   - Professional subscriptions

4. **Marketing & Advertising** (Code 5400)
   - Website costs
   - Advertising campaigns
   - Promotional materials
   - Business cards

5. **Utilities & Communications** (Code 5500)
   - Internet and phone (business portion)
   - Electricity (business portion)
   - Mobile plans

6. **Rent & Facilities** (Code 5600)
   - Office rent
   - Co-working space fees
   - Storage facilities
   - ⚠️ Note: Home office requires apportionment

7. **Software & Technology** (Code 5700)
   - SaaS subscriptions
   - Software licenses
   - Cloud services
   - IT support

8. **Insurance** (Code 5800)
   - Business liability insurance
   - Professional indemnity insurance
   - Property insurance (business)

9. **Training & Education** (Code 5900)
   - Professional development courses
   - Industry certifications
   - Business-related seminars

**✅ Application Support:**
- All categories pre-configured with 100% deduction percentage
- Automatic tax deduction calculation
- Category-wise expense reports

### 3.2 Partially Deductible (50%)

**Meals & Entertainment** (Code 5200)
- Business meals with clients
- Entertainment expenses
- Staff entertainment
- ⚠️ Hong Kong allows 50% deduction for business entertainment

**✅ Application Support:**
- Configured with 50% deduction percentage
- Special flags for business meals in audit trail
- Attendee tracking for business meals

### 3.3 Non-Deductible Expenses
The following are NOT tax deductible:
- Personal expenses
- Capital expenditure (but may qualify for depreciation allowances)
- Domestic or private expenses
- Expenses not related to business income production

**✅ Application Support:**
- Asset accounts (Code 1500) marked as non-deductible
- Clear separation of capital vs. revenue expenses
- Warning system for potential non-deductible items

---

## 4. GST/VAT Considerations

### 4.1 Hong Kong Tax System
- **Important**: Hong Kong does NOT have GST/VAT
- No sales tax on goods and services
- No input tax credit system

### 4.2 Application GST Fields
**❗ Current Issue**: The application includes GST fields which are NOT applicable for Hong Kong operations.

**⚠️ Recommended Changes**:
1. Hide or remove GST fields for Hong Kong entities
2. Add configuration to enable/disable GST based on jurisdiction
3. If keeping for future international expansion, clearly mark as "Not Applicable for HK"

**GST Fields Currently in Schema:**
- `gstNumber` (ABN field)
- `gstAmount` 
- GST-related calculations

---

## 5. Audit Trail Requirements

### 5.1 IRD Audit Expectations
During tax audits, IRD expects:
1. **Complete Documentation**: Every expense must be supported by original receipts
2. **Business Purpose**: Clear explanation of business purpose for each expense
3. **Reasonableness**: Expenses should be reasonable in relation to business income
4. **Apportionment**: Private/business use must be properly apportioned

**✅ Application Support:**
- `auditInfo` object captures:
  - Business purpose (minimum 10 characters - mandatory)
  - Project codes for expense allocation
  - Attendees for entertainment expenses
  - Location tracking
  - Business meal flag
  - Travel-related flag
- High-resolution receipt images stored permanently
- OCR data preserved for verification
- Audit trail of all changes

### 5.2 Manual Review Flags
The application flags receipts for manual review when:
- OCR confidence is low
- Amount is unusually high
- Category suggestion is uncertain
- Missing required fields

**✅ Application Support:**
- `manualReviewRequired` flag in OCR data
- Confidence scoring for AI suggestions
- Review workflow support

---

## 6. Compliance Checklist

### ✅ Implemented in Application
- [x] 7-year receipt retention in R2
- [x] Comprehensive receipt data capture (date, vendor, amount, description)
- [x] Payment method tracking
- [x] Business purpose documentation (audit trail)
- [x] Tax deductibility categorization
- [x] Expense category classification aligned with HK practice
- [x] Receipt image storage and retrieval
- [x] AI-powered data extraction
- [x] Searchable expense database
- [x] Financial year reporting (configurable)
- [x] Two-tier tax calculation support

### ⚠️ Needs Attention
- [ ] Remove or hide GST fields for Hong Kong operations
- [ ] Add Hong Kong-specific tax rate calculator
- [ ] Implement home office expense apportionment tool
- [ ] Add vehicle expense log and apportionment calculator
- [ ] Create IRD Profits Tax Return export format
- [ ] Add depreciation schedule for capital assets
- [ ] Implement chart of accounts alignment with HK standard

### 🔄 Recommended Enhancements
1. **Tax Year Configuration**
   - Default to HK tax year (April 1 - March 31)
   - Support year-end adjustments

2. **Capital Allowances**
   - Track capital assets separately
   - Calculate depreciation allowances
   - Generate capital allowances schedule

3. **Apportionment Tools**
   - Home office calculator (area-based)
   - Vehicle expense tracker (business vs. private km)
   - Utility bill apportionment

4. **IRD Reporting**
   - Export to IRD tax computation format
   - Generate supporting schedules
   - Profit and loss statement (HK format)

5. **Multi-Currency**
   - Currently defaults to TWD (Taiwan Dollar)
   - Should support HKD as default for HK operations
   - Exchange rate tracking for foreign expenses

---

## 7. Currency Configuration Issue

**❗ Current Issue**: Default currency is set to 'TWD' (Taiwan Dollar)

**Location**: `src/lib/schemas.ts` - Line 11
```typescript
currency: z.string().default('TWD'),
```

**Required Change**:
```typescript
currency: z.string().default('HKD'),
```

**Additional Considerations**:
- Add currency configuration in settings
- Support multi-currency if operating internationally
- Track exchange rates for foreign expenses
- IRD requires conversion to HKD using either:
  - Actual exchange rate on transaction date, or
  - Average exchange rate for the month

---

## 8. Payment Methods Compliance

### Current Payment Methods
The application tracks:
- Cash
- Company Card
- Bank Transfer
- Check

**✅ Compliant with HK Requirements:**
All methods are acceptable and commonly used in HK business transactions.

**Enhancement Suggestion:**
- Add "E-wallet" (e.g., PayMe, Alipay, WeChat Pay)
- Add "FPS" (Faster Payment System)

---

## 9. Account Codes and Classification

### Current Chart of Accounts Structure
The application uses a simplified chart of accounts:
- 1xxx: Assets
- 2xxx: Liabilities
- 3xxx: Equity
- 4xxx: Revenue
- 5xxx: Expenses

**✅ Generally Aligned with HK Practice**

**Recommendations:**
1. Add sub-categories for better tracking:
   - 5100-5199: Direct business expenses
   - 5200-5299: Entertainment and meals
   - 5300-5399: Professional fees
   - 5400-5499: Marketing
   - 5500-5599: Occupancy costs
   - 5600-5699: Equipment and depreciation
   - 5700-5799: Administrative expenses

2. Add missing essential accounts:
   - Bad debts
   - Bank charges and interest
   - Depreciation expense
   - Staff costs (if applicable)

---

## 10. Data Privacy Compliance

### Personal Data (Privacy) Ordinance
Hong Kong's Personal Data (Privacy) Ordinance (PDPO) applies to:
- Staff personal data
- Customer data
- Vendor data

**✅ Application Considerations:**
- Receipt images may contain personal data
- Vendor names and details are stored
- Secure storage in Cloudflare R2
- Access control via authentication

**Required Measures:**
- Data retention policy (already 7+ years for tax compliance)
- Access controls (implemented via Cloudflare auth)
- Secure transmission (HTTPS)
- Data breach notification procedures

---

## 11. References

### Official Resources
1. **Inland Revenue Department (IRD)**
   - Website: https://www.ird.gov.hk/
   - Profits Tax Guide: IRD's Departmental Interpretation and Practice Notes (DIPN)
   - Business Record Keeping: https://www.ird.gov.hk/eng/tax/bus_rke.htm

2. **Companies Registry**
   - Website: https://www.cr.gov.hk/
   - Companies Ordinance compliance

3. **Hong Kong Institute of CPAs (HKICPA)**
   - Website: https://www.hkicpa.org.hk/
   - Accounting standards (HKFRS)
   - Professional guidelines

### Key Tax Rates (2025/26)
- Unincorporated business: 7.5% / 15% (two-tier)
- Corporation: 8.25% / 16.5% (two-tier)
- Entertainment deduction: 50%
- No GST/VAT

---

## 12. Implementation Priority

### High Priority (Immediate)
1. ✅ **Change default currency from TWD to HKD**
2. ✅ **Remove/hide GST fields for HK operations**
3. ✅ **Verify 50% deduction for meals & entertainment**

### Medium Priority (Next Quarter)
4. Add Hong Kong tax year configuration
5. Implement capital allowances tracking
6. Add IRD tax computation export
7. Create apportionment calculators

### Low Priority (Future Enhancement)
8. Multi-entity support
9. Consolidated group reporting
10. Transfer pricing documentation
11. BEPS compliance features

---

## Summary

This application provides **strong foundational support** for Hong Kong unlimited company compliance:

✅ **Strengths:**
- Comprehensive receipt capture and retention
- Strong audit trail capabilities
- Tax deductibility classification
- Secure cloud storage
- AI-powered efficiency

⚠️ **Critical Updates Needed:**
- Currency change (TWD → HKD)
- GST field removal/hiding
- Expense category refinement

📈 **Recommended Enhancements:**
- Tax computation tools
- Capital allowances tracking
- Apportionment calculators
- IRD report formatting

With the critical updates implemented, this application will be **fully compliant** with Hong Kong Inland Revenue Department requirements for unlimited companies.
