<script lang="ts">
  import { onMount } from "svelte";
  import {
    DEFAULT_EXCHANGE_RATES,
    getSupportedCurrencies,
  } from "$lib/utils/format";
  import type { SupportedCurrency } from "$lib/utils/format";

  // Exchange rates (to HKD)
  let exchangeRates: Record<SupportedCurrency, number> = {
    ...DEFAULT_EXCHANGE_RATES,
  };
  const supportedCurrencies = getSupportedCurrencies();

  // Load exchange rates from localStorage on mount
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
  });

  // Settings data
  let settings = {
    company: {
      name: "Example Company Ltd.",
      taxId: "12345678",
      address:
        "1 Example Road, Hong Kong",
      phone: "+852-1234-5678",
      email: "accounting@example.com",
      currency: "HKD",
    },
    preferences: {
      dateFormat: "MM/DD/YYYY",
      numberFormat: "comma",
      defaultCategory: "5000",
      autoApprove: false,
      emailNotifications: true,
      reminderDays: 7,
    },
    integrations: {
      azureOpenAI: {
        enabled: false,
        endpoint: "",
        key: "••••••••",
        model: "gpt-4-vision-preview",
        confidenceThreshold: 0.85,
      },
      cloudflareR2: {
        enabled: false,
        bucketName: "accounting-receipts",
        region: "auto",
      },
      banking: {
        enabled: false,
        provider: "",
        lastSync: null,
      },
    },
    backup: {
      autoBackup: true,
      frequency: "weekly",
      retentionDays: 365,
      lastBackup: "2025-08-30T10:00:00Z",
    },
  };

  let activeTab = "company";

  const tabs = [
    { id: "company", label: "Company Info", icon: "🏢" },
    { id: "exchangeRates", label: "Exchange Rates", icon: "💱" },
    { id: "preferences", label: "Preferences", icon: "⚙️" },
    { id: "integrations", label: "Integrations", icon: "🔌" },
    { id: "backup", label: "Backup & Security", icon: "🔒" },
  ];

  const currencies = [
    { value: "HKD", label: "Hong Kong Dollar (HKD)" },
    { value: "JPY", label: "Japanese Yen (JPY)" },
    { value: "TWD", label: "Taiwan Dollar (TWD)" },
    { value: "USD", label: "US Dollar (USD)" },
    { value: "CNY", label: "Chinese Yuan (CNY)" },
    { value: "EUR", label: "Euro (EUR)" },
    { value: "GBP", label: "British Pound (GBP)" },
  ];

  const dateFormats = [
    { value: "MM/DD/YYYY", label: "MM/DD/YYYY (08/31/2025)" },
    { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/08/2025)" },
    { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2025-08-31)" },
  ];

  function saveSettings() {
    // Save exchange rates to localStorage
    localStorage.setItem("exchangeRates", JSON.stringify(exchangeRates));
    console.log("Saving settings:", settings);
    console.log("Saving exchange rates:", exchangeRates);
    alert("Settings saved successfully!");
  }

  function resetExchangeRates() {
    if (confirm("Reset all exchange rates to default values?")) {
      exchangeRates = { ...DEFAULT_EXCHANGE_RATES };
      localStorage.setItem("exchangeRates", JSON.stringify(exchangeRates));
      alert("Exchange rates reset to defaults");
    }
  }

  function testIntegration(integration: string) {
    console.log(`Testing ${integration} integration...`);
    alert(`Testing ${integration} connection...`);
  }

  function createBackup() {
    console.log("Creating backup...");
    alert("Creating backup of all data and receipts...");
  }

  function resetSettings() {
    if (
      confirm(
        "Are you sure you want to reset all settings to defaults? This action cannot be undone.",
      )
    ) {
      console.log("Resetting settings to defaults");
      alert("Settings have been reset to defaults");
    }
  }
</script>

