<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import DocumentViewer from "$lib/components/DocumentViewer.svelte";
    import { formatCurrency, formatDate } from "$lib/utils/format";
    import type { SupportedCurrency } from "$lib/utils/format";
    import {
        getCategoryColor,
        getCategoryIcon,
        getCategoryName,
    } from "$lib/categories";
    import type { Receipt } from "$lib/types";
    import { getReceiptFlags } from "$lib/utils/receiptFlags";

    let showDocViewer = false;
    let receipt: Receipt | null = null;
    let loading = true;
    let error: string | null = null;

    $: receiptId = $page.params.id;
    $: receiptCurrency = (receipt?.currency ?? "HKD") as SupportedCurrency;
    $: receiptFlags = receipt ? getReceiptFlags(receipt) : [];

    function getStatusClasses(status: Receipt["status"]) {
        switch (status) {
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

    onMount(async () => {
        try {
            const res = await fetch(`/api/receipts/${receiptId}`);
            if (res.ok) {
                receipt = await res.json();
            } else if (res.status === 404) {
                error = "Receipt not found";
            } else {
                const errorData = await res.json().catch(() => ({}));
                error = errorData.error || "Failed to load receipt";
            }
        } catch (err) {
            console.error("Error loading receipt:", err);
            error = "Failed to load receipt";
        } finally {
            loading = false;
        }
    });

    async function handleDelete() {
        if (!confirm("Are you sure you want to delete this receipt?")) return;

        try {
            const res = await fetch(`/api/receipts/${receiptId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                goto("/receipts");
            } else {
                alert("Failed to delete receipt");
            }
        } catch (err) {
            alert("Error deleting receipt");
        }
    }
</script>

<div class="mx-auto max-w-6xl space-y-4 md:space-y-6">
    {#if loading}
        <div class="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div class="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-slate-900"></div>
            <p class="mt-4 text-gray-600">Loading receipt...</p>
        </div>
    {:else if error}
        <div class="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
            {error}
        </div>
    {:else if receipt}
        <section class="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-sm md:px-8 md:py-8">
            <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div class="space-y-4">
                    <a
                        href="/receipts"
                        class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200 hover:bg-white/15"
                    >
                        ← Back to Receipts
                    </a>

                    <div class="flex items-start gap-4">
                        <div
                            class="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-3xl"
                            style="background-color: color-mix(in srgb, {getCategoryColor(receipt.category)} 18%, white 82%);"
                        >
                            {getCategoryIcon(receipt.category)}
                        </div>
                        <div>
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="inline-flex rounded-full px-3 py-1 text-xs font-medium {getStatusClasses(receipt.status)}">
                                    {receipt.status}
                                </span>
                                <span class="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
                                    {getCategoryName(receipt.category)}
                                </span>
                                {#if receipt.taxDeductible}
                                    <span class="inline-flex rounded-full border border-sky-200/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-100">
                                        Tax deductible
                                    </span>
                                {/if}
                            </div>
                            <h1 class="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                                {receipt.vendor || "Unknown vendor"}
                            </h1>
                            <p class="mt-2 text-sm text-slate-300">
                                {receipt.id} · {formatDate(receipt.date, "long")}
                            </p>
                        </div>
                    </div>
                </div>

                <div class="space-y-4 lg:text-right">
                    <div>
                        <div class="text-sm uppercase tracking-[0.18em] text-slate-400">Amount</div>
                        <div class="mt-1 text-4xl font-semibold">
                            {formatCurrency(receipt.amount, { currency: receiptCurrency })}
                        </div>
                        {#if receipt.gstAmount}
                            <div class="mt-1 text-sm text-slate-300">
                                GST {formatCurrency(receipt.gstAmount, { currency: receiptCurrency })}
                            </div>
                        {/if}
                    </div>

                    <div class="flex flex-wrap justify-start gap-2 lg:justify-end">
                        {#if receipt.status === "pending"}
                            <a
                                href="/receipts/approve"
                                class="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"
                            >
                                Open in Approve
                            </a>
                        {/if}
                        <button
                            on:click={() => goto(`/receipts/${receiptId}/edit`)}
                            class="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
                        >
                            Edit Receipt
                        </button>
                        <button
                            on:click={handleDelete}
                            class="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-500/20"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            {#if receiptFlags.length > 0}
                <div class="mt-6 border-t border-white/10 pt-5">
                    <div class="mb-2 text-sm font-medium text-slate-200">Flags</div>
                    <div class="flex flex-wrap gap-2">
                        {#each receiptFlags as flag}
                            <span class="inline-flex rounded-full px-3 py-1 text-xs font-medium {getFlagClasses(flag.level)}">
                                {flag.label}
                            </span>
                        {/each}
                    </div>
                </div>
            {/if}
        </section>

        <div class="grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section class="space-y-4 xl:sticky xl:top-4">
                <div class="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                    <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                        <div>
                            <h2 class="text-lg font-semibold text-slate-900">Original Document</h2>
                            <p class="text-sm text-slate-500">Preview the uploaded receipt beside the accounting details.</p>
                        </div>
                        {#if receipt.receiptImageUrl}
                            <button
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
                                    class="h-[720px] w-full rounded-2xl border border-gray-200 bg-white"
                                ></iframe>
                            {:else}
                                <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white p-3">
                                    <img
                                        src={receipt.receiptImageUrl}
                                        alt="Receipt"
                                        class="max-h-[720px] w-full rounded-xl object-contain"
                                    />
                                </div>
                            {/if}

                            <div class="mt-3 flex justify-end">
                                <a
                                    href={receipt.receiptImageUrl}
                                    download
                                    class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    Download Original
                                </a>
                            </div>
                        {:else}
                            <div class="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center">
                                <div>
                                    <div class="text-5xl">📄</div>
                                    <p class="mt-3 text-sm font-medium text-slate-700">No document attached</p>
                                    <p class="mt-1 text-sm text-slate-500">This receipt record has details but no uploaded file.</p>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            </section>

            <section class="space-y-4">
                {#if receiptFlags.length > 0}
                    <div class="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
                        <h3 class="text-sm font-semibold uppercase tracking-wide text-rose-800">Suspicious or incomplete</h3>
                        <ul class="mt-3 space-y-2 text-sm text-rose-900">
                            {#each receiptFlags as flag}
                                <li>• {flag.detail}</li>
                            {/each}
                        </ul>
                    </div>
                {/if}

                <div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 class="text-lg font-semibold text-slate-900">Quick Facts</h3>
                    <dl class="mt-4 grid gap-4 sm:grid-cols-2">
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <dt class="text-xs uppercase tracking-wide text-slate-500">Category</dt>
                            <dd class="mt-1 font-medium text-slate-900">{getCategoryName(receipt.category)}</dd>
                        </div>
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <dt class="text-xs uppercase tracking-wide text-slate-500">Payment Method</dt>
                            <dd class="mt-1 font-medium capitalize text-slate-900">{receipt.paymentMethod ?? "Not specified"}</dd>
                        </div>
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <dt class="text-xs uppercase tracking-wide text-slate-500">Fiscal Year</dt>
                            <dd class="mt-1 font-medium text-slate-900">FY{receipt.fiscalYear}</dd>
                        </div>
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <dt class="text-xs uppercase tracking-wide text-slate-500">Created</dt>
                            <dd class="mt-1 font-medium text-slate-900">{receipt.createdAt ? formatDate(receipt.createdAt, "medium") : "-"}</dd>
                        </div>
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <dt class="text-xs uppercase tracking-wide text-slate-500">Updated</dt>
                            <dd class="mt-1 font-medium text-slate-900">{receipt.updatedAt ? formatDate(receipt.updatedAt, "medium") : "-"}</dd>
                        </div>
                        <div class="rounded-2xl bg-slate-50 p-4">
                            <dt class="text-xs uppercase tracking-wide text-slate-500">Receipt ID</dt>
                            <dd class="mt-1 break-all font-mono text-sm text-slate-900">{receipt.id}</dd>
                        </div>
                    </dl>
                </div>

                <div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 class="text-lg font-semibold text-slate-900">Business Context</h3>
                    <dl class="mt-4 space-y-4 text-sm text-slate-700">
                        <div>
                            <dt class="text-xs uppercase tracking-wide text-slate-500">Business Purpose</dt>
                            <dd class="mt-1 text-base text-slate-900">{receipt.auditInfo?.businessPurpose || "Not provided"}</dd>
                        </div>
                        <div class="grid gap-4 sm:grid-cols-2">
                            <div>
                                <dt class="text-xs uppercase tracking-wide text-slate-500">Project Code</dt>
                                <dd class="mt-1 text-slate-900">{receipt.auditInfo?.projectCode || "-"}</dd>
                            </div>
                            <div>
                                <dt class="text-xs uppercase tracking-wide text-slate-500">Location</dt>
                                <dd class="mt-1 text-slate-900">{receipt.auditInfo?.location || "-"}</dd>
                            </div>
                            <div>
                                <dt class="text-xs uppercase tracking-wide text-slate-500">Attendees</dt>
                                <dd class="mt-1 text-slate-900">{receipt.auditInfo?.attendees || "-"}</dd>
                            </div>
                            <div>
                                <dt class="text-xs uppercase tracking-wide text-slate-500">Travel / Meal</dt>
                                <dd class="mt-1 text-slate-900">
                                    {#if receipt.auditInfo?.travelRelated}
                                        Travel-related
                                    {:else if receipt.auditInfo?.businessMeal}
                                        Business meal
                                    {:else}
                                        Not tagged
                                    {/if}
                                </dd>
                            </div>
                        </div>
                    </dl>
                </div>

                {#if receipt.notes}
                    <div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h3 class="text-lg font-semibold text-slate-900">Notes</h3>
                        <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{receipt.notes}</p>
                    </div>
                {/if}

                {#if receipt.ocrData?.confidence || receipt.ocrData?.rawText}
                    <div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h3 class="text-lg font-semibold text-slate-900">Extraction Details</h3>
                        <div class="mt-4 space-y-3 text-sm text-slate-700">
                            {#if receipt.ocrData?.confidence}
                                <div>
                                    <span class="text-xs uppercase tracking-wide text-slate-500">Confidence</span>
                                    <div class="mt-1 font-medium text-slate-900">{Math.round(receipt.ocrData.confidence * 100)}%</div>
                                </div>
                            {/if}
                            {#if receipt.ocrData?.rawText}
                                <div>
                                    <span class="text-xs uppercase tracking-wide text-slate-500">Raw OCR text</span>
                                    <pre class="mt-2 max-h-52 overflow-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-700 whitespace-pre-wrap">{receipt.ocrData.rawText}</pre>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </section>
        </div>
    {/if}
</div>

{#if receipt?.receiptImageUrl}
    <DocumentViewer
        bind:show={showDocViewer}
        url={receipt.receiptImageUrl}
        title={`Receipt ${receipt.id}`}
    />
{/if}
