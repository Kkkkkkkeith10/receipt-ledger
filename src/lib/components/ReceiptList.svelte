<script lang="ts">
  import { goto } from "$app/navigation";
  import { createEventDispatcher } from "svelte";
  import type { Receipt } from "$lib/types";
  import { formatCurrency, getCurrencySymbol } from "$lib/utils/format";
  import type { SupportedCurrency } from "$lib/utils/format";
  import {
    getReceiptFlags,
    isReceiptSuspicious,
  } from "$lib/utils/receiptFlags";
  import type { ReceiptFlag } from "$lib/utils/receiptFlags";

  export let receipts: Receipt[] = [];
  /** When provided, rows whose IDs are in this set get a duplicate-flag highlight. */
  export let highlightIds: Set<string> = new Set();
  export let selectedIds: Set<string> = new Set();

  const dispatch = createEventDispatcher<{
    delete: string;
    selectiontoggle: string;
    selectiontoggleall: void;
  }>();

  let selectAllCheckbox: HTMLInputElement | null = null;

  $: visibleReceiptIds = receipts.map((receipt) => receipt.id);
  $:
    allVisibleSelected =
      visibleReceiptIds.length > 0 &&
      visibleReceiptIds.every((receiptId) => selectedIds.has(receiptId));
  $:
    someVisibleSelected =
      !allVisibleSelected &&
      visibleReceiptIds.some((receiptId) => selectedIds.has(receiptId));
  $: if (selectAllCheckbox) {
    selectAllCheckbox.indeterminate = someVisibleSelected;
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatAmount(amount: number, currency?: string) {
    const curr = (currency ?? "HKD") as SupportedCurrency;
    return formatCurrency(amount, { currency: curr });
  }

  function getFlagClasses(flag: ReceiptFlag) {
    return flag.level === "suspicious"
      ? "bg-rose-100 text-rose-700 border border-rose-200"
      : "bg-slate-100 text-slate-700 border border-slate-200";
  }

  function getRowClasses(receipt: Receipt) {
    if (highlightIds.has(receipt.id)) {
      return "bg-amber-50/80 border-l-4 border-amber-400";
    }

    if (isReceiptSuspicious(receipt)) {
      return "bg-rose-50/70 border-l-4 border-rose-300";
    }

    return "border-l-4 border-transparent";
  }

  function handleEdit(receiptId: string) {
    goto(`/receipts/${receiptId}/edit`);
  }

  function handleView(receiptId: string) {
    goto(`/receipts/${receiptId}`);
  }

  function handleSelectionToggle(receiptId: string) {
    dispatch("selectiontoggle", receiptId);
  }

  function handleSelectionToggleAll() {
    dispatch("selectiontoggleall");
  }

  async function handleDelete(receiptId: string) {
    if (confirm("Are you sure you want to delete this receipt?")) {
      try {
        const res = await fetch(`/api/receipts/${receiptId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          dispatch("delete", receiptId);
        } else {
          alert("Failed to delete receipt");
        }
      } catch (err) {
        alert("Error deleting receipt");
      }
    }
  }
</script>

{#if receipts.length === 0}
  <div class="p-8 text-center">
    <div
      class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"
    >
      <span class="text-gray-400 text-2xl">🧾</span>
    </div>
    <h3 class="text-lg font-medium text-gray-900 mb-2">No receipts found</h3>
    <p class="text-gray-600">
      Upload your first receipt to get started with expense tracking.
    </p>
  </div>
{:else}
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr>
          <th
            class="w-12 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            <input
              bind:this={selectAllCheckbox}
              type="checkbox"
              checked={allVisibleSelected}
              on:change={handleSelectionToggleAll}
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              aria-label="Select all receipts in the current view"
            />
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            Receipt
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            Vendor
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            Amount
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            Category
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            Status
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            Tax Deductible
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            Actions
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#each receipts as receipt}
          {@const flags = getReceiptFlags(receipt)}
          {@const suspicious = flags.some((flag) => flag.level === "suspicious")}
          <tr
            class="hover:bg-gray-50 transition-colors {getRowClasses(receipt)}"
          >
            <td class="px-4 py-4 align-top text-center">
              <input
                type="checkbox"
                checked={selectedIds.has(receipt.id)}
                on:change={() => handleSelectionToggle(receipt.id)}
                class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-label={`Select receipt ${receipt.id}`}
              />
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center space-x-3">
                <div class="flex-shrink-0 w-10 h-10">
                  {#if receipt.receiptImageUrl}
                    {#if receipt.receiptImageUrl.endsWith(".pdf")}
                      <div
                        class="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center border border-red-200"
                      >
                        <span class="text-red-600 text-xs font-bold">PDF</span>
                      </div>
                    {:else}
                      <img
                        class="w-10 h-10 rounded-lg object-cover border border-gray-200"
                        src={receipt.receiptImageUrl}
                        alt="Receipt"
                      />
                    {/if}
                  {:else}
                    <div
                      class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"
                    >
                      <span class="text-gray-400 text-sm">📄</span>
                    </div>
                  {/if}
                </div>
                <div>
                  <div class="font-medium text-gray-900">{receipt.id}</div>
                  <div class="text-sm text-gray-500">
                    {formatDate(receipt.date)}
                  </div>
                </div>
              </div>
            </td>

            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900">{receipt.vendor}</div>
              <div class="text-sm text-gray-500 truncate max-w-xs">
                {receipt.auditInfo?.businessPurpose ||
                  "No business purpose provided"}
              </div>
              {#if flags.length > 0}
                <div class="mt-2 flex flex-wrap gap-1 max-w-xs">
                  {#each flags.slice(0, 2) as flag}
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium {getFlagClasses(
                        flag,
                      )}"
                    >
                      {flag.label}
                    </span>
                  {/each}
                  {#if flags.length > 2}
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200"
                    >
                      +{flags.length - 2} more
                    </span>
                  {/if}
                </div>
              {/if}
            </td>

            <td class="px-6 py-4 whitespace-nowrap">
              <div
                class="text-sm font-medium {suspicious
                  ? 'text-rose-700'
                  : 'text-gray-900'}"
              >
                {formatAmount(receipt.amount, receipt.currency)}
              </div>
              {#if suspicious}
                <div class="text-xs text-rose-600 mt-1">Suspicious</div>
              {/if}
            </td>

            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900">{receipt.categoryName}</div>
              <div class="text-sm text-gray-500">{receipt.category}</div>
            </td>

            <td class="px-6 py-4 whitespace-nowrap">
              <span
                class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(
                  receipt.status,
                )}"
              >
                {receipt.status}
              </span>
            </td>

            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                {#if receipt.taxDeductible}
                  <span class="text-green-600">✓ Yes</span>
                {:else}
                  <span class="text-red-600">✗ No</span>
                {/if}
              </div>
            </td>

            <td
              class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
            >
              <div class="flex items-center justify-end space-x-2">
                <button
                  on:click={() => handleView(receipt.id)}
                  class="text-blue-600 hover:text-blue-900 transition-colors"
                  title="View Receipt"
                >
                  👁️
                </button>
                <button
                  on:click={() => handleEdit(receipt.id)}
                  class="text-gray-600 hover:text-gray-900 transition-colors"
                  title="Edit Receipt"
                >
                  ✏️
                </button>
                <button
                  on:click={() => handleDelete(receipt.id)}
                  class="text-red-600 hover:text-red-900 transition-colors"
                  title="Delete Receipt"
                >
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
