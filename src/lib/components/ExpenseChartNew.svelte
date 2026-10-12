<script lang="ts">
    import type { CategorySummary, MonthlySummary } from "$lib/types";
    import { onDestroy, onMount } from "svelte";

    export let categoryData: CategorySummary[] = [];
    export let monthlyData: MonthlySummary[] = [];
    export let chartType: "category" | "monthly" = "category";

    let canvas: HTMLCanvasElement;
    let chart: any;
    let ChartLibrary: any = null;

    onMount(async () => {
        const chartModule = await import("chart.js/auto");
        ChartLibrary = chartModule.default;
    });

    onDestroy(() => {
        if (chart) {
            chart.destroy();
            chart = null;
        }
    });

    function updateChart() {
        if (!ChartLibrary || !canvas) {
            return;
        }

        if (chart) {
            chart.destroy();
            chart = null;
        }

        if (chartType === "category" && categoryData.length > 0) {
            chart = new ChartLibrary(canvas, {
                type: "doughnut",
                data: {
                    labels: categoryData.map(
                        (c) => `${c.categoryIcon} ${c.categoryName}`,
                    ),
                    datasets: [
                        {
                            data: categoryData.map((c) => c.totalAmount),
                            backgroundColor: categoryData.map(
                                (c) => c.categoryColor,
                            ),
                            borderWidth: 2,
                            borderColor: "#fff",
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: "right",
                            labels: {
                                boxWidth: 12,
                                padding: 15,
                                font: { size: 11 },
                            },
                        },
                        tooltip: {
                            callbacks: {
                                label: (context: any) => {
                                    const value = context.raw as number;
                                    const percent =
                                        categoryData[context.dataIndex]
                                            .percentOfTotal;
                                    return ` HK$${value.toLocaleString("en-HK", { minimumFractionDigits: 2 })} (${percent}%)`;
                                },
                            },
                        },
                    },
                },
            });
        } else if (chartType === "monthly" && monthlyData.length > 0) {
            chart = new ChartLibrary(canvas, {
                type: "bar",
                data: {
                    labels: monthlyData.map((m) => m.monthName.substring(0, 3)),
                    datasets: [
                        {
                            label: "Expenses",
                            data: monthlyData.map((m) => m.totalAmount),
                            backgroundColor: "#3B82F6",
                            borderRadius: 4,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context: any) => {
                                    const value = context.raw as number;
                                    return ` HK$${value.toLocaleString("en-HK", { minimumFractionDigits: 2 })}`;
                                },
                            },
                        },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value: number) =>
                                    `HK$${value.toLocaleString()}`,
                            },
                        },
                    },
                },
            });
        }
    }

    $: if (ChartLibrary && canvas) {
        updateChart();
    }
</script>

<div class="relative w-full h-64">
    <canvas bind:this={canvas}></canvas>

    {#if (chartType === "category" && categoryData.length === 0) || (chartType === "monthly" && monthlyData.length === 0)}
        <div
            class="absolute inset-0 flex items-center justify-center text-gray-400"
        >
            <p>No data available</p>
        </div>
    {/if}
</div>
