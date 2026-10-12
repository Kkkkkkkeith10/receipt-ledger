<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { DEFAULT_CATEGORIES } from "$lib/categories";
    import type { Currency, Receipt } from "$lib/types";
    import { formatCurrency } from "$lib/utils/format";
    import type { SupportedCurrency } from "$lib/utils/format";
    import {
        getReceiptBlockingIssues,
        getReceiptFlags,
        isReceiptSuspicious,
    } from "$lib/utils/receiptFlags";

    const CURRENCIES: Currency[] = [
        "HKD",
        "JPY",
        "TWD",
        "USD",
        "CNY",
        "EUR",
        "GBP",
    ];

    let pendingReceipts: Receipt[] = [];
    let loading = true;
    let currentIndex = 0;
    let processing = false;
    let saveError = "";

    $: currentReceipt = pendingReceipts[currentIndex] ?? null;
    $: currentAuditInfo = currentReceipt?.auditInfo ?? null;
    $: remaining = Math.max(pendingReceipts.length - currentIndex, 0);
    $: currentFlags = currentReceipt ? getReceiptFlags(currentReceipt) : [];
    $: blockingIssues = currentReceipt
        ? getReceiptBlockingIssues(currentReceipt)
        : [];
    $: suspiciousQueueCount = pendingReceipts.filter((receipt) =>
        isReceiptSuspicious(receipt),
    ).length;
    $: progressPercent = pendingReceipts.length
        ? ((currentIndex + 1) / pendingReceipts.length) * 100
        : 0;

    function formatAmount(amount: number, currency?: string) {
        const curr = (currency ?? "HKD") as SupportedCurrency;
        return formatCurrency(amount, { currency: curr });
    }

    function getCategoryName(categoryId: string) {
        return (
            DEFAULT_CATEGORIES.find((category) => category.id === categoryId)
                ?.name ?? categoryId
        );
    }

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
        await loadPendingReceipts();
    });

    async function loadPendingReceipts() {
        loading = true;
        try {
            const res = await fetch(
                "/api/receipts?status=pending&limit=100000",
            );
            if (res.ok) {
                const data = await res.json();
                const receipts = (data.receipts ?? data ?? []) as Receipt[];
                pendingReceipts = receipts.map((receipt) => ({
                    ...receipt,
                    auditInfo: {
                        businessPurpose:
                            receipt.auditInfo?.businessPurpose ?? "",
                        projectCode: receipt.auditInfo?.projectCode ?? "",
                        location: receipt.auditInfo?.location ?? "",
                        attendees: receipt.auditInfo?.attendees ?? "",
                        businessMeal: receipt.auditInfo?.businessMeal ?? false,
                        travelRelated:
                            receipt.auditInfo?.travelRelated ?? false,
                    },
                }));
            }
        } catch (err) {
            console.error("Failed to load pending receipts:", err);
            saveError = "Failed to load pending receipts.";
        } finally {
            loading = false;
        }
    }

    function buildPayload(receipt: Receipt, status: Receipt["status"]) {
        return {
            vendor: receipt.vendor,
            amount: Number(receipt.amount),
            currency: receipt.currency ?? "HKD",
            date: receipt.date,
            category: receipt.category,
            status,
            taxDeductible: receipt.taxDeductible,
            paymentMethod: receipt.paymentMethod || undefined,
            receiptImageUrl: receipt.receiptImageUrl ?? null,
            receiptImageKey: receipt.receiptImageKey,
            notes: receipt.notes || "",
            auditInfo: {
                businessPurpose: receipt.auditInfo?.businessPurpose || "",
                projectCode: receipt.auditInfo?.projectCode || "",
                location: receipt.auditInfo?.location || "",
                attendees: receipt.auditInfo?.attendees || "",
                businessMeal: receipt.auditInfo?.businessMeal ?? false,
                travelRelated: receipt.auditInfo?.travelRelated ?? false,
            },
        };
    }

    function validateCurrentReceipt() {
        if (!currentReceipt) return false;

        const issues = getReceiptBlockingIssues(currentReceipt);
        if (issues.length > 0) {
            saveError = issues.join(" ");
            return false;
        }

        return true;
    }

    async function approveReceipt() {
        if (!currentReceipt || processing || !validateCurrentReceipt()) return;

        saveError = "";
        processing = true;

        try {
            const res = await fetch(`/api/receipts/${currentReceipt.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload(currentReceipt, "approved")),
            });

            if (res.ok) {
                moveToNext();
            } else {
                const txt = await res.text();
                saveError = `Failed to approve: ${txt}`;
            }
        } catch (err) {
            saveError =
                err instanceof Error ? err.message : "Error approving receipt";
        } finally {
            processing = false;
        }
    }

    async function rejectReceipt() {
        if (!currentReceipt || processing) return;

        const reason = prompt("Rejection reason (optional):");
        saveError = "";
        processing = true;

        try {
            const updatedNotes = reason
                ? `Rejected: ${reason}`
                : currentReceipt.notes;
            const payload = buildPayload(
                { ...currentReceipt, notes: updatedNotes },
                "rejected",
            );
            const res = await fetch(`/api/receipts/${currentReceipt.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                moveToNext();
            } else {
                const txt = await res.text();
                saveError = `Failed to reject: ${txt}`;
            }
        } catch (err) {
            saveError =
                err instanceof Error ? err.message : "Error rejecting receipt";
        } finally {
            processing = false;
        }
    }

    async function saveEdits() {
        if (!currentReceipt || processing || !validateCurrentReceipt()) return;

        saveError = "";
        processing = true;
        try {
            const res = await fetch(`/api/receipts/${currentReceipt.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload(currentReceipt, "pending")),
            });
            if (!res.ok) {
                const txt = await res.text();
                saveError = `Save failed: ${txt}`;
            }
        } catch (err) {
            saveError =
                err instanceof Error ? err.message : "Error saving receipt";
        } finally {
            processing = false;
        }
    }

    function skipReceipt() {
        moveToNext();
    }

    function moveToNext() {
        saveError = "";
        if (currentIndex < pendingReceipts.length - 1) {
            currentIndex += 1;
        } else {
            pendingReceipts = [];
            currentIndex = 0;
        }
    }

    function goToPrev() {
        if (currentIndex > 0) {
            saveError = "";
            currentIndex -= 1;
        }
    }

    async function approveAll() {
        if (!confirm(`Approve all ${remaining} pending receipts as-is?`)) {
            return;
        }

        processing = true;
        let approved = 0;
        let skipped = 0;

        for (let index = currentIndex; index < pendingReceipts.length; index += 1) {
            const receipt = pendingReceipts[index];
            if (getReceiptBlockingIssues(receipt).length > 0) {
                skipped += 1;
                continue;
            }

            try {
                const res = await fetch(`/api/receipts/${receipt.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(buildPayload(receipt, "approved")),
                });
                if (res.ok) approved += 1;
            } catch (err) {
                console.error(`Failed to approve ${receipt.id}:`, err);
            }
        }

        alert(
            skipped > 0
                ? `Approved ${approved} receipts. Skipped ${skipped} receipts that still need fixes.`
                : `Approved ${approved} receipts.`,
        );
        pendingReceipts = [];
        currentIndex = 0;
        processing = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (processing || !currentReceipt) return;

        const target = e.target as HTMLElement | null;
        if (
            target &&
            (target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT" ||
                target.isContentEditable)
        ) {
            return;
        }

        if (e.key === "a" || e.key === "A") approveReceipt();
        if (e.key === "r" || e.key === "R") rejectReceipt();
        if (e.key === "s" || e.key === "S") skipReceipt();
    }
