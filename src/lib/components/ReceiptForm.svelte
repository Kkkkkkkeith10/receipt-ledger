<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { DEFAULT_CATEGORIES } from "$lib/categories";
    import type { ReceiptFormData, PaymentMethod, Currency } from "$lib/types";
    import {
        getCurrencySymbol,
        getSupportedCurrencies,
    } from "$lib/utils/format";

    export let initialData: Partial<ReceiptFormData> | null = null;
    export let isEditing = false;
    export let loading = false;
    export let submitLabel: string | null = null;

    const dispatch = createEventDispatcher<{
        submit: ReceiptFormData;
        cancel: void;
    }>();

    // Supported currencies list
    const currencies = getSupportedCurrencies();

    // Form state
    let vendor = initialData?.vendor ?? "";
    let amount = initialData?.amount ?? 0;
    let currency: Currency = (initialData?.currency as Currency) ?? "HKD";
    let gstFree = initialData?.gstFree ?? false;
    let date = initialData?.date ?? new Date().toISOString().split("T")[0];
    let category = initialData?.category ?? "";
    let subcategory = initialData?.subcategory ?? "";
    let paymentMethod: PaymentMethod =
        (initialData?.paymentMethod as PaymentMethod) ?? "card";
    let taxDeductible = initialData?.taxDeductible ?? true;
    let notes = initialData?.notes ?? "";
    let businessPurpose = initialData?.auditInfo?.businessPurpose ?? "";
    let projectCode = initialData?.auditInfo?.projectCode ?? "";

    // React to initialData changes (e.g., after AI recognition)
    $: if (initialData) {
        vendor = initialData.vendor ?? vendor;
        amount = initialData.amount ?? amount;
        currency = (initialData.currency as Currency) ?? currency;
        gstFree = initialData.gstFree ?? gstFree;
        date = initialData.date ?? date;
        category = initialData.category ?? category;
        subcategory = initialData.subcategory ?? subcategory;
        paymentMethod =
            (initialData.paymentMethod as PaymentMethod) ?? paymentMethod;
        taxDeductible = initialData.taxDeductible ?? taxDeductible;
        notes = initialData.notes ?? notes;
        businessPurpose =
            initialData.auditInfo?.businessPurpose ?? businessPurpose;
        projectCode = initialData.auditInfo?.projectCode ?? projectCode;
    }

    // Get currency symbol for display
    $: currencySymbol = getCurrencySymbol(currency);

    // Get subcategories for selected category
    $: selectedCategory = DEFAULT_CATEGORIES.find((c) => c.id === category);
    $: subcategories = selectedCategory?.subcategories ?? [];

    // GST calculation display (only for HKD - HK has no GST)
    // For JPY/TWD, show tax info if applicable
    $: showGstCalculation = currency === "HKD" && !gstFree && amount > 0;
    $: gstAmount = gstFree ? 0 : amount / 11;
    $: netAmount = amount - gstAmount;

    function handleSubmit() {
        const formData: ReceiptFormData = {
            vendor,
            amount,
            currency,
            gstFree,
            date,
            category,
            subcategory: subcategory || undefined,
            paymentMethod,
            taxDeductible,
            notes: notes || undefined,
            auditInfo: {
                businessPurpose: businessPurpose || undefined,
                projectCode: projectCode || undefined,
            },
        };
        dispatch("submit", formData);
    }
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-6">
    <!-- Vendor & Amount Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label
                for="vendor"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Vendor *</label
            >
            <input
                type="text"
                id="vendor"
                bind:value={vendor}
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Officeworks, Uber"
            />
        </div>

        <div>
            <label
                for="amount"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Amount *</label
            >
            <div class="flex gap-2">
                <select
                    id="currency"
                    bind:value={currency}
                    class="w-24 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                    {#each currencies as curr}
                        <option value={curr.code}>{curr.code}</option>
                    {/each}
                </select>
                <div class="relative flex-1">
                    <span class="absolute left-3 top-2 text-gray-500"
                        >{currencySymbol}</span
                    >
                    <input
                        type="number"
                        id="amount"
                        bind:value={amount}
                        required
                        min="0.01"
                        step="0.01"
                        class="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>
            {#if showGstCalculation}
                <p class="text-xs text-gray-500 mt-1">
                    Net: {currencySymbol}{netAmount.toFixed(2)} + GST: {currencySymbol}{gstAmount.toFixed(
                        2,
                    )}
                </p>
            {:else if amount > 0 && gstFree}
                <p class="text-xs text-gray-500 mt-1">GST Free</p>
            {/if}
        </div>
    </div>

    <!-- Date & Category Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label
                for="date"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Date *</label
            >
            <input
                type="date"
                id="date"
                bind:value={date}
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
        </div>

        <div>
            <label
                for="category"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Category *</label
            >
            <select
                id="category"
                bind:value={category}
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
                <option value="">Select category...</option>
                {#each DEFAULT_CATEGORIES as cat}
                    <option value={cat.id}>{cat.icon} {cat.name}</option>
                {/each}
            </select>
        </div>
    </div>

    <!-- Subcategory & Payment Method -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#if subcategories.length > 0}
            <div>
                <label
                    for="subcategory"
                    class="block text-sm font-medium text-gray-700 mb-1"
                    >Subcategory</label
                >
                <select
                    id="subcategory"
                    bind:value={subcategory}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">Select subcategory...</option>
                    {#each subcategories as sub}
                        <option value={sub.id}>{sub.name}</option>
                    {/each}
                </select>
            </div>
        {/if}

        <div>
            <label
                for="paymentMethod"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Payment Method</label
            >
            <select
                id="paymentMethod"
                bind:value={paymentMethod}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
            </select>
        </div>
    </div>

    <!-- Business Purpose -->
    <div>
        <label
            for="businessPurpose"
            class="block text-sm font-medium text-gray-700 mb-1"
            >Business Purpose</label
        >
        <textarea
            id="businessPurpose"
            bind:value={businessPurpose}
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe the business purpose of this expense..."
        ></textarea>
    </div>

    <!-- Notes -->
    <div>
        <label for="notes" class="block text-sm font-medium text-gray-700 mb-1"
            >Notes</label
        >
        <textarea
            id="notes"
            bind:value={notes}
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Additional notes..."
        ></textarea>
    </div>

    <!-- Checkboxes -->
    <div class="flex flex-wrap gap-6">
        <label class="flex items-center space-x-2 cursor-pointer">
            <input
                type="checkbox"
                bind:checked={taxDeductible}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="text-sm text-gray-700">Tax Deductible</span>
        </label>

        <label class="flex items-center space-x-2 cursor-pointer">
            <input
                type="checkbox"
                bind:checked={gstFree}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="text-sm text-gray-700">GST Free</span>
        </label>
    </div>

    <!-- Buttons -->
    <div class="flex justify-end space-x-3 pt-4 border-t">
        <button
            type="button"
            on:click={() => dispatch("cancel")}
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
            Cancel
        </button>
        <button
            type="submit"
            disabled={loading || !vendor || !amount || !category}
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {#if loading}
                <span class="flex items-center space-x-2">
                    <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                            fill="none"
                        />
                        <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                    <span>Saving...</span>
                </span>
            {:else}
                {submitLabel || (isEditing ? "Update Receipt" : "Add Receipt")}
            {/if}
        </button>
    </div>
</form>
