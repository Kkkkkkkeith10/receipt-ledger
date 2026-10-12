<script lang="ts">
  import { onMount } from "svelte";
  import { getFiscalYear } from "$lib/utils/fiscal";
  import { formatCurrency as formatCurrencyUtil } from "$lib/utils/format";
  import type { ExpenseReport } from "$lib/types";

  let loading = true;
  let error = "";
  let reportData: ExpenseReport | null = null;

  // Currency display mode
  let displayMode: "original" | "converted" = "converted";

  // HK fiscal year runs April to March
  const currentFY = getFiscalYear();
  let selectedFY = currentFY;
  let availableFYs = [currentFY, currentFY - 1, currentFY - 2];

  let selectedReport = "expense-summary";

  $: categoryRows = reportData?.categoryBreakdown ?? [];
  $: monthlyRows = reportData?.monthlyBreakdown ?? [];
  $: quarterlyRows = reportData?.quarterlyBreakdown ?? [];

  function isExpenseReport(value: unknown): value is ExpenseReport {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<ExpenseReport>;
    return (
      typeof candidate.fiscalYear === "number" &&
      typeof candidate.totalExpenses === "number" &&
      typeof candidate.totalGst === "number" &&
      typeof candidate.totalNetExpenses === "number" &&
      typeof candidate.receiptCount === "number" &&
      typeof candidate.taxDeductibleTotal === "number" &&
      typeof candidate.nonDeductibleTotal === "number" &&
      Array.isArray(candidate.categoryBreakdown) &&
      Array.isArray(candidate.monthlyBreakdown) &&
      Array.isArray(candidate.quarterlyBreakdown)
    );
  }

  const reportTypes = [
    { value: "expense-summary", label: "💰 Expense Summary" },
    { value: "tax-report", label: "🏛️ Tax Deduction Report" },
    { value: "monthly-trends", label: "📈 Monthly Trends" },
    { value: "audit-trail", label: "🔍 Audit Trail Report" },
  ];

  onMount(async () => {
    const savedMode = localStorage.getItem("currencyDisplayMode");
    if (savedMode === "original" || savedMode === "converted") {
      displayMode = savedMode;
    }
    await loadReport();
  });

  function toggleDisplayMode() {
    displayMode = displayMode === "converted" ? "original" : "converted";
    localStorage.setItem("currencyDisplayMode", displayMode);
  }

  async function loadReport() {
    loading = true;
    error = "";

    try {
      const res = await fetch(`/api/reports/${selectedFY}`);
      if (res.ok) {
        const payload = await res.json();
        if (isExpenseReport(payload)) {
          reportData = payload;
        } else {
          reportData = null;
          error = "Report data is unavailable for this fiscal year";
        }
      } else {
        const msg = await res.text();
        error = msg || "Failed to load report";
      }
    } catch (err) {
      error = "Error loading report";
    } finally {
      loading = false;
    }
  }

  function handleFYChange() {
    loadReport();
  }

  async function exportCSV() {
    if (!reportData) return;
    // Delegate to the per-FY report page which has the full financial export.
    window.location.href = `/reports/${selectedFY}?export=csv`;
  }

  // Reports show aggregated data which is already in HKD, so we show as HKD
  function formatCurrency(amount: number): string {
    return formatCurrencyUtil(amount, { currency: 'HKD' });
  }

  function formatPercent(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100 * 10) / 10;
  }
</script>

