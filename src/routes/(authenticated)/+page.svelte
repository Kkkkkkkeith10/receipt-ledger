<script lang="ts">
  import { onMount } from "svelte";
  import DashboardCard from "$lib/components/DashboardCard.svelte";
  import ExpenseChartNew from "$lib/components/ExpenseChartNew.svelte";
  import QuickUpload from "$lib/components/QuickUpload.svelte";
  import {
    formatCurrency,
    formatDate,
    formatRelativeTime,
    convertToHKD,
    DEFAULT_EXCHANGE_RATES,
    getSupportedCurrencies,
  } from "$lib/utils/format";
  import type { SupportedCurrency } from "$lib/utils/format";
  import { getFiscalYear, getFiscalYearString } from "$lib/utils/fiscal";
  import { getCategoryIcon, getCategoryName } from "$lib/categories";
  import type {
    Receipt,
    ExpenseReport,
    CategorySummary,
    MonthlySummary,
  } from "$lib/types";

  let loading = true;
  let error: string | null = null;
  let receipts: Receipt[] = [];
  let report: ExpenseReport | null = null;

  // Currency display mode: 'original' or 'converted'
  let displayMode: "original" | "converted" = "converted";

  // Exchange rates (load from localStorage or use defaults)
  let exchangeRates: Record<SupportedCurrency, number> = {
    ...DEFAULT_EXCHANGE_RATES,
  };

  const currentFY = getFiscalYear();
  const currencies = getSupportedCurrencies();

  // Load exchange rates from localStorage
  onMount(() => {
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
  });

  // Save display mode when changed
  function toggleDisplayMode() {
    displayMode = displayMode === "converted" ? "original" : "converted";
    localStorage.setItem("currencyDisplayMode", displayMode);
  }

  // Calculate amounts based on display mode
  function getDisplayAmount(receipt: Receipt): {
    amount: number;
    currency: SupportedCurrency;
  } {
    const originalCurrency = (receipt.currency || "HKD") as SupportedCurrency;
    if (displayMode === "original") {
      return { amount: receipt.amount, currency: originalCurrency };
    }
    // Convert to HKD
    return {
      amount: convertToHKD(receipt.amount, originalCurrency, exchangeRates),
      currency: "HKD",
    };
  }

  // Format amount based on display mode
  function formatDisplayAmount(receipt: Receipt): string {
    const { amount, currency } = getDisplayAmount(receipt);
    return formatCurrency(amount, { currency });
  }

  // Dashboard computed values
  $: recentReceipts = receipts.slice(0, 5);

  // Calculate totals based on display mode
  $: ytdExpenses =
    displayMode === "converted"
      ? receipts.reduce(
          (sum, r) =>
            sum +
            convertToHKD(
              r.amount,
              (r.currency || "HKD") as SupportedCurrency,
              exchangeRates,
            ),
          0,
        )
      : (report?.totalExpenses ?? 0);

  $: ytdGst = report?.totalGst ?? 0;
  $: receiptCount = report?.receiptCount ?? 0;

  $: taxDeductible =
    displayMode === "converted"
      ? receipts
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
      : (report?.taxDeductibleTotal ?? 0);

  $: categoryBreakdown = report?.categoryBreakdown ?? [];
  $: monthlyBreakdown = report?.monthlyBreakdown ?? [];
  $: pendingCount = receipts.filter((r) => r.status === "pending").length;

  // Calculate this month's total
  $: thisMonthTotal = (() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const monthReceipts = receipts.filter((r) => r.date >= monthStart);

    if (displayMode === "converted") {
      return monthReceipts.reduce(
        (sum, r) =>
          sum +
          convertToHKD(
            r.amount,
            (r.currency || "HKD") as SupportedCurrency,
            exchangeRates,
          ),
        0,
      );
    }
    return monthReceipts.reduce((sum, r) => sum + r.amount, 0);
  })();

  // Get currency breakdown for original mode
  $: currencyBreakdown = (() => {
    const breakdown: Record<string, number> = {};
    receipts.forEach((r) => {
      const curr = r.currency || "HKD";
      breakdown[curr] = (breakdown[curr] || 0) + r.amount;
    });
    return Object.entries(breakdown).map(([currency, total]) => ({
      currency: currency as SupportedCurrency,
      total,
    }));
  })();

  onMount(async () => {
    try {
      // Fetch receipts and report in parallel
      const [receiptsRes, reportRes] = await Promise.all([
        fetch(`/api/receipts?fiscalYear=${currentFY}&limit=50`),
        fetch(`/api/reports/${currentFY}`),
      ]);

      if (receiptsRes.ok) {
        receipts = await receiptsRes.json();
      }
      if (reportRes.ok) {
        report = await reportRes.json();
      }
    } catch (e) {
      error = "Failed to load dashboard data";
      console.error(e);
    } finally {
      loading = false;
    }
  });
</script>