<div class="space-y-4 md:space-y-6">
  <!-- Page Header -->
  <div
    class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
  >
    <div>
      <h1 class="text-2xl md:text-3xl font-bold text-gray-900">Settings</h1>
      <p class="text-sm md:text-base text-gray-600 mt-1">
        Configure your accounting system preferences and integrations
      </p>
    </div>
    <div class="flex flex-wrap gap-2 md:gap-3">
      <button
        on:click={createBackup}
        class="px-3 md:px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
      >
        💾 Backup
      </button>
      <button
        on:click={saveSettings}
        class="px-3 md:px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        💾 Save
      </button>
    </div>
  </div>

  <!-- Settings Tabs -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200">
    <div class="border-b border-gray-200 overflow-x-auto">
      <nav class="flex space-x-2 md:space-x-8 px-4 md:px-6 min-w-max">
        {#each tabs as tab}
          <button
            on:click={() => (activeTab = tab.id)}
            class="py-3 md:py-4 px-2 md:px-1 border-b-2 font-medium text-xs md:text-sm whitespace-nowrap transition-colors {activeTab ===
            tab.id
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >
            <span class="mr-1 md:mr-2">{tab.icon}</span>
            <span class="hidden sm:inline">{tab.label}</span>
            <span class="sm:hidden">{tab.label.split(" ")[0]}</span>
          </button>
        {/each}
      </nav>
    </div>

    <div class="p-4 md:p-6">
      {#if activeTab === "company"}
        <!-- Company Information -->
        <div class="space-y-4 md:space-y-6">
          <h3 class="text-lg font-medium text-gray-900">Company Information</h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label
                for="company-name"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Company Name
              </label>
              <input
                id="company-name"
                type="text"
                bind:value={settings.company.name}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                for="tax-id"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Tax ID Number
              </label>
              <input
                id="tax-id"
                type="text"
                bind:value={settings.company.taxId}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div class="md:col-span-2">
              <label
                for="address"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Business Address
              </label>
              <textarea
                id="address"
                bind:value={settings.company.address}
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              ></textarea>
            </div>

            <div>
              <label
                for="phone"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                bind:value={settings.company.phone}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                for="email"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                bind:value={settings.company.email}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                for="currency"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Default Currency
              </label>
              <select
                id="currency"
                bind:value={settings.company.currency}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {#each currencies as currency}
                  <option value={currency.value}>{currency.label}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>
      {:else if activeTab === "exchangeRates"}
        <!-- Exchange Rates -->
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-medium text-gray-900">Exchange Rates</h3>
              <p class="text-sm text-gray-500 mt-1">
                Set exchange rates for converting foreign currencies to HKD on
                the dashboard
              </p>
            </div>
            <button
              on:click={resetExchangeRates}
              class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reset to Defaults
            </button>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-start gap-3">
              <span class="text-blue-500 text-xl">💡</span>
              <div class="text-sm text-blue-800">
                <p class="font-medium mb-1">How exchange rates work:</p>
                <p>
                  Enter the rate for 1 unit of each currency in HKD. For
                  example, if 1 USD = 7.80 HKD, enter 7.80 for USD.
                </p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each supportedCurrencies.filter((c) => c.code !== "HKD") as currency}
              <div class="bg-white border border-gray-200 rounded-lg p-4">
                <label
                  for="rate-{currency.code}"
                  class="flex items-center justify-between mb-2"
                >
                  <span class="font-medium text-gray-900">{currency.code}</span>
                  <span class="text-sm text-gray-500">{currency.name}</span>
                </label>
                <div class="flex items-center gap-2">
                  <span class="text-gray-500 text-sm">1 {currency.code} =</span>
                  <input
                    id="rate-{currency.code}"
                    type="number"
                    step="0.0001"
                    min="0"
                    bind:value={exchangeRates[currency.code]}
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                  />
                  <span class="text-gray-700 font-medium">HKD</span>
                </div>
                <p class="text-xs text-gray-400 mt-2">
                  Default: {DEFAULT_EXCHANGE_RATES[currency.code]}
                </p>
              </div>
            {/each}
          </div>

          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 class="font-medium text-gray-900 mb-2">
              🔄 Example Conversions
            </h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {#each supportedCurrencies.filter((c) => c.code !== "HKD") as currency}
                <div class="bg-white rounded p-2 text-center">
                  <p class="text-gray-500">100 {currency.code}</p>
                  <p class="font-medium text-gray-900">
                    = HK${(100 * exchangeRates[currency.code]).toFixed(2)}
                  </p>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else if activeTab === "preferences"}
        <!-- User Preferences -->
        <div class="space-y-6">
          <h3 class="text-lg font-medium text-gray-900">User Preferences</h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                for="date-format"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Date Format
              </label>
              <select
                id="date-format"
                bind:value={settings.preferences.dateFormat}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {#each dateFormats as format}
                  <option value={format.value}>{format.label}</option>
                {/each}
              </select>
            </div>

            <div>
              <label
                for="default-category"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Default Expense Category
              </label>
              <select
                id="default-category"
                bind:value={settings.preferences.defaultCategory}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="5000">Office Supplies</option>
                <option value="5100">Travel & Transportation</option>
                <option value="5200">Meals & Entertainment</option>
                <option value="5300">Professional Services</option>
              </select>
            </div>

            <div>
              <label
                for="reminder-days"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Receipt Review Reminder (days)
              </label>
              <input
                id="reminder-days"
                type="number"
                min="1"
                max="30"
                bind:value={settings.preferences.reminderDays}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div class="space-y-4">
            <h4 class="font-medium text-gray-900">Automation Settings</h4>

            <div class="space-y-3">
              <label class="flex items-center">
                <input
                  type="checkbox"
                  bind:checked={settings.preferences.autoApprove}
                  class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700"
                  >Auto-approve receipts with high OCR confidence (>95%)</span
                >
              </label>

              <label class="flex items-center">
                <input
                  type="checkbox"
                  bind:checked={settings.preferences.emailNotifications}
                  class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700"
                  >Send email notifications for pending receipts</span
                >
              </label>
            </div>
          </div>
        </div>
      {:else if activeTab === "integrations"}
        <!-- Integrations -->
        <div class="space-y-6">
          <h3 class="text-lg font-medium text-gray-900">System Integrations</h3>

          <!-- Azure OpenAI -->
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center space-x-3">
                <span class="text-2xl">🤖</span>
                <div>
                  <h4 class="font-medium text-gray-900">Azure OpenAI (OCR)</h4>
                  <p class="text-sm text-gray-600">
                    AI-powered receipt data extraction
                  </p>
                </div>
              </div>
              <label class="flex items-center">
                <input
                  type="checkbox"
                  bind:checked={settings.integrations.azureOpenAI.enabled}
                  class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700">Enabled</span>
              </label>
            </div>

            {#if settings.integrations.azureOpenAI.enabled}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    API Endpoint
                  </label>
                  <input
                    type="url"
                    bind:value={settings.integrations.azureOpenAI.endpoint}
                    placeholder="https://your-resource.openai.azure.com/"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    bind:value={settings.integrations.azureOpenAI.model}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Confidence Threshold
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    bind:value={
                      settings.integrations.azureOpenAI.confidenceThreshold
                    }
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div class="flex items-end">
                  <button
                    on:click={() => testIntegration("Azure OpenAI")}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    🧪 Test Connection
                  </button>
                </div>
              </div>
            {/if}
          </div>

          <!-- Cloudflare R2 -->
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center space-x-3">
                <span class="text-2xl">☁️</span>
                <div>
                  <h4 class="font-medium text-gray-900">
                    Cloudflare R2 Storage
                  </h4>
                  <p class="text-sm text-gray-600">
                    Receipt image storage and CDN
                  </p>
                </div>
              </div>
              <label class="flex items-center">
                <input
                  type="checkbox"
                  bind:checked={settings.integrations.cloudflareR2.enabled}
                  class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700">Enabled</span>
              </label>
            </div>

            {#if settings.integrations.cloudflareR2.enabled}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Bucket Name
                  </label>
                  <input
                    type="text"
                    bind:value={settings.integrations.cloudflareR2.bucketName}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div class="flex items-end">
                  <button
                    on:click={() => testIntegration("Cloudflare R2")}
                    class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    🧪 Test Connection
                  </button>
                </div>
              </div>
            {/if}
          </div>

          <!-- Banking Integration -->
          <div class="border border-gray-200 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center space-x-3">
                <span class="text-2xl">🏦</span>
                <div>
                  <h4 class="font-medium text-gray-900">Banking Integration</h4>
                  <p class="text-sm text-gray-600">
                    Automatic transaction import (Future)
                  </p>
                </div>
              </div>
              <span
                class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800"
              >
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      {:else if activeTab === "backup"}
        <!-- Backup & Security -->
        <div class="space-y-6">
          <h3 class="text-lg font-medium text-gray-900">Backup & Security</h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 class="font-medium text-gray-900 mb-3">Automatic Backup</h4>

              <div class="space-y-3">
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={settings.backup.autoBackup}
                    class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span class="ml-2 text-sm text-gray-700"
                    >Enable automatic backups</span
                  >
                </label>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Backup Frequency
                  </label>
                  <select
                    bind:value={settings.backup.frequency}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Retention Period (days)
                  </label>
                  <input
                    type="number"
                    min="7"
                    max="1095"
                    bind:value={settings.backup.retentionDays}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 class="font-medium text-gray-900 mb-3">Backup Status</h4>

              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Last Backup</span>
                  <span class="text-sm font-medium text-green-600"
                    >Aug 30, 2025</span
                  >
                </div>

                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Next Scheduled</span>
                  <span class="text-sm font-medium text-blue-600"
                    >Sep 6, 2025</span
                  >
                </div>

                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Backup Size</span>
                  <span class="text-sm font-medium text-gray-900">45.2 MB</span>
                </div>

                <div class="pt-2">
                  <button
                    on:click={createBackup}
                    class="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    💾 Create Backup Now
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="border-t pt-6">
            <h4 class="font-medium text-gray-900 mb-3">Data Export</h4>

            <div class="flex flex-wrap gap-3">
              <button
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📊 Export All Data (CSV)
              </button>
              <button
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                🖼️ Download All Receipts (ZIP)
              </button>
              <button
                class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                📋 Export Transactions (JSON)
              </button>
            </div>
          </div>

          <div class="border-t pt-6">
            <h4 class="font-medium text-red-700 mb-3">Danger Zone</h4>

            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <p class="text-sm text-red-600 mb-3">
                Reset all settings to their default values. This action cannot
                be undone.
              </p>
              <button
                on:click={resetSettings}
                class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                🔄 Reset All Settings
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
