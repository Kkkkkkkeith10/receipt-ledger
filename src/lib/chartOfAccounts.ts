import type { ChartOfAccount } from './schemas';

export const defaultChartOfAccounts: ChartOfAccount[] = [
  // Assets
  {
    code: '1000',
    name: 'Cash & Bank Accounts',
    type: 'asset',
    taxDeductible: false,
    deductionPercentage: 0,
    active: true,
    description: 'Primary business bank accounts and cash on hand'
  },
  {
    code: '1200',
    name: 'Accounts Receivable',
    type: 'asset',
    taxDeductible: false,
    deductionPercentage: 0,
    active: true,
    description: 'Money owed by customers for services/products'
  },
  {
    code: '1500',
    name: 'Equipment & Assets',
    type: 'asset',
    taxDeductible: false,
    deductionPercentage: 0,
    active: true,
    description: 'Business equipment, computers, furniture'
  },

  // Liabilities
  {
    code: '2000',
    name: 'Accounts Payable',
    type: 'liability',
    taxDeductible: false,
    deductionPercentage: 0,
    active: true,
    description: 'Money owed to suppliers and vendors'
  },
  {
    code: '2100',
    name: 'Credit Card Payable',
    type: 'liability',
    taxDeductible: false,
    deductionPercentage: 0,
    active: true,
    description: 'Business credit card balances'
  },

  // Equity
  {
    code: '3000',
    name: 'Owner\'s Equity',
    type: 'equity',
    taxDeductible: false,
    deductionPercentage: 0,
    active: true,
    description: 'Owner investment and retained earnings'
  },

  // Revenue
  {
    code: '4000',
    name: 'Service Revenue',
    type: 'revenue',
    taxDeductible: false,
    deductionPercentage: 0,
    active: true,
    description: 'Income from services provided'
  },
  {
    code: '4100',
    name: 'Product Sales',
    type: 'revenue',
    taxDeductible: false,
    deductionPercentage: 0,
    active: true,
    description: 'Income from product sales'
  },

  // Expenses (Tax-Optimized Categories)
  {
    code: '5000',
    name: 'Office Supplies',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Paper, ink, basic office materials - 100% deductible'
  },
  {
    code: '5100',
    name: 'Travel & Transportation',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Business travel, mileage, hotels - 100% deductible'
  },
  {
    code: '5200',
    name: 'Meals & Entertainment',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 50,
    active: true,
    description: 'Business meals, client entertainment - 50% deductible (HK IRD rule)'
  },
  {
    code: '5300',
    name: 'Professional Services',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Legal, accounting, consulting - 100% deductible'
  },
  {
    code: '5400',
    name: 'Marketing & Advertising',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Website, ads, promotional materials - 100% deductible'
  },
  {
    code: '5500',
    name: 'Utilities & Communications',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Internet, phone, business electricity - 100% deductible'
  },
  {
    code: '5600',
    name: 'Rent & Facilities',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Office rent, coworking space - 100% deductible'
  },
  {
    code: '5700',
    name: 'Software & Technology',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'SaaS subscriptions, licenses - 100% deductible'
  },
  {
    code: '5800',
    name: 'Insurance',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Business insurance premiums - 100% deductible'
  },
  {
    code: '5900',
    name: 'Training & Education',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Professional development, courses - 100% deductible'
  },
  {
    code: '6000',
    name: 'Bank Charges & Interest',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Bank fees, transaction charges, interest expense - 100% deductible'
  },
  {
    code: '6100',
    name: 'Depreciation',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Depreciation of fixed assets - subject to IRD capital allowances'
  },
  {
    code: '6200',
    name: 'Bad Debts',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Written-off receivables - 100% deductible if previously included in income'
  },
  {
    code: '6300',
    name: 'Repairs & Maintenance',
    type: 'expense',
    taxDeductible: true,
    deductionPercentage: 100,
    active: true,
    description: 'Repairs and maintenance (revenue nature, not capital) - 100% deductible'
  },
];

// Helper function to get account by code
export function getAccountByCode(code: string): ChartOfAccount | undefined {
  return defaultChartOfAccounts.find(account => account.code === code);
}

// Helper function to get expense categories
export function getExpenseCategories(): ChartOfAccount[] {
  return defaultChartOfAccounts.filter(account => account.type === 'expense');
}

// Helper function to get accounts by type
export function getAccountsByType(type: ChartOfAccount['type']): ChartOfAccount[] {
  return defaultChartOfAccounts.filter(account => account.type === type);
}