<div class="space-y-4 md:space-y-6">
  <!-- Page Header -->
  <div
    class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
  >
    <div>
      <h1 class="text-2xl md:text-3xl font-bold text-gray-900">
        Reports & Analytics
      </h1>
      <p class="text-sm md:text-base text-gray-600 mt-1">
        Financial reports for tax preparation (HK fiscal year: Apr - Mar)
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
        disabled={!reportData}
        class="px-3 md:px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
      >
        📊 Export CSV
      </button>
      <a
        href="/reports/{selectedFY}"
        class="px-3 md:px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        📋 Detailed Report
      </a>
    </div>
  </div>

  <!-- Report Configuration -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
    <h3 class="text-lg font-medium text-gray-900 mb-4">Report Configuration</h3>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
      <div>
        <label
          for="report-type"
          class="block text-sm font-medium text-gray-700 mb-1"
        >
          Report Type
        </label>
        <select
          id="report-type"
          bind:value={selectedReport}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {#each reportTypes as type}
            <option value={type.value}>{type.label}</option>
          {/each}
        </select>
      </div>

      <div>
        <label
          for="fiscal-year"
          class="block text-sm font-medium text-gray-700 mb-1"
        >
          Fiscal Year
        </label>
        <select
          id="fiscal-year"
          bind:value={selectedFY}
          on:change={handleFYChange}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {#each availableFYs as fy}
            <option value={fy}>FY{fy} (Apr {fy - 1} - Mar {fy})</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  {#if loading}
    <div
      class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
    >
      <div
        class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"
      ></div>
      <p class="mt-4 text-gray-600">Loading report data...</p>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p class="text-red-600">{error}</p>
      <button
        on:click={loadReport}
        class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  {:else if reportData}
    <!-- Key Financial Metrics -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      <div
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600">Total Expenses</p>
            <p class="text-2xl font-bold text-red-600">
              {formatCurrency(reportData.totalExpenses)}
            </p>
          </div>
          <span class="text-3xl">📤</span>
        </div>
      </div>

      <div
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs md:text-sm text-gray-600">Tax Deductible</p>
            <p class="text-lg md:text-2xl font-bold text-green-600">
              {formatCurrency(reportData.taxDeductibleTotal)}
            </p>
          </div>
          <span class="text-3xl">🏛️</span>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600">Non-Deductible</p>
            <p class="text-2xl font-bold text-gray-600">
              {formatCurrency(reportData.nonDeductibleTotal)}
            </p>
          </div>
          <span class="text-3xl">📋</span>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600">Total Receipts</p>
            <p class="text-2xl font-bold text-blue-600">
              {reportData.receiptCount}
            </p>
          </div>
          <span class="text-3xl">🧾</span>
        </div>
      </div>
    </div>

    <!-- Dynamic Report Content -->
    {#if selectedReport === "expense-summary" || selectedReport === "tax-report"}
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {selectedReport === "tax-report"
            ? "Tax Deduction Summary"
            : "Expense Summary by Category"}
        </h3>

        {#if categoryRows.length === 0}
          <div class="text-center py-8 text-gray-500">
            <p>No expenses recorded for this fiscal year.</p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                    >Category</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                    >Receipts</th
                  >
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                    >Total Amount</th
                  >
                  {#if selectedReport === "tax-report"}
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >GST Paid</th
                    >
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >Net Amount</th
                    >
                  {/if}
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                    >% of Total</th
                  >
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each categoryRows as cat}
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <div class="flex items-center space-x-3">
                        <span class="text-xl">{cat.categoryIcon}</span>
                        <div>
                          <div class="font-medium text-gray-900">
                            {cat.categoryName}
                          </div>
                          <div class="text-sm text-gray-500">{cat.categoryId}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">{cat.receiptCount}</td>
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatCurrency(cat.totalAmount)}
                    </td>
                    {#if selectedReport === "tax-report"}
                      <td class="px-6 py-4 text-sm font-medium text-purple-600">
                        {formatCurrency(cat.gstAmount)}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(cat.netAmount)}
                      </td>
                    {/if}
                    <td class="px-6 py-4">
                      <div class="flex items-center">
                        <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            class="bg-blue-600 h-2 rounded-full"
                            style="width: {formatPercent(
                              cat.totalAmount,
                              reportData.totalExpenses,
                            )}%"
                          ></div>
                        </div>
                        <span class="text-sm text-gray-600"
                          >{formatPercent(
                            cat.totalAmount,
                            reportData.totalExpenses,
                          )}%</span
                        >
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
              <tfoot class="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td class="px-6 py-4 font-bold text-gray-900">Total</td>
                  <td class="px-6 py-4 font-bold text-gray-900"
                    >{reportData.receiptCount}</td
                  >
                  <td class="px-6 py-4 font-bold text-gray-900"
                    >{formatCurrency(reportData.totalExpenses)}</td
                  >
                  {#if selectedReport === "tax-report"}
                    <td class="px-6 py-4 font-bold text-purple-600"
                      >{formatCurrency(reportData.totalGst)}</td
                    >
                    <td class="px-6 py-4 font-bold text-gray-900"
                      >{formatCurrency(reportData.totalNetExpenses)}</td
                    >
                  {/if}
                  <td class="px-6 py-4 font-bold text-gray-900">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        {/if}
      </div>
    {:else if selectedReport === "monthly-trends"}
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          Monthly Expense Trends
        </h3>

        {#if monthlyRows.length === 0}
          <div class="text-center py-8 text-gray-500">
            <p>No monthly data available.</p>
          </div>
        {:else}
          {@const maxMonth = Math.max(
            ...monthlyRows.map((m) => m.totalAmount),
            1,
          )}
          <div class="space-y-4">
            {#each monthlyRows as month}
              <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="font-medium text-gray-900">{month.monthName}</h4>
                  <div class="flex items-center space-x-4 text-sm">
                    <span class="text-gray-600">{month.receiptCount} receipts</span>
                    <span class="text-red-600 font-medium"
                      >{formatCurrency(month.totalAmount)}</span
                    >
                  </div>
                </div>

                <div class="w-full bg-gray-200 rounded-full h-3">
                  <div
                    class="bg-blue-500 h-3 rounded-full transition-all"
                    style="width: {(month.totalAmount / maxMonth) * 100}%"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if selectedReport === "audit-trail"}
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          Audit Trail Summary
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="space-y-4">
            <h4 class="font-medium text-gray-700">Documentation Status</h4>
            <div class="space-y-2">
              <div class="flex justify-between">
                <span class="text-gray-600">Total Receipts</span>
                <span class="text-green-600 font-medium"
                  >{reportData.receiptCount} ✓</span
                >
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">With Images</span>
                <span class="text-green-600 font-medium"
                  >N/A</span
                >
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Tax Classified</span>
                <span class="text-green-600 font-medium"
                  >{reportData.receiptCount} ✓</span
                >
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h4 class="font-medium text-gray-700">Financial Summary</h4>
            <div class="space-y-2">
              <div class="flex justify-between">
                <span class="text-gray-600">Total Expenses</span>
                <span class="font-medium"
                  >{formatCurrency(reportData.totalExpenses)}</span
                >
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Tax Deductible</span>
                <span class="text-green-600 font-medium"
                  >{formatCurrency(reportData.taxDeductibleTotal)}</span
                >
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Non-Deductible</span>
                <span class="text-gray-600"
                  >{formatCurrency(reportData.nonDeductibleTotal)}</span
                >
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h4 class="font-medium text-gray-700">Tax Deduction Rate</h4>
            <div class="text-center">
              <div class="text-4xl font-bold text-green-600 mb-2">
                {reportData.totalExpenses > 0
                  ? Math.round(
                      (reportData.taxDeductibleTotal /
                        reportData.totalExpenses) *
                        100,
                    )
                  : 0}%
              </div>
              <div class="text-sm text-gray-600 mb-4">Tax Deductible</div>
              <div class="w-full bg-gray-200 rounded-full h-3">
                <div
                  class="bg-green-500 h-3 rounded-full"
                  style="width: {reportData.totalExpenses > 0
                    ? Math.round(
                        (reportData.taxDeductibleTotal /
                          reportData.totalExpenses) *
                          100,
                      )
                    : 0}%"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Quarterly Summary -->
    {#if quarterlyRows.length > 0}
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          Quarterly Breakdown
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          {#each quarterlyRows as quarter}
            <div class="border border-gray-200 rounded-lg p-4">
              <h4 class="font-medium text-gray-900 mb-3">{quarter.quarterName}</h4>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">Receipts</span>
                  <span class="font-medium">{quarter.receiptCount}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">Total</span>
                  <span class="text-red-600 font-medium"
                    >{formatCurrency(quarter.totalAmount)}</span
                  >
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">GST Paid</span>
                  <span class="text-purple-600 font-medium"
                    >{formatCurrency(quarter.gstAmount)}</span
                  >
                </div>
                <div class="flex justify-between text-sm border-t pt-2">
                  <span class="text-gray-600">Net Amount</span>
                  <span class="text-green-600 font-bold"
                    >{formatCurrency(quarter.netAmount)}</span
                  >
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
