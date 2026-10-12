<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import ExpenseChartNew from "$lib/components/ExpenseChartNew.svelte";
    import { formatCurrency, formatPercent } from "$lib/utils/format";
    import {
        getFiscalYear,
        getFiscalYearOptions,
        formatFiscalYear,
    } from "$lib/utils/fiscal";
    import { getCategoryIcon } from "$lib/categories";
    import type { ExpenseReport } from "$lib/types";

    let report: ExpenseReport | null = null;
    let loading = true;
    let error: string | null = null;

    $: fy = parseInt($page.params.fy) || getFiscalYear();
    const availableYears = getFiscalYearOptions(2020);

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
            Array.isArray(candidate.categoryBreakdown) &&
            Array.isArray(candidate.monthlyBreakdown) &&
            Array.isArray(candidate.quarterlyBreakdown)
        );
    }

    onMount(async () => {
        await loadReport(fy);
        // Allow other pages (e.g. /reports) to deep-link straight into the
        // CSV export.
        if (
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).get("export") === "csv"
        ) {
            await exportCSV();
        }
    });

    async function loadReport(fiscalYear: number) {
        loading = true;
        error = null;

        try {
            const res = await fetch(`/api/reports/${fiscalYear}`);
            if (res.ok) {
                const payload = await res.json();
                if (isExpenseReport(payload)) {
                    report = payload;
                } else {
                    report = null;
                    error = "Report data is unavailable for this fiscal year";
                }
            } else {
                error = "Failed to load report";
            }
        } catch (e) {
            error = "Failed to load report";
        } finally {
            loading = false;
        }
    }

    function handleYearChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        window.location.href = `/reports/${select.value}`;
    }

    function exportPDF() {
        // TODO: Implement PDF export
        alert("PDF export coming soon!");
    }

    /** RFC 4180 CSV cell escaping. */
    function csv(value: unknown): string {
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (/[",\r\n]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    function csvRow(...values: unknown[]): string {
        return values.map(csv).join(",");
    }

    function fmt2(n: number): string {
        return (Math.round((n ?? 0) * 100) / 100).toFixed(2);
    }

    let exporting = false;

    async function exportCSV() {
        if (!report || exporting) return;
        exporting = true;
        try {
            // Pull every receipt for this fiscal year so we can include a full
            // ledger and proper currency-aware breakdowns.
            const res = await fetch(
                `/api/receipts?fiscalYear=${report.fiscalYear}&status=approved&limit=100000`,
            );
            const receipts = res.ok
                ? ((await res.json()) as any[])
                : ([] as any[]);

            const lines: string[] = [];
            const generatedAt = new Date().toLocaleString();

            // ----- Cover -----
            lines.push(csvRow("Receipt Ledger - Financial Report"));
            lines.push(
                csvRow(
                    "Fiscal Year",
                    report.fiscalYearDisplay ?? `FY${report.fiscalYear}`,
                ),
            );
            lines.push(
                csvRow("Period", `${report.startDate} to ${report.endDate}`),
            );
            lines.push(csvRow("Generated", generatedAt));
            lines.push(csvRow("Reporting Currency", "HKD"));
            lines.push(
                csvRow(
                    "Note",
                    "Amounts shown in HKD. Original currencies preserved in transaction ledger.",
                ),
            );
            lines.push("");

            // ----- Executive Summary -----
            lines.push(csvRow("EXECUTIVE SUMMARY"));
            lines.push(csvRow("Metric", "Amount (HKD)"));
            lines.push(csvRow("Total Expenses", fmt2(report.totalExpenses)));
            lines.push(csvRow("Total GST Paid", fmt2(report.totalGst)));
            lines.push(
                csvRow("Net Expenses (ex-GST)", fmt2(report.totalNetExpenses)),
            );
            lines.push(
                csvRow(
                    "Tax-Deductible Total",
                    fmt2(report.taxDeductibleTotal),
                ),
            );
            lines.push(
                csvRow(
                    "Non-Deductible Total",
                    fmt2(report.nonDeductibleTotal),
                ),
            );
            lines.push(csvRow("Receipt Count", report.receiptCount));
            const avgReceipt = report.receiptCount
                ? report.totalExpenses / report.receiptCount
                : 0;
            lines.push(csvRow("Average Receipt", fmt2(avgReceipt)));
            lines.push("");

            // ----- Income / Expense Statement (by category) -----
            lines.push(csvRow("EXPENSE STATEMENT BY CATEGORY"));
            lines.push(
                csvRow(
                    "Category ID",
                    "Category",
                    "Receipts",
                    "Gross (HKD)",
                    "GST (HKD)",
                    "Net (HKD)",
                    "% of Total",
                ),
            );
            for (const cat of report.categoryBreakdown) {
                lines.push(
                    csvRow(
                        cat.categoryId,
                        cat.categoryName,
                        cat.receiptCount,
                        fmt2(cat.totalAmount),
                        fmt2(cat.gstAmount),
                        fmt2(cat.netAmount),
                        `${cat.percentOfTotal}%`,
                    ),
                );
            }
            lines.push(
                csvRow(
                    "",
                    "TOTAL",
                    report.receiptCount,
                    fmt2(report.totalExpenses),
                    fmt2(report.totalGst),
                    fmt2(report.totalNetExpenses),
                    "100%",
                ),
            );
            lines.push("");

            // ----- GST / BAS Reconciliation -----
            const gstFreeTotal = receipts
                .filter((r) => r.gstFree)
                .reduce((s, r) => s + Number(r.amount ?? 0), 0);
            const gstApplicableTotal = report.totalExpenses - gstFreeTotal;
            lines.push(csvRow("GST RECONCILIATION"));
            lines.push(csvRow("Line", "Amount (HKD)"));
            lines.push(
                csvRow(
                    "Gross Expenses (GST inclusive)",
                    fmt2(gstApplicableTotal),
                ),
            );
            lines.push(csvRow("GST-Free Expenses", fmt2(gstFreeTotal)));
            lines.push(csvRow("GST Paid (claimable)", fmt2(report.totalGst)));
            lines.push(
                csvRow("Net Expenses (ex-GST)", fmt2(report.totalNetExpenses)),
            );
            lines.push("");

            // ----- Tax Deductibility Summary -----
            lines.push(csvRow("TAX DEDUCTIBILITY"));
            lines.push(csvRow("Classification", "Amount (HKD)", "% of Total"));
            const totalForPct = report.totalExpenses || 1;
            lines.push(
                csvRow(
                    "Tax-Deductible",
                    fmt2(report.taxDeductibleTotal),
                    `${((report.taxDeductibleTotal / totalForPct) * 100).toFixed(1)}%`,
                ),
            );
            lines.push(
                csvRow(
                    "Non-Deductible",
                    fmt2(report.nonDeductibleTotal),
                    `${((report.nonDeductibleTotal / totalForPct) * 100).toFixed(1)}%`,
                ),
            );
            lines.push("");

            // ----- Quarterly P&L -----
            lines.push(csvRow("QUARTERLY BREAKDOWN"));
            lines.push(
                csvRow(
                    "Quarter",
                    "Receipts",
                    "Gross (HKD)",
                    "GST (HKD)",
                    "Net (HKD)",
                ),
            );
            for (const q of report.quarterlyBreakdown) {
                lines.push(
                    csvRow(
                        q.quarterName,
                        q.receiptCount,
                        fmt2(q.totalAmount),
                        fmt2(q.gstAmount),
                        fmt2(q.netAmount),
                    ),
                );
            }
            lines.push("");

            // ----- Monthly breakdown with running total -----
            lines.push(csvRow("MONTHLY BREAKDOWN (Fiscal Order)"));
            lines.push(
                csvRow(
                    "Fiscal Month",
                    "Calendar Month",
                    "Receipts",
                    "Gross (HKD)",
                    "GST (HKD)",
                    "Net (HKD)",
                    "Cumulative (HKD)",
                ),
            );
            let running = 0;
            for (const m of report.monthlyBreakdown) {
                running += m.totalAmount;
                lines.push(
                    csvRow(
                        m.fiscalMonth,
                        m.monthName,
                        m.receiptCount,
                        fmt2(m.totalAmount),
                        fmt2(m.gstAmount),
                        fmt2(m.totalAmount - m.gstAmount),
                        fmt2(running),
                    ),
                );
            }
            lines.push("");

            // ----- Top Vendors -----
            lines.push(csvRow("TOP VENDORS"));
            lines.push(
                csvRow("Rank", "Vendor", "Receipts", "Total (HKD)", "% of Total"),
            );
            report.topVendors.forEach((v, i) => {
                lines.push(
                    csvRow(
                        i + 1,
                        v.vendor,
                        v.count,
                        fmt2(v.total),
                        `${((v.total / totalForPct) * 100).toFixed(1)}%`,
                    ),
                );
            });
            lines.push("");

            // ----- Payment Method Mix -----
            const pmMap = new Map<string, { total: number; count: number }>();
            for (const r of receipts) {
                const key = (r.paymentMethod as string) || "unspecified";
                const e = pmMap.get(key) ?? { total: 0, count: 0 };
                e.total += Number(r.amount ?? 0);
                e.count += 1;
                pmMap.set(key, e);
            }
            if (pmMap.size > 0) {
                lines.push(csvRow("PAYMENT METHOD MIX"));
                lines.push(
                    csvRow(
                        "Payment Method",
                        "Receipts",
                        "Total (Original)",
                    ),
                );
                for (const [pm, data] of pmMap) {
                    lines.push(csvRow(pm, data.count, fmt2(data.total)));
                }
                lines.push("");
            }

            // ----- Currency Mix -----
            const ccyMap = new Map<string, { total: number; count: number }>();
            for (const r of receipts) {
                const key = (r.currency as string) || "HKD";
                const e = ccyMap.get(key) ?? { total: 0, count: 0 };
                e.total += Number(r.amount ?? 0);
                e.count += 1;
                ccyMap.set(key, e);
            }
            if (ccyMap.size > 0) {
                lines.push(csvRow("CURRENCY MIX"));
                lines.push(
                    csvRow(
                        "Currency",
                        "Receipts",
                        "Total (Original Currency)",
                    ),
                );
                for (const [ccy, data] of ccyMap) {
                    lines.push(csvRow(ccy, data.count, fmt2(data.total)));
                }
                lines.push("");
            }

            // ----- Detailed Transaction Ledger -----
            lines.push(csvRow("TRANSACTION LEDGER"));
            lines.push(
                csvRow(
                    "Date",
                    "Receipt ID",
                    "Vendor",
                    "Category",
                    "Subcategory",
                    "Currency",
                    "Original Amount",
                    "GST Amount",
                    "Net Amount",
                    "GST-Free",
                    "Tax Deductible",
                    "Payment Method",
                    "Status",
                    "Business Purpose",
                    "Project Code",
                    "Location",
                    "Attendees",
                    "Notes",
                ),
            );
            const sortedReceipts = [...receipts].sort((a, b) =>
                String(a.date).localeCompare(String(b.date)),
            );
            for (const r of sortedReceipts) {
                const audit = r.auditInfo ?? {};
                lines.push(
                    csvRow(
                        r.date ?? "",
                        r.id ?? "",
                        r.vendor ?? "",
                        r.categoryName ?? r.category ?? "",
                        r.subcategory ?? "",
                        r.currency ?? "HKD",
                        fmt2(Number(r.amount ?? 0)),
                        fmt2(Number(r.gstAmount ?? 0)),
                        fmt2(Number(r.netAmount ?? 0)),
                        r.gstFree ? "Yes" : "No",
                        r.taxDeductible ? "Yes" : "No",
                        r.paymentMethod ?? "",
                        r.status ?? "",
                        audit.businessPurpose ?? "",
                        audit.projectCode ?? "",
                        audit.location ?? "",
                        audit.attendees ?? "",
                        r.notes ?? "",
                    ),
                );
            }

            // BOM so Excel detects UTF-8 cleanly.
            const csvText = "\ufeff" + lines.join("\r\n");
            const blob = new Blob([csvText], {
                type: "text/csv;charset=utf-8;",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `financial-report-FY${report.fiscalYear}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            exporting = false;
        }
    }
</script>

<div class="space-y-4 md:space-y-6">
    <!-- Page Header -->
    <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
        <div>
            <h1 class="text-2xl md:text-3xl font-bold text-gray-900">
                Expense Report
            </h1>
            <p class="text-sm md:text-base text-gray-600 mt-1">
                {report ? formatFiscalYear(report.fiscalYear) : `FY${fy}`}
            </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 md:gap-3">
            <select
                value={fy}
                on:change={handleYearChange}
                class="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
                {#each availableYears as year}
                    <option value={year}>FY{year}</option>
                {/each}
            </select>
            <button
                on:click={exportCSV}
                disabled={!report}
                class="px-3 md:px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
                📊 CSV
            </button>
            <button
                on:click={exportPDF}
                disabled={!report}
                class="px-3 md:px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
                📄 PDF
            </button>
        </div>
    </div>

    {#if loading}
        <div class="flex justify-center py-12">
            <div
                class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"
            ></div>
        </div>
    {:else if error}
        <div
            class="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg"
        >
            {error}
        </div>
    {:else if report}
        <!-- Summary Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            <div
                class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6"
            >
                <p class="text-xs md:text-sm text-gray-500">Total Expenses</p>
                <p class="text-lg md:text-2xl font-bold text-gray-900">
                    {formatCurrency(report.totalExpenses)}
                </p>
                <p class="text-xs text-gray-400 mt-1">
                    {report.receiptCount} receipts
                </p>
            </div>
            <div
                class="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
                <p class="text-sm text-gray-500">GST Paid</p>
                <p class="text-2xl font-bold text-purple-600">
                    {formatCurrency(report.totalGst)}
                </p>
                <p class="text-xs text-gray-400 mt-1">Claimable on BAS</p>
            </div>
            <div
                class="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
                <p class="text-sm text-gray-500">Tax Deductible</p>
                <p class="text-2xl font-bold text-green-600">
                    {formatCurrency(report.taxDeductibleTotal)}
                </p>
                <p class="text-xs text-gray-400 mt-1">
                    {formatPercent(
                        report.totalExpenses > 0
                            ? (report.taxDeductibleTotal /
                                  report.totalExpenses) *
                                  100
                            : 0,
                    )} of total
                </p>
            </div>
            <div
                class="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
                <p class="text-sm text-gray-500">Net Expenses</p>
                <p class="text-2xl font-bold text-gray-900">
                    {formatCurrency(report.totalNetExpenses)}
                </p>
                <p class="text-xs text-gray-400 mt-1">Excluding GST</p>
            </div>
        </div>

        <!-- Charts -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
                class="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    Expenses by Category
                </h3>
                <ExpenseChartNew
                    categoryData={report.categoryBreakdown}
                    chartType="category"
                />
            </div>
            <div
                class="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    Monthly Trend
                </h3>
                <ExpenseChartNew
                    monthlyData={report.monthlyBreakdown}
                    chartType="monthly"
                />
            </div>
        </div>

        <!-- Category Breakdown Table -->
        <div
            class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
            <div class="p-6 border-b">
                <h3 class="text-lg font-semibold text-gray-900">
                    Category Breakdown
                </h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Category</th
                            >
                            <th
                                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >Amount</th
                            >
                            <th
                                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >GST</th
                            >
                            <th
                                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >Net</th
                            >
                            <th
                                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >Receipts</th
                            >
                            <th
                                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >%</th
                            >
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        {#each report.categoryBreakdown as cat}
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="flex items-center space-x-2">
                                        <span>{cat.categoryIcon}</span>
                                        <span class="font-medium text-gray-900"
                                            >{cat.categoryName}</span
                                        >
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-right font-medium"
                                    >{formatCurrency(cat.totalAmount)}</td
                                >
                                <td class="px-6 py-4 text-right text-gray-500"
                                    >{formatCurrency(cat.gstAmount)}</td
                                >
                                <td class="px-6 py-4 text-right text-gray-500"
                                    >{formatCurrency(cat.netAmount)}</td
                                >
                                <td class="px-6 py-4 text-right text-gray-500"
                                    >{cat.receiptCount}</td
                                >
                                <td class="px-6 py-4 text-right">
                                    <span
                                        class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                        style="background-color: {cat.categoryColor}20; color: {cat.categoryColor}"
                                    >
                                        {cat.percentOfTotal}%
                                    </span>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                    <tfoot class="bg-gray-50 font-semibold">
                        <tr>
                            <td class="px-6 py-4">Total</td>
                            <td class="px-6 py-4 text-right"
                                >{formatCurrency(report.totalExpenses)}</td
                            >
                            <td class="px-6 py-4 text-right"
                                >{formatCurrency(report.totalGst)}</td
                            >
                            <td class="px-6 py-4 text-right"
                                >{formatCurrency(report.totalNetExpenses)}</td
                            >
                            <td class="px-6 py-4 text-right"
                                >{report.receiptCount}</td
                            >
                            <td class="px-6 py-4 text-right">100%</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        <!-- Quarterly Summary (for BAS) -->
        <div
            class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
            <div class="p-6 border-b">
                <h3 class="text-lg font-semibold text-gray-900">
                    Quarterly Summary (BAS)
                </h3>
                <p class="text-sm text-gray-500 mt-1">
                    GST figures for Business Activity Statement
                </p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                >Quarter</th
                            >
                            <th
                                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >Total Amount</th
                            >
                            <th
                                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >GST Paid</th
                            >
                            <th
                                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >Net Amount</th
                            >
                            <th
                                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
                                >Receipts</th
                            >
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        {#each report.quarterlyBreakdown as q}
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 font-medium text-gray-900"
                                    >{q.quarterName}</td
                                >
                                <td class="px-6 py-4 text-right"
                                    >{formatCurrency(q.totalAmount)}</td
                                >
                                <td
                                    class="px-6 py-4 text-right text-purple-600 font-medium"
                                    >{formatCurrency(q.gstAmount)}</td
                                >
                                <td class="px-6 py-4 text-right text-gray-500"
                                    >{formatCurrency(q.netAmount)}</td
                                >
                                <td class="px-6 py-4 text-right text-gray-500"
                                    >{q.receiptCount}</td
                                >
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Top Vendors -->
        {#if report.topVendors.length > 0}
            <div
                class="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    Top Vendors
                </h3>
                <div class="space-y-3">
                    {#each report.topVendors.slice(0, 5) as vendor, i}
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-3">
                                <span
                                    class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium"
                                >
                                    {i + 1}
                                </span>
                                <span class="font-medium text-gray-900"
                                    >{vendor.vendor}</span
                                >
                                <span class="text-sm text-gray-500"
                                    >({vendor.count} receipts)</span
                                >
                            </div>
                            <span class="font-medium"
                                >{formatCurrency(vendor.total)}</span
                            >
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Report Footer -->
        <div class="text-center text-sm text-gray-500 py-4">
            Report generated: {new Date(report.generatedAt).toLocaleString()}
        </div>
    {:else}
        <div
            class="bg-gray-50 border border-gray-200 p-8 rounded-lg text-center"
        >
            <p class="text-gray-500">No data available for FY{fy}</p>
            <a
                href="/receipts/new"
                class="text-blue-600 hover:text-blue-700 mt-2 inline-block"
            >
                Add your first receipt →
            </a>
        </div>
    {/if}
</div>
