// Expense Categories with full configuration
import { z } from 'zod';

export const ExpenseCategorySchema = z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
    taxDeductible: z.boolean().default(true),
    description: z.string().optional(),
    subcategories: z
        .array(
            z.object({
                id: z.string(),
                name: z.string()
            })
        )
        .default([]),
    sortOrder: z.number().default(0),
    active: z.boolean().default(true)
});

export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

// Default categories for Hong Kong small business
export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
    {
        id: 'office',
        name: 'Office Supplies',
        icon: '🖊️',
        color: '#3B82F6',
        taxDeductible: true,
        subcategories: [
            { id: 'stationery', name: 'Stationery' },
            { id: 'furniture', name: 'Furniture' },
            { id: 'supplies', name: 'General Supplies' }
        ],
        sortOrder: 1,
        active: true
    },
    {
        id: 'travel',
        name: 'Travel & Transport',
        icon: '✈️',
        color: '#10B981',
        taxDeductible: true,
        subcategories: [
            { id: 'flights', name: 'Flights' },
            { id: 'accommodation', name: 'Accommodation' },
            { id: 'car', name: 'Car/Taxi/Uber' },
            { id: 'parking', name: 'Parking' },
            { id: 'public_transport', name: 'Public Transport' }
        ],
        sortOrder: 2,
        active: true
    },
    {
        id: 'meals',
        name: 'Meals & Entertainment',
        icon: '🍽️',
        color: '#F59E0B',
        taxDeductible: true,
        description: 'Business meals are 50% deductible',
        subcategories: [
            { id: 'client_meals', name: 'Client Meals' },
            { id: 'team_meals', name: 'Team Meals' },
            { id: 'entertainment', name: 'Entertainment' }
        ],
        sortOrder: 3,
        active: true
    },
    {
        id: 'software',
        name: 'Software & Subscriptions',
        icon: '💻',
        color: '#8B5CF6',
        taxDeductible: true,
        subcategories: [
            { id: 'saas', name: 'SaaS Subscriptions' },
            { id: 'licenses', name: 'Software Licenses' },
            { id: 'cloud', name: 'Cloud Services' },
            { id: 'domains', name: 'Domains & Hosting' }
        ],
        sortOrder: 4,
        active: true
    },
    {
        id: 'utilities',
        name: 'Utilities',
        icon: '💡',
        color: '#EC4899',
        taxDeductible: true,
        subcategories: [
            { id: 'electricity', name: 'Electricity' },
            { id: 'internet', name: 'Internet' },
            { id: 'phone', name: 'Phone/Mobile' },
            { id: 'water', name: 'Water' }
        ],
        sortOrder: 5,
        active: true
    },
    {
        id: 'professional',
        name: 'Professional Services',
        icon: '👔',
        color: '#6366F1',
        taxDeductible: true,
        subcategories: [
            { id: 'accounting', name: 'Accounting' },
            { id: 'legal', name: 'Legal' },
            { id: 'consulting', name: 'Consulting' },
            { id: 'contractors', name: 'Contractors' }
        ],
        sortOrder: 6,
        active: true
    },
    {
        id: 'marketing',
        name: 'Marketing & Advertising',
        icon: '📢',
        color: '#EF4444',
        taxDeductible: true,
        subcategories: [
            { id: 'ads', name: 'Online Ads' },
            { id: 'print', name: 'Print Materials' },
            { id: 'events', name: 'Events & Sponsorship' }
        ],
        sortOrder: 7,
        active: true
    },
    {
        id: 'equipment',
        name: 'Equipment & Assets',
        icon: '🔧',
        color: '#14B8A6',
        taxDeductible: true,
        description: 'May be depreciated over time',
        subcategories: [
            { id: 'computers', name: 'Computers' },
            { id: 'electronics', name: 'Electronics' },
            { id: 'machinery', name: 'Machinery' }
        ],
        sortOrder: 8,
        active: true
    },
    {
        id: 'insurance',
        name: 'Insurance',
        icon: '🛡️',
        color: '#0EA5E9',
        taxDeductible: true,
        subcategories: [
            { id: 'business', name: 'Business Insurance' },
            { id: 'professional', name: 'Professional Indemnity' },
            { id: 'vehicle', name: 'Vehicle Insurance' }
        ],
        sortOrder: 9,
        active: true
    },
    {
        id: 'rent',
        name: 'Rent & Premises',
        icon: '🏢',
        color: '#84CC16',
        taxDeductible: true,
        subcategories: [
            { id: 'office_rent', name: 'Office Rent' },
            { id: 'coworking', name: 'Coworking Space' },
            { id: 'storage', name: 'Storage' }
        ],
        sortOrder: 10,
        active: true
    },
    {
        id: 'training',
        name: 'Training & Education',
        icon: '📚',
        color: '#A855F7',
        taxDeductible: true,
        subcategories: [
            { id: 'courses', name: 'Online Courses' },
            { id: 'certifications', name: 'Certifications' },
            { id: 'seminars', name: 'Seminars & Conferences' },
            { id: 'books', name: 'Books & Materials' }
        ],
        sortOrder: 11,
        active: true
    },
    {
        id: 'other',
        name: 'Other Expenses',
        icon: '📦',
        color: '#6B7280',
        taxDeductible: true,
        subcategories: [],
        sortOrder: 99,
        active: true
    }
];

// Helper to get category by ID
export function getCategoryById(id: string): ExpenseCategory | undefined {
    return DEFAULT_CATEGORIES.find((c) => c.id === id);
}

// Helper to get category name
export function getCategoryName(id: string): string {
    return getCategoryById(id)?.name ?? 'Unknown';
}

// Helper to get category icon
export function getCategoryIcon(id: string): string {
    return getCategoryById(id)?.icon ?? '📦';
}

// Helper to get category color
export function getCategoryColor(id: string): string {
    return getCategoryById(id)?.color ?? '#6B7280';
}

// AI category name to our category ID mapping
const AI_CATEGORY_MAPPING: Record<string, string> = {
    // New Hong Kong categories
    'office_supplies': 'office',
    'travel': 'travel',
    'meals_entertainment': 'meals',
    'professional_services': 'professional',
    'marketing': 'marketing',
    'utilities': 'utilities',
    'rent': 'rent',
    'software': 'software',
    'insurance': 'insurance',
    'training': 'training',
    'bank_charges': 'other',
    'repairs': 'equipment',
    'other': 'other',

    // Legacy/fallback mappings
    'project_materials': 'supplies',
    'food_beverage': 'meals',
    'fuel_vehicle': 'vehicle',
    'subscriptions': 'software'
};

// Get category by AI-recognized category name
export function getCategoryByAIName(aiCategoryName: string): ExpenseCategory | undefined {
    const mappedId = AI_CATEGORY_MAPPING[aiCategoryName.toLowerCase()];
    if (mappedId) {
        return getCategoryById(mappedId);
    }
    // Try direct match
    return getCategoryById(aiCategoryName.toLowerCase());
}
