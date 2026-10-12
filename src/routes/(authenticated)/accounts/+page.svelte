<script lang="ts">
  import { onMount } from "svelte";
  import {
    defaultChartOfAccounts,
    getAccountsByType,
  } from "$lib/chartOfAccounts";
  import type { ChartOfAccount } from "$lib/schemas";

  let accounts = defaultChartOfAccounts;
  let selectedType = "all";
  let searchQuery = "";
  let filteredAccounts = accounts;

  const accountTypes = [
    { value: "all", label: "All Account Types" },
    { value: "asset", label: "Assets" },
    { value: "liability", label: "Liabilities" },
    { value: "equity", label: "Equity" },
    { value: "revenue", label: "Revenue" },
    { value: "expense", label: "Expenses" },
  ];

  function handleFilter() {
    filteredAccounts = accounts.filter((account) => {
      const matchesSearch =
        !searchQuery ||
        account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.code.includes(searchQuery) ||
        (account.description &&
          account.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()));

      const matchesType =
        selectedType === "all" || account.type === selectedType;

      return matchesSearch && matchesType && account.active;
    });
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "asset":
        return "🏦";
      case "liability":
        return "📊";
      case "equity":
        return "🏛️";
      case "revenue":
        return "💰";
      case "expense":
        return "🧾";
      default:
        return "📋";
    }
  }

  function getTypeColor(type: string) {
    switch (type) {
      case "asset":
        return "bg-blue-100 text-blue-800";
      case "liability":
        return "bg-red-100 text-red-800";
      case "equity":
        return "bg-purple-100 text-purple-800";
      case "revenue":
        return "bg-green-100 text-green-800";
      case "expense":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  onMount(() => {
    handleFilter();
  });

  $: if (searchQuery || selectedType) {
    handleFilter();
  }
</script>

<div class="space-y-4 md:space-y-6">
  <!-- Page Header -->
  <div
    class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
  >
    <div>
      <h1 class="text-2xl md:text-3xl font-bold text-gray-900">
        Chart of Accounts
      </h1>
      <p class="text-sm md:text-base text-gray-600 mt-1">
        Manage your accounting structure and tax classifications
      </p>
    </div>
    <div class="flex flex-wrap gap-2 md:gap-3">
      <button
        class="px-3 md:px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
      >
        ➕ Add Account
      </button>
      <button
        class="px-3 md:px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        📤 Export
      </button>
    </div>
  </div>

  <!-- Search and Filters -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
      <div class="sm:col-span-2">
        <label
          for="search"
          class="block text-sm font-medium text-gray-700 mb-1"
        >
          Search Accounts
        </label>
        <input
          id="search"
          type="text"
          bind:value={searchQuery}
          placeholder="Account name, code, or description..."
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label for="type" class="block text-sm font-medium text-gray-700 mb-1">
          Account Type
        </label>
        <select
          id="type"
          bind:value={selectedType}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {#each accountTypes as type}
            <option value={type.value}>{type.label}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  <!-- Account Summary Cards -->
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
    {#each accountTypes.slice(1) as type}
      {@const typeAccounts = getAccountsByType(type.value)}
      <div
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs md:text-sm text-gray-600">{type.label}</p>
            <p class="text-xl md:text-2xl font-bold text-gray-900">
              {typeAccounts.length}
            </p>
          </div>
          <span class="text-xl md:text-2xl">{getTypeIcon(type.value)}</span>
        </div>
      </div>
    {/each}
  </div>

  <!-- Accounts Table -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200">
    {#if filteredAccounts.length === 0}
      <div class="p-8 text-center">
        <div
          class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <span class="text-gray-400 text-2xl">📋</span>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          No accounts found
        </h3>
        <p class="text-gray-600">
          Try adjusting your search or filter criteria.
        </p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Account
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Type
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Tax Deductible
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Description
              </th>
              <th
                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredAccounts as account}
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center space-x-3">
                    <div
                      class="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"
                    >
                      <span class="text-lg">{getTypeIcon(account.type)}</span>
                    </div>
                    <div>
                      <div class="font-medium text-gray-900">
                        {account.name}
                      </div>
                      <div class="text-sm text-gray-500">
                        Code: {account.code}
                      </div>
                    </div>
                  </div>
                </td>

                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getTypeColor(
                      account.type,
                    )}"
                  >
                    {account.type}
                  </span>
                </td>

                <td class="px-6 py-4 whitespace-nowrap">
                  {#if account.taxDeductible}
                    <div class="flex items-center space-x-2">
                      <span class="text-green-600">✓</span>
                      <span class="text-sm text-gray-900"
                        >{account.deductionPercentage}%</span
                      >
                    </div>
                  {:else}
                    <span class="text-red-600">✗</span>
                  {/if}
                </td>

                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900 max-w-xs truncate">
                    {account.description || "No description"}
                  </div>
                </td>

                <td
                  class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                >
                  <div class="flex items-center justify-end space-x-2">
                    <button
                      class="text-blue-600 hover:text-blue-900 transition-colors"
                      title="Edit Account"
                    >
                      ✏️
                    </button>
                    <button
                      class="text-gray-600 hover:text-gray-900 transition-colors"
                      title="View Transactions"
                    >
                      📊
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Account Type Breakdown -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <h3 class="text-lg font-semibold text-gray-900 mb-4">
      Tax Deduction Summary
    </h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="space-y-3">
        <h4 class="font-medium text-gray-700">Fully Deductible (100%)</h4>
        <div class="space-y-2">
          {#each accounts.filter((a) => a.taxDeductible && a.deductionPercentage === 100) as account}
            <div
              class="text-sm text-gray-600 flex items-center justify-between"
            >
              <span>{account.name}</span>
              <span class="text-green-600 font-medium">100%</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-3">
        <h4 class="font-medium text-gray-700">Partially Deductible</h4>
        <div class="space-y-2">
          {#each accounts.filter((a) => a.taxDeductible && a.deductionPercentage > 0 && a.deductionPercentage < 100) as account}
            <div
              class="text-sm text-gray-600 flex items-center justify-between"
            >
              <span>{account.name}</span>
              <span class="text-yellow-600 font-medium"
                >{account.deductionPercentage}%</span
              >
            </div>
          {/each}
        </div>
      </div>

      <div class="space-y-3">
        <h4 class="font-medium text-gray-700">Non-Deductible</h4>
        <div class="space-y-2">
          {#each accounts.filter((a) => !a.taxDeductible) as account}
            <div
              class="text-sm text-gray-600 flex items-center justify-between"
            >
              <span>{account.name}</span>
              <span class="text-red-600 font-medium">0%</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>
