<script lang="ts">
  import { onMount } from "svelte";
  import { DEFAULT_CATEGORIES, getCategoryName } from "$lib/categories";
  import type { Receipt } from "$lib/types";
  import {
    formatCurrency as formatCurrencyUtil,
    convertToHKD,
    DEFAULT_EXCHANGE_RATES,
    getSupportedCurrencies,
  } from "$lib/utils/format";
  import type { SupportedCurrency } from "$lib/utils/format";

  let receipts: Receipt[] = [];
  let loading = true;
  let error = "";

  // Currency display mode
  let displayMode: "original" | "converted" = "converted";
  let exchangeRates: Record<SupportedCurrency, number> = {
    ...DEFAULT_EXCHANGE_RATES,
  };

  let searchQuery = "";
  let selectedCategory = "";
  let selectedMonth = "";
  let sortField: "date" | "amount" | "vendor" = "date";
  let sortDirection: "asc" | "desc" = "desc";

  $: filteredReceipts = receipts
    .filter((r) => {
      const matchesSearch =
        !searchQuery ||
        r.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        !selectedCategory || r.category === selectedCategory;
      const matchesMonth = !selectedMonth || r.date.startsWith(selectedMonth);
      return matchesSearch && matchesCategory && matchesMonth;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "amount") {
        const amtA =
          displayMode === "converted"
            ? convertToHKD(
                a.amount,
                (a.currency || "HKD") as SupportedCurrency,
                exchangeRates,
              )
            : a.amount;
        const amtB =
          displayMode === "converted"
            ? convertToHKD(
                b.amount,
                (b.currency || "HKD") as SupportedCurrency,
                exchangeRates,
              )
            : b.amount;
        cmp = amtA - amtB;
      } else if (sortField === "vendor") cmp = a.vendor.localeCompare(b.vendor);
      return sortDirection === "desc" ? -cmp : cmp;
    });

  $: totalAmount =
    displayMode === "converted"
      ? filteredReceipts.reduce(
          (sum, r) =>
            sum +
            convertToHKD(
              r.amount,
              (r.currency || "HKD") as SupportedCurrency,
              exchangeRates,
            ),
          0,
        )
      : filteredReceipts.reduce((sum, r) => sum + r.amount, 0);

  $: totalTaxDeductible =
    displayMode === "converted"
      ? filteredReceipts
          .filter((r) => r.taxDeductible)
          .reduce(
            (sum, r) =>
              sum +
              convertToHKD(
                r.amount,
                (r.currency || "HKD") as SupportedCurrency,
                exchangeRates,
              ),
            0,
          )
      : filteredReceipts
          .filter((r) => r.taxDeductible)
          .reduce((sum, r) => sum + r.amount, 0);

  // Generate unique months from receipts
  $: availableMonths = [...new Set(receipts.map((r) => r.date.slice(0, 7)))]
    .sort()
    .reverse();

  onMount(async () => {
    // Load exchange rates from localStorage
    const savedRates = localStorage.getItem("exchangeRates");
    if (savedRates) {
      try {
        exchangeRates = {
          ...DEFAULT_EXCHANGE_RATES,
          ...JSON.parse(savedRates),
        };
      } catch (e) {
        console.error("Failed to parse exchange rates", e);
      }
    }
    const savedMode = localStorage.getItem("currencyDisplayMode");
    if (savedMode === "original" || savedMode === "converted") {
      displayMode = savedMode;
    }
    await loadReceipts();
  });

  function toggleDisplayMode() {
    displayMode = displayMode === "converted" ? "original" : "converted";
    localStorage.setItem("currencyDisplayMode", displayMode);
  }

  async function loadReceipts() {
    loading = true;
    error = "";

    try {
      const res = await fetch("/api/receipts?limit=500");
      if (res.ok) {
        const data = await res.json();
        receipts = data.receipts ?? data ?? [];
      } else {
        error = "Failed to load transactions";
      }
    } catch (err) {
      error = "Error loading transactions";
    } finally {
      loading = false;
    }
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) {
      sortDirection = sortDirection === "desc" ? "asc" : "desc";
    } else {
      sortField = field;
      sortDirection = "desc";
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-HK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatAmount(receipt: Receipt): string {
    if (displayMode === "converted") {
      const converted = convertToHKD(
        receipt.amount,
        (receipt.currency || "HKD") as SupportedCurrency,
        exchangeRates,
      );
      return formatCurrencyUtil(converted, { currency: "HKD" });
    }
    return formatCurrencyUtil(receipt.amount, {
      currency: (receipt.currency || "HKD") as SupportedCurrency,
    });
  }

  function formatTotalAmount(amount: number): string {
    return formatCurrencyUtil(amount, {
      currency: displayMode === "converted" ? "HKD" : undefined,
    });
  }

  function getStatusColor(status: string): string {
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

  async function exportCSV() {
    const headers = [
      "Date",
      "Receipt ID",
      "Vendor",
      "Category",
      "Amount",
      "Tax Deductible",
      "Status",
    ];
    const rows = filteredReceipts.map((r) => [
      r.date,
      r.id,
      `"${r.vendor.replace(/"/g, '""')}"`,
      getCategoryName(r.category),
      r.amount.toString(),
      r.taxDeductible ? "Yes" : "No",
      r.status,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="space-y-4 md:space-y-6">
  <!-- Page Header -->
  <div
    class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
  >
    <div>
      <h1 class="text-2xl md:text-3xl font-bold text-gray-900">Transactions</h1>
      <p class="text-sm md:text-base text-gray-600 mt-1">
        View all expense transactions from receipts
      </p>
    </div>
    <div class="flex flex-wrap gap-2 md:gap-3">
      <button
        on:click={toggleDisplayMode}
        class="px-3 md:px-4 py-2 text-sm rounded-lg transition-colors {displayMode === 'converted' 
          ? 'bg-purple-600 text-white hover:bg-purple-700' 
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
        title={displayMode === 'converted' ? 'Showing amounts in HKD' : 'Showing original currencies'}
      >
        {displayMode === 'converted' ? '💱 HKD' : '🌐 Original'}
      </button>
      <button
        on:click={exportCSV}
        disabled={filteredReceipts.length === 0}
        class="px-3 md:px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
      >
        📊 Export CSV
      </button>
      <a
        href="/receipts"
        class="px-3 md:px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        🧾 Manage Receipts
      </a>
    </div>
  </div>

  <!-- Summary Cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
    <div
      class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4"
    >
      <p class="text-xs md:text-sm text-gray-600">Total Transactions</p>
      <p class="text-lg md:text-2xl font-bold text-gray-900">
        {filteredReceipts.length}
      </p>
    </div>
    <div
      class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4"
    >
      <p class="text-xs md:text-sm text-gray-600">Total Amount {displayMode === 'converted' ? '(HKD)' : ''}</p>
      <p class="text-lg md:text-2xl font-bold text-red-600">
        {formatTotalAmount(totalAmount)}
      </p>
    </div>
    <div
      class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4"
    >
      <p class="text-xs md:text-sm text-gray-600">Tax Deductible {displayMode === 'converted' ? '(HKD)' : ''}</p>
      <p class="text-lg md:text-2xl font-bold text-green-600">
        {formatTotalAmount(totalTaxDeductible)}
      </p>
    </div>
    <div
      class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4"
    >
      <p class="text-xs md:text-sm text-gray-600">Categories</p>
      <p class="text-lg md:text-2xl font-bold text-blue-600">
        {new Set(filteredReceipts.map((r) => r.category)).size}
      </p>
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      <div>
        <label for="search" class="block text-sm font-medium text-gray-700 mb-1"
          >Search</label
        >
        <input
          type="text"
          id="search"
          bind:value={searchQuery}
          placeholder="Vendor or Receipt ID..."
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          for="category"
          class="block text-sm font-medium text-gray-700 mb-1">Category</label
        >
        <select
          id="category"
          bind:value={selectedCategory}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {#each DEFAULT_CATEGORIES as cat}
            <option value={cat.id}>{cat.name}</option>
          {/each}
        </select>
      </div>

      <div>
        <label for="month" class="block text-sm font-medium text-gray-700 mb-1"
          >Month</label
        >
        <select
          id="month"
          bind:value={selectedMonth}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Time</option>
          {#each availableMonths as month}
            <option value={month}
              >{new Date(month + "-01").toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
              })}</option
            >
          {/each}
        </select>
      </div>

      <div class="flex items-end">
        <button
          on:click={() => {
            searchQuery = "";
            selectedCategory = "";
            selectedMonth = "";
          }}
          class="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>
  </div>

  <!-- Transactions Table -->
  {#if loading}
    <div
      class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
    >
      <div
        class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"
      ></div>
      <p class="mt-4 text-gray-600">Loading transactions...</p>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p class="text-red-600">{error}</p>
      <button
        on:click={loadReceipts}
        class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  {:else if filteredReceipts.length === 0}
    <div
      class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
    >
      <div class="text-6xl mb-4">📋</div>
      <h2 class="text-xl font-bold text-gray-900 mb-2">
        No Transactions Found
      </h2>
      <p class="text-gray-600 mb-6">
        {receipts.length === 0
          ? "Upload receipts to create transactions."
          : "Try adjusting your filters."}
      </p>
      {#if receipts.length === 0}
        <a
          href="/receipts"
          class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Upload Receipts
        </a>
      {/if}
    </div>
  {:else}
    <div
      class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
    >
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                on:click={() => toggleSort("date")}
              >
                Date {sortField === "date"
                  ? sortDirection === "desc"
                    ? "↓"
                    : "↑"
                  : ""}
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                Receipt
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                on:click={() => toggleSort("vendor")}
              >
                Vendor {sortField === "vendor"
                  ? sortDirection === "desc"
                    ? "↓"
                    : "↑"
                  : ""}
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                Category
              </th>
              <th
                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                on:click={() => toggleSort("amount")}
              >
                Amount {sortField === "amount"
                  ? sortDirection === "desc"
                    ? "↓"
                    : "↑"
                  : ""}
              </th>
              <th
                class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase"
              >
                Tax
              </th>
              <th
                class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase"
              >
                Status
              </th>
              <th
                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredReceipts as receipt}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(receipt.date)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <a
                    href="/receipts/{receipt.id}"
                    class="text-sm font-mono text-blue-600 hover:text-blue-800"
                  >
                    {receipt.id}
                  </a>
                </td>
                <td class="px-6 py-4">
                  <div
                    class="text-sm font-medium text-gray-900 max-w-xs truncate"
                  >
                    {receipt.vendor}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {getCategoryName(receipt.category)}
                </td>
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900"
                >
                  {formatAmount(receipt)}
                  {#if displayMode === 'converted' && receipt.currency && receipt.currency !== 'HKD'}
                    <span class="text-xs text-gray-400 block">
                      ({formatCurrencyUtil(receipt.amount, { currency: receipt.currency })})
                    </span>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                  {#if receipt.taxDeductible}
                    <span class="text-green-600">✓</span>
                  {:else}
                    <span class="text-gray-400">—</span>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                  <span
                    class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(
                      receipt.status,
                    )}"
                  >
                    {receipt.status}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <a
                    href="/receipts/{receipt.id}"
                    class="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    View →
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Table Footer -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="flex items-center justify-between text-sm text-gray-600">
          <span
            >Showing {filteredReceipts.length} of {receipts.length} transactions</span
          >
          <span class="font-medium">Total: {formatTotalAmount(totalAmount)} {displayMode === 'converted' ? '(HKD)' : ''}</span>
        </div>
      </div>
    </div>
  {/if}
</div>