</script>

<div class="mx-auto max-w-7xl space-y-4 md:space-y-6">
    <section
        class="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-6 py-6 text-white shadow-sm md:px-8 md:py-8"
    >
        <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div class="space-y-3">
                <div class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-200">
                    Approval Workspace
                </div>
                <div>
                    <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">
                        Review, fix, and approve receipts faster
                    </h1>
                    <p class="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
                        Edit the extracted fields beside the original document, and catch suspicious entries like zero-dollar amounts before they hit approval.
                    </p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div class="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                    <div class="text-xs uppercase tracking-wide text-slate-300">Queue</div>
                    <div class="mt-1 text-2xl font-semibold">{pendingReceipts.length}</div>
                </div>
                <div class="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                    <div class="text-xs uppercase tracking-wide text-slate-300">Suspicious</div>
                    <div class="mt-1 text-2xl font-semibold text-rose-200">{suspiciousQueueCount}</div>
                </div>
                <div class="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur col-span-2 sm:col-span-1">
                    <div class="text-xs uppercase tracking-wide text-slate-300">Shortcuts</div>
                    <div class="mt-1 text-sm font-medium text-slate-100">A approve · R reject · S skip</div>
                </div>
            </div>
        </div>
    </section>

    {#if loading}
        <div class="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div class="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p class="mt-4 text-gray-600">Loading pending receipts...</p>
        </div>
    {:else if pendingReceipts.length === 0}
        <div class="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div class="mb-4 text-6xl">✅</div>
            <h2 class="text-2xl font-semibold text-gray-900">All caught up</h2>
            <p class="mt-2 text-gray-600">No pending receipts need review right now.</p>
            <button
                on:click={() => goto("/receipts")}
                class="mt-6 inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
                Back to Receipts
            </button>
        </div>
    {:else if currentReceipt && currentAuditInfo}
        <div class="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
            <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p class="text-sm font-medium text-slate-600">
                        Receipt {currentIndex + 1} of {pendingReceipts.length}
                    </p>
                    <p class="text-xs text-slate-500">{remaining} remaining in queue</p>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-sm">
                    <button
                        on:click={() => goto("/receipts")}
                        class="rounded-xl border border-gray-200 px-4 py-2 text-slate-600 hover:bg-gray-50"
                    >
                        Back to list
                    </button>
                    {#if remaining > 1}
                        <button
                            on:click={approveAll}
                            disabled={processing}
                            class="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                            Approve All Ready
                        </button>
                    {/if}
                </div>
            </div>
            <div class="h-2 w-full rounded-full bg-slate-100">
                <div
                    class="h-2 rounded-full bg-slate-900 transition-all duration-300"
                    style="width: {progressPercent}%"
                ></div>
            </div>
        </div>

        <div class="grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section class="space-y-4 xl:sticky xl:top-4">
                <div class="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                    <div class="border-b border-gray-200 px-5 py-4">
                        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="inline-flex rounded-full px-3 py-1 text-xs font-medium {getStatusClasses(currentReceipt.status)}">
                                        {currentReceipt.status}
                                    </span>
                                    <span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                                        {getCategoryName(currentReceipt.category)}
                                    </span>
                                    {#if currentFlags.some((flag) => flag.level === "suspicious")}
                                        <span class="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                                            Suspicious
                                        </span>
                                    {/if}
                                </div>
                                <h2 class="mt-3 text-2xl font-semibold text-slate-900">
                                    {currentReceipt.vendor || "Unknown vendor"}
                                </h2>
                                <p class="mt-1 text-sm text-slate-500">
                                    {currentReceipt.id} · {currentReceipt.date || "No date"}
                                </p>
                            </div>
                            <div class="text-left md:text-right">
                                <div class="text-3xl font-semibold text-slate-900">
                                    {formatAmount(currentReceipt.amount, currentReceipt.currency)}
                                </div>
                                <p class="mt-1 text-sm text-slate-500">Live preview</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-slate-50 p-4">
                        {#if currentReceipt.receiptImageUrl}
                            {#if currentReceipt.receiptImageUrl.endsWith(".pdf")}
                                <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                                    <iframe
                                        src={currentReceipt.receiptImageUrl}
                                        title="Receipt PDF"
                                        class="h-[640px] w-full"
                                    ></iframe>
                                </div>
                                <div class="mt-3 flex justify-end">
                                    <a
                                        href={currentReceipt.receiptImageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                        Open PDF in new tab
                                    </a>
                                </div>
                            {:else}
                                <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white p-3">
                                    <img
                                        src={currentReceipt.receiptImageUrl}
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
                                    <p class="mt-1 text-sm text-slate-500">This receipt needs an attachment before filing is complete.</p>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            </section>

            <section class="space-y-4">
                {#if currentFlags.length > 0}
                    <div class="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
                        <div class="flex items-start gap-3">
                            <div class="text-2xl">🚩</div>
                            <div class="space-y-3">
                                <div>
                                    <h3 class="font-semibold text-rose-900">Checks to review</h3>
                                    <p class="text-sm text-rose-700">
                                        Suspicious flags are highlighted first so you can correct them before approval.
                                    </p>
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    {#each currentFlags as flag}
                                        <span class="inline-flex rounded-full px-3 py-1 text-xs font-medium {getFlagClasses(flag.level)}">
                                            {flag.label}
                                        </span>
                                    {/each}
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}

                {#if blockingIssues.length > 0 || saveError}
                    <div class="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                        <h3 class="text-sm font-semibold uppercase tracking-wide text-amber-800">Needs fixes before save or approve</h3>
                        {#if blockingIssues.length > 0}
                            <ul class="mt-3 space-y-2 text-sm text-amber-900">
                                {#each blockingIssues as issue}
                                    <li>• {issue}</li>
                                {/each}
                            </ul>
                        {/if}
                        {#if saveError}
                            <p class="mt-3 text-sm text-rose-700">{saveError}</p>
                        {/if}
                    </div>
                {/if}

                <div class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div class="mb-5 flex items-center justify-between">
                        <div>
                            <h3 class="text-lg font-semibold text-slate-900">Editable fields</h3>
                            <p class="text-sm text-slate-500">Fix the extracted values directly beside the document.</p>
                        </div>
                        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Live form</span>
                    </div>

                    <div class="grid gap-4 md:grid-cols-2">
                        <label class="block">
                            <span class="mb-1 block text-sm font-medium text-slate-700">Vendor</span>
                            <input
                                id="approve-vendor"
                                type="text"
                                bind:value={currentReceipt.vendor}
                                class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            />
                        </label>

                        <label class="block">
                            <span class="mb-1 block text-sm font-medium text-slate-700">Date</span>
                            <input
                                id="approve-date"
                                type="date"
                                bind:value={currentReceipt.date}
                                class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            />
                        </label>

                        <label class="block md:col-span-2">
                            <span class="mb-1 block text-sm font-medium text-slate-700">Amount</span>
                            <div class="grid gap-3 sm:grid-cols-[1fr_140px]">
                                <input
                                    id="approve-amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    bind:value={currentReceipt.amount}
                                    class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg font-semibold text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                />
                                <select
                                    id="approve-currency"
                                    bind:value={currentReceipt.currency}
                                    class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                >
                                    {#each CURRENCIES as currency}
                                        <option value={currency}>{currency}</option>
                                    {/each}
                                </select>
                            </div>
                            <p class="mt-2 text-xs text-slate-500">
                                Preview: {formatAmount(currentReceipt.amount, currentReceipt.currency)}
                            </p>
                        </label>

                        <label class="block">
                            <span class="mb-1 block text-sm font-medium text-slate-700">Category</span>
                            <select
                                id="approve-category"
                                bind:value={currentReceipt.category}
                                class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            >
                                {#each DEFAULT_CATEGORIES as category}
                                    <option value={category.id}>{category.name}</option>
                                {/each}
                            </select>
                        </label>

                        <label class="flex items-center gap-3 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 md:self-end">
                            <input
                                id="approve-tax"
                                type="checkbox"
                                bind:checked={currentReceipt.taxDeductible}
                                class="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-500"
                            />
                            <span>
                                <span class="block text-sm font-medium text-slate-700">Tax deductible</span>
                                <span class="block text-xs text-slate-500">Toggle if this expense can be claimed.</span>
                            </span>
                        </label>

                        <label class="block md:col-span-2">
                            <span class="mb-1 block text-sm font-medium text-slate-700">Business Purpose</span>
                            <input
                                id="approve-purpose"
                                type="text"
                                bind:value={currentAuditInfo.businessPurpose}
                                placeholder="e.g. Client lunch - Project X"
                                class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            />
                        </label>

                        <label class="block">
                            <span class="mb-1 block text-sm font-medium text-slate-700">Project Code</span>
                            <input
                                type="text"
                                bind:value={currentAuditInfo.projectCode}
                                placeholder="Optional"
                                class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            />
                        </label>

                        <label class="block">
                            <span class="mb-1 block text-sm font-medium text-slate-700">Location</span>
                            <input
                                type="text"
                                bind:value={currentAuditInfo.location}
                                placeholder="Optional"
                                class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            />
                        </label>

                        <label class="block md:col-span-2">
                            <span class="mb-1 block text-sm font-medium text-slate-700">Notes</span>
                            <textarea
                                id="approve-notes"
                                rows="4"
                                bind:value={currentReceipt.notes}
                                class="w-full rounded-2xl border border-gray-300 px-4 py-3 text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            ></textarea>
                        </label>
                    </div>
                </div>

                <div class="rounded-3xl border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
                    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div class="text-sm font-medium text-slate-200">Actions</div>
                            <div class="text-xs text-slate-400">Reject can be used even when the receipt still has suspicious fields.</div>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <button
                                on:click={goToPrev}
                                disabled={processing || currentIndex === 0}
                                class="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <button
                                on:click={skipReceipt}
                                disabled={processing}
                                class="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                            >
                                Skip
                            </button>
                            <button
                                on:click={rejectReceipt}
                                disabled={processing}
                                class="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                                Reject
                            </button>
                            <button
                                on:click={saveEdits}
                                disabled={processing || blockingIssues.length > 0}
                                class="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                            >
                                Save
                            </button>
                            <button
                                on:click={approveReceipt}
                                disabled={processing || blockingIssues.length > 0}
                                class="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                            >
                                Approve
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    {/if}
</div>

<svelte:window on:keydown={handleKeydown} />
