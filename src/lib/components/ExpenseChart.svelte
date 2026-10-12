<script>
  // Mock expense chart data
  let chartData = [
    { month: 'Jan', amount: 12000 },
    { month: 'Feb', amount: 14500 },
    { month: 'Mar', amount: 13200 },
    { month: 'Apr', amount: 15800 },
    { month: 'May', amount: 17200 },
    { month: 'Jun', amount: 16100 },
    { month: 'Jul', amount: 18400 },
    { month: 'Aug', amount: 15750 }
  ];

  // Simple bar chart using CSS
  $: maxAmount = Math.max(...chartData.map(d => d.amount));
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <span class="text-sm text-gray-600">Monthly Expenses (HKD)</span>
    <span class="text-sm text-gray-500">Max: HK${maxAmount.toLocaleString()}</span>
  </div>
  
  <div class="space-y-3">
    {#each chartData as data}
      <div class="flex items-center space-x-3">
        <div class="w-8 text-xs text-gray-600 text-right">{data.month}</div>
        <div class="flex-1 bg-gray-200 rounded-full h-6 relative">
          <div 
            class="bg-blue-500 h-full rounded-full transition-all duration-500"
            style="width: {(data.amount / maxAmount) * 100}%"
          ></div>
          <span class="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
            {data.amount.toLocaleString()}
          </span>
        </div>
      </div>
    {/each}
  </div>
  
  <div class="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
    <span>Average: HK${Math.round(chartData.reduce((sum, d) => sum + d.amount, 0) / chartData.length).toLocaleString()}</span>
    <span>Total YTD: HK${chartData.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}</span>
  </div>
</div>
