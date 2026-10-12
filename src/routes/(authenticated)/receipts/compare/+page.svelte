<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import type { Receipt } from "$lib/types";
    import { formatCurrency } from "$lib/utils/format";
    import type { SupportedCurrency } from "$lib/utils/format";

    let clusters: string[][] = [];
    let clusterIndex = 0;
    let receipts: Receipt[] = [];
    let loading = true;
    let processing = false;
    let errorMsg = "";

    $: currentCluster = clusters[clusterIndex] ?? [];
    $: liveReceipts = currentCluster
        .map((id) => receipts.find((r) => r.id === id))
        .filter((r): r is Receipt => Boolean(r));
    $: totalClusters = clusters.length;

    function loadClustersFromSession(): string[][] {
        if (typeof sessionStorage === "undefined") return [];
        const raw = sessionStorage.getItem("duplicateClusters");
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            if (
                Array.isArray(parsed) &&
                parsed.every((c) => Array.isArray(c))
            ) {
                return parsed as string[][];
            }
        } catch {
            // ignore
        }
        return [];
    }

    onMount(async () => {
        clusters = loadClustersFromSession();
        if (clusters.length === 0) {
            loading = false;
            return;
        }
        await loadReceiptsForCluster();
    });

    async function loadReceiptsForCluster() {
        loading = true;
        errorMsg = "";
        const ids = clusters[clusterIndex] ?? [];
        try {
            const fetched = await Promise.all(
                ids.map(async (id) => {
                    const res = await fetch(
                        `/api/receipts/${encodeURIComponent(id)}`,
                    );
                    if (!res.ok) return null;
                    return (await res.json()) as Receipt;
                }),
            );
            receipts = fetched.filter((r): r is Receipt => Boolean(r));
            if (receipts.length < ids.length) {
                errorMsg =
                    "Some receipts in this group could not be loaded — they may have already been deleted.";
            }
        } catch (err) {
            errorMsg =
                err instanceof Error ? err.message : "Failed to load receipts";
        } finally {
            loading = false;
        }
    }

    function formatAmount(amount: number, currency?: string) {
        const curr = (currency ?? "HKD") as SupportedCurrency;
        return formatCurrency(amount, { currency: curr });
    }

    function formatDate(dateStr: string) {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("en-HK", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    async function deleteReceipt(id: string) {
        if (
            !confirm(
                `Delete receipt ${id}? It will be archived (recoverable later).`,
            )
        )
            return;
        processing = true;
        try {
            const res = await fetch(
                `/api/receipts/${encodeURIComponent(id)}`,
                {
                    method: "DELETE",
                },
            );
            if (res.ok) {
                // Remove from current view + from all clusters in session.
                receipts = receipts.filter((r) => r.id !== id);
                clusters = clusters
                    .map((c) => c.filter((cid) => cid !== id))
                    .filter((c) => c.length >= 2);
                if (typeof sessionStorage !== "undefined") {
                    sessionStorage.setItem(
                        "duplicateClusters",
                        JSON.stringify(clusters),
                    );
                }

                // If current cluster is now empty / collapsed, advance.
                if (clusterIndex >= clusters.length) {
                    clusterIndex = Math.max(0, clusters.length - 1);
                }
                if (clusters.length > 0) {
                    await loadReceiptsForCluster();
                }
            } else {
                errorMsg = `Delete failed: ${await res.text()}`;
            }
        } catch (err) {
            errorMsg = err instanceof Error ? err.message : "Delete error";
        } finally {
            processing = false;
        }
    }

    /** Keep one receipt — delete all others in this cluster. */
    async function keepOnly(id: string) {
        if (!confirm(`Keep ${id} and delete the other(s) in this group?`))
            return;
        processing = true;
        try {
            const others = currentCluster.filter((cid) => cid !== id);
            for (const other of others) {
                const res = await fetch(
                    `/api/receipts/${encodeURIComponent(other)}`,
                    { method: "DELETE" },
                );
                if (!res.ok) {
                    errorMsg = `Could not delete ${other}: ${await res.text()}`;
                }
            }
            // Drop the cluster entirely.
            clusters.splice(clusterIndex, 1);
            clusters = [...clusters];
            if (typeof sessionStorage !== "undefined") {
                sessionStorage.setItem(
                    "duplicateClusters",
                    JSON.stringify(clusters),
                );
            }
            if (clusters.length === 0) {
                receipts = [];
            } else {
                if (clusterIndex >= clusters.length) {
                    clusterIndex = clusters.length - 1;
                }
                await loadReceiptsForCluster();
            }
        } catch (err) {
            errorMsg = err instanceof Error ? err.message : "Error";
        } finally {
            processing = false;
        }
    }

    async function nextCluster() {
        if (clusterIndex < clusters.length - 1) {
            clusterIndex++;
            await loadReceiptsForCluster();
        }
    }

    async function prevCluster() {
        if (clusterIndex > 0) {
            clusterIndex--;
            await loadReceiptsForCluster();
        }
    }

    /** Mark this cluster as "not duplicates" — drop it from the queue without deleting anything. */
    function notDuplicates() {
        clusters.splice(clusterIndex, 1);
        clusters = [...clusters];
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(
                "duplicateClusters",
                JSON.stringify(clusters),
            );
        }
        if (clusters.length === 0) {
            receipts = [];
        } else {
            if (clusterIndex >= clusters.length) {
                clusterIndex = clusters.length - 1;
            }
            loadReceiptsForCluster();
        }
    }
</script>

<div class="max-w-7xl mx-auto space-y-4 md:space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4">
        <div>
            <h1 class="text-2xl md:text-3xl font-bold text-gray-900">
                Compare Duplicates
            </h1>
            <p class="text-sm text-gray-600 mt-1">
                Review receipts that look like duplicates and decide what to
                keep.
            </p>
        </div>
        <button
            on:click={() => goto("/receipts")}
            class="px-4 py-2 text-gray-600 hover:text-gray-900"
        >
            ← Back to Receipts
        </button>
    </div>

    {#if loading}
        <div
            class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
        >
            <div
                class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"
            ></div>
            <p class="mt-4 text-gray-600">Loading…</p>
        </div>
    {:else if clusters.length === 0}
        <div
            class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
        >
            <div class="text-6xl mb-4">✅</div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">
                Nothing to Compare
            </h2>
            <p class="text-gray-600 mb-6">
                Run "Check Duplicates" on the Receipts page first.
            </p>
            <button
                on:click={() => goto("/receipts")}
                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
                Back to Receipts
            </button>
        </div>
    {:else}
        <!-- Progress -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-600">
                    Group {clusterIndex + 1} of {totalClusters}
                </span>
                <span class="text-sm font-medium text-amber-600">
                    {liveReceipts.length} receipts in this group
                </span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                    class="bg-amber-500 h-2 rounded-full transition-all duration-300"
                    style="width: {((clusterIndex + 1) / totalClusters) * 100}%"
                ></div>
            </div>
        </div>

        {#if errorMsg}
            <div
                class="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm"
            >
                {errorMsg}
            </div>
        {/if}

        <!-- Side-by-side cards -->
        {#if liveReceipts.length > 0}
            <div
                class="grid gap-4"
                style="grid-template-columns: repeat({Math.min(
                    liveReceipts.length,
                    3,
                )}, minmax(0, 1fr));"
            >
                {#each liveReceipts as r}
                    <div
                        class="bg-white rounded-xl shadow-sm border-2 border-amber-200 overflow-hidden flex flex-col"
                    >
                        <!-- Image / PDF -->
                        <div
                            class="bg-gray-50 p-3 flex items-center justify-center min-h-[260px]"
                        >
                            {#if r.receiptImageUrl}
                                {#if r.receiptImageUrl.endsWith(".pdf")}
                                    <iframe
                                        src={r.receiptImageUrl}
                                        title="Receipt PDF"
                                        class="w-full h-[320px] rounded-lg border bg-white"
                                    ></iframe>
                                {:else}
                                    <img
                                        src={r.receiptImageUrl}
                                        alt="Receipt"
                                        class="max-h-[320px] max-w-full object-contain rounded-lg shadow-sm"
                                    />
                                {/if}
                            {:else}
                                <div class="text-center text-gray-400">
                                    <span class="text-5xl">📄</span>
                                    <p class="mt-2 text-sm">No image</p>
                                </div>
                            {/if}
                        </div>

                        <!-- Details -->
                        <div class="p-4 space-y-2 flex-1">
                            <div>
                                <p class="text-xs text-gray-500">Receipt ID</p>
                                <p class="font-mono text-sm text-gray-900">
                                    {r.id}
                                </p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-500">Vendor</p>
                                <p class="text-base font-semibold text-gray-900">
                                    {r.vendor}
                                </p>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <p class="text-xs text-gray-500">Amount</p>
                                    <p
                                        class="text-lg font-bold text-green-600"
                                    >
                                        {formatAmount(r.amount, r.currency)}
                                    </p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500">Date</p>
                                    <p class="text-sm text-gray-900">
                                        {formatDate(r.date)}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <p class="text-xs text-gray-500">Category</p>
                                <p class="text-sm text-gray-900">
                                    {r.categoryName || r.category}
                                </p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-500">Status</p>
                                <p class="text-sm text-gray-900 capitalize">
                                    {r.status}
                                </p>
                            </div>
                            {#if r.auditInfo?.businessPurpose}
                                <div>
                                    <p class="text-xs text-gray-500">
                                        Business Purpose
                                    </p>
                                    <p class="text-sm text-gray-900">
                                        {r.auditInfo.businessPurpose}
                                    </p>
                                </div>
                            {/if}
                            {#if r.notes}
                                <div>
                                    <p class="text-xs text-gray-500">Notes</p>
                                    <p class="text-sm text-gray-700">
                                        {r.notes}
                                    </p>
                                </div>
                            {/if}
                            {#if r.createdAt}
                                <div>
                                    <p class="text-xs text-gray-500">
                                        Created
                                    </p>
                                    <p class="text-xs text-gray-600">
                                        {new Date(r.createdAt).toLocaleString(
                                            "en-HK",
                                        )}
                                    </p>
                                </div>
                            {/if}
                        </div>

                        <!-- Per-card actions -->
                        <div
                            class="border-t border-gray-200 p-3 bg-gray-50 flex flex-wrap gap-2 justify-between"
                        >
                            <a
                                href={`/receipts/${r.id}`}
                                class="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                            >
                                Open
                            </a>
                            <button
                                on:click={() => keepOnly(r.id)}
                                disabled={processing}
                                class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                title="Keep this one and delete the rest in this group"
                            >
                                ✓ Keep this
                            </button>
                            <button
                                on:click={() => deleteReceipt(r.id)}
                                disabled={processing}
                                class="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                            >
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div
                class="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500"
            >
                No receipts in this group could be loaded.
            </div>
        {/if}

        <!-- Cluster navigation -->
        <div
            class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3"
        >
            <button
                on:click={prevCluster}
                disabled={processing || clusterIndex === 0}
                class="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
            >
                ← Prev group
            </button>
            <button
                on:click={notDuplicates}
                disabled={processing}
                class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium"
            >
                Not duplicates — skip group
            </button>
            <button
                on:click={nextCluster}
                disabled={processing || clusterIndex >= clusters.length - 1}
                class="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
            >
                Next group →
            </button>
        </div>
    {/if}
</div>
