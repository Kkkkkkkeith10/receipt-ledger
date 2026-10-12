<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { getExpenseCategories } from "$lib/chartOfAccounts";
  import type { FilterParams } from "$lib/types";

  const dispatch = createEventDispatcher<{
    filter: FilterParams;
  }>();

  let searchQuery = "";
  let selectedCategory = "";
  let selectedStatus = "";
  let dateFrom = "";
  let dateTo = "";

  const categories = getExpenseCategories();
  const statuses = [
    { value: "", label: "All Status" },
    { value: "draft", label: "Draft" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  function handleFilter() {
    dispatch("filter", {
      query: searchQuery,
      category: selectedCategory,
      status: selectedStatus,
      dateFrom,
      dateTo,
    });
  }

  function clearFilters() {
    searchQuery = "";
    selectedCategory = "";
    selectedStatus = "";
    dateFrom = "";
    dateTo = "";
    handleFilter();
  }
</script>

<div class="space-y-3 md:space-y-4">
  <h3 class="text-base md:text-lg font-medium text-gray-900">
    Search & Filter Receipts
  </h3>

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
    <!-- Search Query -->
    <div class="sm:col-span-2 lg:col-span-2">
      <label
        for="search"
        class="block text-xs md:text-sm font-medium text-gray-700 mb-1"
      >
        Search
      </label>
      <input
        id="search"
        type="text"
        bind:value={searchQuery}
        on:input={handleFilter}
        placeholder="Vendor name, purpose..."
        class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <!-- Category Filter -->
    <div>
      <label
        for="category"
        class="block text-sm font-medium text-gray-700 mb-1"
      >
        Category
      </label>
      <select
        id="category"
        bind:value={selectedCategory}
        on:change={handleFilter}
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">All Categories</option>
        {#each categories as category}
          <option value={category.code}>{category.name}</option>
        {/each}
      </select>
    </div>

    <!-- Status Filter -->
    <div>
      <label for="status" class="block text-sm font-medium text-gray-700 mb-1">
        Status
      </label>
      <select
        id="status"
        bind:value={selectedStatus}
        on:change={handleFilter}
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {#each statuses as status}
          <option value={status.value}>{status.label}</option>
        {/each}
      </select>
    </div>

    <!-- Clear Filters Button -->
    <div class="flex items-end">
      <button
        on:click={clearFilters}
        class="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Clear All
      </button>
    </div>
  </div>

  <!-- Date Range -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label
        for="date-from"
        class="block text-sm font-medium text-gray-700 mb-1"
      >
        Date From
      </label>
      <input
        id="date-from"
        type="date"
        bind:value={dateFrom}
        on:change={handleFilter}
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <div>
      <label for="date-to" class="block text-sm font-medium text-gray-700 mb-1">
        Date To
      </label>
      <input
        id="date-to"
        type="date"
        bind:value={dateTo}
        on:change={handleFilter}
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  </div>
</div>
