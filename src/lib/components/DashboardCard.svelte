<script>
  export let title = "";
  export let value = "";
  export let subtitle = "";
  export let trend = "";
  export let trendUp = true;
  export let icon = "📊";
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
  <div class="flex items-center justify-between">
    <div class="flex items-center space-x-2 md:space-x-3 min-w-0">
      <div
        class="w-10 h-10 md:w-12 md:h-12 bg-gray-100 rounded-lg flex items-center justify-center text-lg md:text-xl flex-shrink-0"
      >
        {icon}
      </div>
      <div class="min-w-0">
        <p class="text-xs md:text-sm font-medium text-gray-600 truncate">
          {title}
        </p>
        <p class="text-lg md:text-2xl font-bold text-gray-900 truncate">
          {value}
        </p>
      </div>
    </div>
  </div>

  <div class="mt-3 md:mt-4 flex items-center justify-between">
    <p class="text-xs md:text-sm text-gray-600 truncate">{subtitle}</p>
    {#if trend}
      <div class="flex items-center space-x-1 flex-shrink-0">
        <span
          class="text-xs md:text-sm {trendUp
            ? 'text-green-600'
            : 'text-red-600'}"
        >
          {trendUp ? "↗" : "↙"}
          {trend}
        </span>
      </div>
    {/if}
  </div>
</div>
