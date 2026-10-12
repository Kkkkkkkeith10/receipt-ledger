<script lang="ts">
  import { onMount } from "svelte";
  import { getCategoryName } from "$lib/categories";
  import type { Receipt } from "$lib/types";
  import { formatCurrency } from "$lib/utils/format";
  import type { SupportedCurrency } from "$lib/utils/format";

  let recentReceipts: Receipt[] = [];
  let loading = true;

  onMount(async () => {
    try {
      const res = await fetch("/api/receipts?limit=5");
      if (res.ok) {
        const data = await res.json();
        recentReceipts = data.receipts ?? data ?? [];
      }
    } catch (err) {
      console.error("Failed to load recent receipts:", err);
    } finally {
      loading = false;
    }
  });

  function getStatusColor(status: string) {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-HK", {
      month: "short",
      day: "numeric",
    });
  }

  function formatAmount(amount: number, currency?: string) {
    const curr = (currency ?? "HKD") as SupportedCurrency;
    return formatCurrency(amount, { currency: curr });
  }
</script>

<div class="space-y-4">
  {#if loading}
    <div class="text-center py-4 text-gray-500">Loading...</div>
  {:else if recentReceipts.length === 0}
    <div class="text-center py-4 text-gray-500">
      <p>No receipts yet</p>
      <a href="/receipts" class="text-blue-600 hover:text-blue-700 text-sm"
        >Upload your first receipt →</a
      >
    </div>
  {:else}
    {#each recentReceipts as receipt}
      <a href="/receipts/{receipt.id}" class="block">
        <div
          class="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-center space-x-3">
            <div
              class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"
            >
              <span class="text-blue-600 text-sm">🧾</span>
            </div>
            <div>
              <p class="font-medium text-gray-900">{receipt.vendor}</p>
              <p class="text-sm text-gray-600">
                {getCategoryName(receipt.category)} • {formatDate(receipt.date)}
              </p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-semibold text-gray-900">
              {formatAmount(receipt.amount, receipt.currency)}
            </p>
            <span
              class="inline-block px-2 py-1 text-xs font-medium rounded-full {getStatusColor(
                receipt.status,
              )}"
            >
              {receipt.status}
            </span>
          </div>
        </div>
      </a>
    {/each}
  {/if}

  <div class="text-center pt-2">
    <a
      href="/receipts"
      class="text-blue-600 hover:text-blue-700 text-sm font-medium"
    >
      View all receipts →
    </a>
  </div>
</div>