<div class="space-y-4 md:space-y-6">
  <!-- Page Header -->
  <div
    class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
  >
    <div>
      <h1 class="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
      <p class="text-sm md:text-base text-gray-600 mt-1">
        {getFiscalYearString()} Overview • HK Fiscal Year (Apr-Mar)
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2 md:gap-3">
      <!-- Currency Toggle -->
      <button
        on:click={toggleDisplayMode}
        class="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 {displayMode ===
        'converted'
          ? 'bg-green-100 text-green-700 border border-green-300'
          : 'bg-blue-100 text-blue-700 border border-blue-300'}"
        title={displayMode === "converted"
          ? "Showing all amounts converted to HKD"
          : "Showing amounts in original currencies"}
      >
        <span>{displayMode === "converted" ? "🔄 HKD" : "💱 Original"}</span>
      </button>
      <a
        href="/receipts/new"
        class="px-3 md:px-4 py-2 bg-green-600 text-white text-sm md:text-base rounded-lg hover:bg-green-700 transition-colors text-center"
      >
        📸 Add Receipt
      </a>
      <a
        href="/reports/{currentFY}"
        class="px-3 md:px-4 py-2 bg-blue-600 text-white text-sm md:text-base rounded-lg hover:bg-blue-700 transition-colors text-center"
      >
        📊 View Report
      </a>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center py-12">
      <div
        class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"
      ></div>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
      {error}
    </div>
  {:else}
    <!-- Currency Mode Indicator -->
    {#if displayMode === "converted"}
      <div
        class="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <span class="text-green-600">🔄</span>
          <span class="text-green-800 text-sm"
            >All amounts converted to HKD using configured exchange rates</span
          >
        </div>
        <a
          href="/settings"
          class="text-green-700 text-sm font-medium hover:underline"
          >Edit Rates →</a
        >
      </div>
    {:else if currencyBreakdown.length > 1}
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-blue-600">💱</span>
          <span class="text-blue-800 text-sm font-medium"
            >Amounts in original currencies</span
          >
        </div>
        <div class="flex flex-wrap gap-2">
          {#each currencyBreakdown as { currency, total }}
            <span
              class="px-2 py-1 bg-white rounded text-sm text-gray-700 border border-blue-200"
            >
              {formatCurrency(total, { currency })}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Key Metrics Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
      <DashboardCard
        title="This Month"
        value={formatCurrency(thisMonthTotal, {
          currency: displayMode === "converted" ? "HKD" : undefined,
        })}
        subtitle={displayMode === "converted"
          ? "Total (HKD)"
          : "Total Expenses"}
        icon="💰"
      />
      <DashboardCard
        title="Year to Date"
        value={formatCurrency(ytdExpenses, {
          currency: displayMode === "converted" ? "HKD" : undefined,
        })}
        subtitle="{getFiscalYearString()} {displayMode === 'converted'
          ? '(HKD)'
          : 'Total'}"
        icon="📈"
      />
      <DashboardCard
        title="Total Receipts"
        value={receiptCount.toString()}
        subtitle="This Fiscal Year"
        icon="🧾"
      />
      <DashboardCard
        title="Tax Deductible"
        value={formatCurrency(taxDeductible, {
          currency: displayMode === "converted" ? "HKD" : undefined,
        })}
        subtitle={displayMode === "converted"
          ? "Deductions (HKD)"
          : "Available Deductions"}
        icon="🏛️"
      />
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      <!-- Quick Upload - Primary action on mobile -->
      <QuickUpload />

      <div
        class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          Expenses by Category
        </h3>
        <ExpenseChartNew
          categoryData={categoryBreakdown}
          chartType="category"
        />
      </div>
    </div>

    <!-- Recent Receipts & Actions -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      <!-- Recent Receipts -->
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Recent Receipts</h3>
          <a
            href="/receipts"
            class="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >View all →</a
          >
        </div>

        {#if recentReceipts.length === 0}
          <p class="text-gray-500 text-center py-8">
            No receipts yet. Add your first receipt!
          </p>
        {:else}
          <div class="space-y-3">
            {#each recentReceipts as receipt}
              <a
                href="/receipts/{receipt.id}"
                class="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div class="flex items-center space-x-3">
                  <span class="text-xl"
                    >{getCategoryIcon(receipt.category)}</span
                  >
                  <div>
                    <p class="font-medium text-gray-900">{receipt.vendor}</p>
                    <p class="text-sm text-gray-500">
                      {formatRelativeTime(receipt.date)}
                    </p>
                  </div>
                </div>
                <div class="text-right">
                  <span class="font-medium text-gray-900"
                    >{formatDisplayAmount(receipt)}</span
                  >
                  {#if displayMode === "converted" && receipt.currency && receipt.currency !== "HKD"}
                    <p class="text-xs text-gray-500">
                      {formatCurrency(receipt.amount, {
                        currency: receipt.currency,
                      })}
                    </p>
                  {/if}
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Action Items -->
      <div
        class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div class="space-y-3">
          {#if pendingCount > 0}
            <div
              class="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
            >
              <div class="flex items-center space-x-3">
                <span class="text-yellow-600">⚠️</span>
                <span class="text-gray-900"
                  >{pendingCount} receipts pending review</span
                >
              </div>
              <a
                href="/receipts?status=pending"
                class="text-yellow-700 hover:text-yellow-800 font-medium"
                >Review →</a
              >
            </div>
          {/if}

          <a
            href="/receipts/new"
            class="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
          >
            <div class="flex items-center space-x-3">
              <span class="text-green-600">📸</span>
              <span class="text-gray-900">Upload a new receipt</span>
            </div>
            <span class="text-green-700 font-medium">Add →</span>
          </a>

          <a
            href="/reports/{currentFY}"
            class="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <div class="flex items-center space-x-3">
              <span class="text-blue-600">📊</span>
              <span class="text-gray-900"
                >{getFiscalYearString()} Expense Report</span
              >
            </div>
            <span class="text-blue-700 font-medium">View →</span>
          </a>

          <!-- GST Summary -->
          {#if ytdGst > 0}
            <div
              class="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg"
            >
              <div class="flex items-center space-x-3">
                <span class="text-purple-600">🧮</span>
                <span class="text-gray-900"
                  >GST Paid: {formatCurrency(ytdGst)}</span
                >
              </div>
              <a href="/reports/{currentFY}" class="text-purple-700 font-medium"
                >Details →</a
              >
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
