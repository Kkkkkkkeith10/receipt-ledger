<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import DocumentViewer from "$lib/components/DocumentViewer.svelte";
    import { DEFAULT_CATEGORIES } from "$lib/categories";
    import type { Currency, PaymentMethod, Receipt } from "$lib/types";
    import {
        formatCurrency,
        getCurrencySymbol,
        getSupportedCurrencies,
    } from "$lib/utils/format";
    import type { SupportedCurrency } from "$lib/utils/format";
    import {
        getReceiptBlockingIssues,
        getReceiptFlags,
    } from "$lib/utils/receiptFlags";

    const receiptId = $page.params.id;
    const categories = DEFAULT_CATEGORIES;
    const currencies = getSupportedCurrencies();
    const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
        { value: "cash", label: "Cash" },
        { value: "card", label: "Card" },
        { value: "bank_transfer", label: "Bank transfer" },
        { value: "other", label: "Other" },
    ];

    let receipt: Receipt | null = null;
    let loading = true;
    let saving = false;
    let error = "";
    let showDocViewer = false;

    let vendor = "";
    let amount = 0;
    let currency: Currency = "HKD";
    let date = "";
    let category = "";
    let status: Receipt["status"] = "pending";
    let paymentMethod: PaymentMethod | "" = "";
    let taxDeductible = true;
    let notes = "";
    let businessPurpose = "";
    let projectCode = "";
    let location = "";
    let attendees = "";
    let businessMeal = false;
    let travelRelated = false;

    $: draftReceipt = receipt
        ? {
              ...receipt,
              vendor,
              amount: Number(amount),
              currency,
              date,
              category,
              status,
              paymentMethod: paymentMethod || undefined,
              taxDeductible,
              notes,
              auditInfo: {
                  businessPurpose,
                  projectCode,
                  location,
                  attendees,
                  businessMeal,
                  travelRelated,
              },
          }
        : null;
    $: draftFlags = getReceiptFlags(draftReceipt);
    $: blockingIssues = getReceiptBlockingIssues(draftReceipt);
    $: draftCurrency = (currency ?? "HKD") as SupportedCurrency;

    function getStatusClasses(currentStatus: Receipt["status"]) {
        switch (currentStatus) {
            case "approved":
                return "bg-emerald-100 text-emerald-800 border border-emerald-200";
            case "pending":
                return "bg-amber-100 text-amber-800 border border-amber-200";
            case "rejected":
                return "bg-rose-100 text-rose-800 border border-rose-200";
            default:
                return "bg-slate-100 text-slate-700 border border-slate-200";
        }
    }

    function getFlagClasses(level: "attention" | "suspicious") {
        return level === "suspicious"
            ? "bg-rose-100 text-rose-700 border border-rose-200"
            : "bg-slate-100 text-slate-700 border border-slate-200";
    }

    function getAmountPreview() {
        return formatCurrency(Number(amount) || 0, { currency: draftCurrency });
    }

    onMount(async () => {
        try {
            const res = await fetch(`/api/receipts/${receiptId}`);
            if (res.ok) {
                receipt = await res.json();
                if (receipt) {
                    vendor = receipt.vendor || "";
                    amount = receipt.amount || 0;
                    currency = receipt.currency || "HKD";
                    date = receipt.date || "";
                    category = receipt.category || "";
                    status = receipt.status || "pending";
                    paymentMethod = receipt.paymentMethod || "";
                    taxDeductible = receipt.taxDeductible ?? true;
                    notes = receipt.notes || "";
                    businessPurpose = receipt.auditInfo?.businessPurpose || "";
                    projectCode = receipt.auditInfo?.projectCode || "";
                    location = receipt.auditInfo?.location || "";
                    attendees = receipt.auditInfo?.attendees || "";
                    businessMeal = receipt.auditInfo?.businessMeal ?? false;
                    travelRelated = receipt.auditInfo?.travelRelated ?? false;
                }
            } else {
                error = "Receipt not found";
            }
        } catch (err) {
            error = "Failed to load receipt";
        } finally {
            loading = false;
        }
    });

    async function handleSubmit() {
        error = "";
        if (blockingIssues.length > 0) {
            error = blockingIssues.join(" ");
            return;
        }

        saving = true;

        try {
            const res = await fetch(`/api/receipts/${receiptId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vendor,
                    amount: Number(amount),
                    currency,
                    date,
                    category,
                    status,
                    paymentMethod: paymentMethod || undefined,
                    taxDeductible,
                    notes,
                    auditInfo: {
                        businessPurpose,
                        projectCode,
                        location,
                        attendees,
                        businessMeal,
                        travelRelated,
                    },
                }),
            });

            if (res.ok) {
                goto(`/receipts/${receiptId}`);
            } else {
                const msg = await res.text();
                error = msg || "Failed to update receipt";
            }
        } catch (err) {
            error = "Error saving receipt";
        } finally {
            saving = false;
        }
    }
</script>

<div class="mx-auto max-w-7xl space-y-4 md:space-y-6">
    {#if loading}
        <div class="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div class="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-slate-900"></div>
            <p class="mt-4 text-gray-600">Loading receipt...</p>
        </div>
    {:else if error && !receipt}
        <div class="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
            <p class="text-rose-700">{error}</p>
            <button
                on:click={() => goto("/receipts")}
                class="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
                Back to Receipts
            </button>
        </div>
    {:else if receipt}
        <form on:submit|preventDefault={handleSubmit} class="space-y-6">
            <section class="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-sm md:px-8 md:py-8">
                <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div class="space-y-3">
                        <a
                            href={`/receipts/${receiptId}`}
                            class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200 hover:bg-white/15"
                        >
                            ← Back to Receipt
                        </a>
                        <div>
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="inline-flex rounded-full px-3 py-1 text-xs font-medium {getStatusClasses(status)}">
                                    {status}
                                </span>
                                {#if draftFlags.some((flag) => flag.level === "suspicious")}
                                    <span class="inline-flex rounded-full border border-rose-300/30 bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-100">
                                        Suspicious
                                    </span>
                                {/if}
                            </div>
                            <h1 class="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Edit Receipt</h1>
                            <p class="mt-2 text-sm text-slate-300">{receiptId}</p>
                        </div>
                    </div>

                    <div class="text-left lg:text-right">
                        <div class="text-sm uppercase tracking-[0.18em] text-slate-400">Live Amount</div>
                        <div class="mt-1 text-4xl font-semibold">{getAmountPreview()}</div>
                    </div>
                </div>

                {#if draftFlags.length > 0}
                    <div class="mt-6 border-t border-white/10 pt-5">
                        <div class="flex flex-wrap gap-2">
                            {#each draftFlags as flag}
                                <span class="inline-flex rounded-full px-3 py-1 text-xs font-medium {getFlagClasses(flag.level)}">
                                    {flag.label}
                                </span>
                            {/each}
                        </div>
                    </div>
                {/if}
            </section>

            <div class="grid items-start gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <section class="space-y-4 xl:sticky xl:top-4">
                    <div class="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                            <div>
                                <h2 class="text-lg font-semibold text-slate-900">Original Document</h2>
                                <p class="text-sm text-slate-500">Keep the source visible while you correct the extracted fields.</p>
                            </div>
                            {#if receipt.receiptImageUrl}
                                <button
                                    type="button"
                                    on:click={() => (showDocViewer = true)}
                                    class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    Fullscreen
                                </button>
                            {/if}
                        </div>

                        <div class="bg-slate-50 p-4">
                            {#if receipt.receiptImageUrl}
                                {#if receipt.receiptImageUrl.endsWith(".pdf")}
                                    <iframe
                                        src={receipt.receiptImageUrl}
                                        title="Receipt PDF"
                                        class="h-[640px] w-full rounded-2xl border border-gray-200 bg-white"
                                    ></iframe>
                                {:else}
                                    <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white p-3">
                                        <img
                                            src={receipt.receiptImageUrl}
                                            alt="Receipt"
                                            class="max-h-[640px] w-full rounded-xl object-contain"
                                        />
                                    </div>
                                {/if}
                            {:else}
                                <div class="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center">
                                    <div>
                                        <div class="text-5xl">📄</div>
                                        <p class="mt-3 text-sm font-medium text-slate-700">No document attached</p>
                                        <p class="mt-1 text-sm text-slate-500">This record can still be edited, but it needs an attachment.</p>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>

                    <div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h3 class="text-lg font-semibold text-slate-900">Quick Summary</h3>
                        <dl class="mt-4 space-y-3 text-sm text-slate-700">
                            <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                                <dt>Currency</dt>
                                <dd class="font-medium text-slate-900">{currency}</dd>
                            </div>
                            <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                                <dt>Status</dt>
                                <dd class="font-medium capitalize text-slate-900">{status}</dd>
                            </div>
                            <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                                <dt>Payment</dt>
                                <dd class="font-medium text-slate-900">{paymentMethod || "Not specified"}</dd>
                            </div>
                        </dl>
                    </div>
                </section>

                <section class="space-y-4">
                    {#if error || blockingIssues.length > 0}
                        <div class="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                            <h3 class="text-sm font-semibold uppercase tracking-wide text-amber-800">Needs fixes before save</h3>
                            {#if blockingIssues.length > 0}
                                <ul class="mt-3 space-y-2 text-sm text-amber-900">
                                    {#each blockingIssues as issue}
                                        <li>• {issue}</li>
                                    {/each}
                                </ul>
                            {/if}
                            {#if error}
                                <p class="mt-3 text-sm text-rose-700">{error}</p>
                            {/if}
                        </div>
                    {/if}

                    <div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h3 class="text-lg font-semibold text-slate-900">Core Details</h3>
                        <div class="mt-4 grid gap-4 md:grid-cols-2">
                            <label class="block">
                                <span class="mb-1 block text-sm font-medium text-slate-700">Vendor</span>
                                <input
                                    type="text"
                                    id="vendor"
                                    bind:value={vendor}
                                    class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                />
                            </label>

                            <label class="block">
                                <span class="mb-1 block text-sm font-medium text-slate-700">Date</span>
                                <input
                                    type="date"
                                    id="date"
                                    bind:value={date}
                                    class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                />
                            </label>

                            <label class="block md:col-span-2">
                                <span class="mb-1 block text-sm font-medium text-slate-700">Amount</span>
                                <div class="grid gap-3 sm:grid-cols-[160px_1fr]">
                                    <select
                                        bind:value={currency}
                                        class="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    >
                                        {#each currencies as currentCurrency}
                                            <option value={currentCurrency.code}>
                                                {currentCurrency.code} ({getCurrencySymbol(currentCurrency.code)})
                                            </option>
                                        {/each}
                                    </select>
                                    <input
                                        type="number"
                                        id="amount"
                                        bind:value={amount}
                                        min="0"
                                        step="0.01"
                                        class="rounded-2xl border border-gray-300 px-4 py-3 text-lg font-semibold text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    />
                                </div>
                            </label>

                            <label class="block">
                                <span class="mb-1 block text-sm font-medium text-slate-700">Category</span>
                                <select
                                    id="category"
                                    bind:value={category}
                                    class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                >
                                    <option value="">Select category</option>
                                    {#each categories as currentCategory}
                                        <option value={currentCategory.id}>{currentCategory.name}</option>
                                    {/each}
                                </select>
                            </label>

                            <label class="block">
                                <span class="mb-1 block text-sm font-medium text-slate-700">Status</span>
                                <select
                                    id="status"
                                    bind:value={status}
                                    class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </label>

                            <label class="block">
                                <span class="mb-1 block text-sm font-medium text-slate-700">Payment Method</span>
                                <select
                                    bind:value={paymentMethod}
                                    class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                >
                                    <option value="">Not specified</option>
                                    {#each paymentMethods as method}
                                        <option value={method.value}>{method.label}</option>
                                    {/each}
                                </select>
                            </label>

                            <label class="flex items-center gap-3 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 md:self-end">
                                <input
                                    type="checkbox"
                                    id="taxDeductible"
                                    bind:checked={taxDeductible}
                                    class="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-500"
                                />
                                <span>
                                    <span class="block text-sm font-medium text-slate-700">Tax deductible</span>
                                    <span class="block text-xs text-slate-500">Mark if this expense can be claimed.</span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h3 class="text-lg font-semibold text-slate-900">Business Context</h3>
                        <div class="mt-4 grid gap-4 md:grid-cols-2">
                            <label class="block md:col-span-2">
                                <span class="mb-1 block text-sm font-medium text-slate-700">Business Purpose</span>
                                <textarea
                                    id="businessPurpose"
                                    bind:value={businessPurpose}
                                    rows="3"
                                    class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    placeholder="Describe why this expense was incurred..."
                                ></textarea>
                            </label>

                            <label class="block">
                                <span class="mb-1 block text-sm font-medium text-slate-700">Project Code</span>
                                <input
                                    type="text"
                                    id="projectCode"
                                    bind:value={projectCode}
                                    class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    placeholder="e.g. PROJ-001"
                                />
                            </label>

                            <label class="block">
                                <span class="mb-1 block text-sm font-medium text-slate-700">Location</span>
                                <input
                                    type="text"
                                    id="location"
                                    bind:value={location}
                                    class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    placeholder="e.g. Hong Kong"
                                />
                            </label>

                            <label class="block md:col-span-2">
                                <span class="mb-1 block text-sm font-medium text-slate-700">Attendees</span>
                                <input
                                    type="text"
                                    bind:value={attendees}
                                    class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                    placeholder="Names or group involved, if relevant"
                                />
                            </label>

                            <label class="flex items-center gap-3 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3">
                                <input
                                    type="checkbox"
                                    bind:checked={businessMeal}
                                    class="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-500"
                                />
                                <span class="text-sm text-slate-700">Business meal</span>
                            </label>

                            <label class="flex items-center gap-3 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3">
                                <input
                                    type="checkbox"
                                    bind:checked={travelRelated}
                                    class="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-500"
                                />
                                <span class="text-sm text-slate-700">Travel-related</span>
                            </label>
                        </div>
                    </div>

                    <div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h3 class="text-lg font-semibold text-slate-900">Notes</h3>
                        <textarea
                            id="notes"
                            bind:value={notes}
                            rows="4"
                            class="mt-4 w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder="Additional notes..."
                        ></textarea>
                    </div>

                    <div class="rounded-3xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
                        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div class="text-sm font-medium text-slate-200">Save changes</div>
                                <div class="text-xs text-slate-400">Blocking issues must be fixed before this receipt can be saved.</div>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    on:click={() => goto(`/receipts/${receiptId}`)}
                                    class="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || blockingIssues.length > 0}
                                    class="rounded-xl bg-white px-5 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </form>
    {/if}
</div>

{#if receipt?.receiptImageUrl}
    <DocumentViewer
        bind:show={showDocViewer}
        url={receipt.receiptImageUrl}
        title={`Receipt ${receipt.id}`}
    />
{/if}
