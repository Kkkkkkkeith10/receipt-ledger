<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import ReceiptUpload from "$lib/components/ReceiptUpload.svelte";
  import ReceiptList from "$lib/components/ReceiptList.svelte";
  import ReceiptFilters from "$lib/components/ReceiptFilters.svelte";
  import type { Receipt, FilterParams } from "$lib/types";
  import { formatCurrency, getCurrencySymbol, convertToHKD, DEFAULT_EXCHANGE_RATES } from "$lib/utils/format";
  import type { SupportedCurrency } from "$lib/utils/format";
  import { getFiscalYear } from "$lib/utils/fiscal";
  import { findDuplicateClusters } from "$lib/utils/duplicates";
  import { isReceiptSuspicious } from "$lib/utils/receiptFlags";
  import { createReceiptUploadFormData } from "$lib/utils/receiptUpload";
  export let data: { receipts: Receipt[] };

  let showUpload = false;
  let showBulkUpload = false;
  let receipts: Receipt[] = data?.receipts ?? [];
  let filteredReceipts: Receipt[] = [];
  let searchQuery = "";
  let selectedCategory = "";
  let selectedStatus = "";
  // Fiscal year filter — "all" means no filter. Default chosen below in onMount.
  let selectedFiscalYear: number | "all" = "all";

  // Build the list of fiscal years present in the data, newest first.
  $: availableFiscalYears = Array.from(
    new Set(
      receipts
        .map((r) => {
          const d = r.date ? new Date(r.date) : null;
          return d && !isNaN(d.getTime()) ? getFiscalYear(d) : null;
        })
        .filter((fy): fy is number => fy !== null),
    ),
  ).sort((a, b) => b - a);

  // Currency display mode
  let displayMode: 'original' | 'converted' = 'original';
  let exchangeRates: Record<string, number> = { ...DEFAULT_EXCHANGE_RATES };

  // ----- Duplicate detection -----
  // Clusters are computed on demand by clicking the "Check Duplicates" button.
  // Each cluster is an array of receipt IDs that look like duplicates of each other.
  let duplicateClusters: string[][] = [];
  let duplicateScanRan = false;
  $: duplicateIds = new Set(duplicateClusters.flat());

  function checkForDuplicates() {
    duplicateClusters = findDuplicateClusters(
      scopedReceipts.map((r) => ({
        id: r.id,
        vendor: r.vendor ?? null,
        amount: r.amount ?? null,
        currency: r.currency ?? null,
        date: r.date ?? null,
      })),
    );
    duplicateScanRan = true;
  }

  function clearDuplicateScan() {
    duplicateClusters = [];
    duplicateScanRan = false;
  }

  function compareDuplicates() {
    if (duplicateClusters.length === 0) return;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(
        "duplicateClusters",
        JSON.stringify(duplicateClusters),
      );
    }
    goto("/receipts/compare");
  }

  function formatAmount(amount: number, currency?: string) {
    const curr = (currency ?? "HKD") as SupportedCurrency;
    return formatCurrency(amount, { currency: curr });
  }

  function toggleDisplayMode() {
    displayMode = displayMode === 'original' ? 'converted' : 'original';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('currencyDisplayMode', displayMode);
    }
  }

  // Restrict the currency totals + the visible list to the selected fiscal year.
  $: scopedReceipts =
    selectedFiscalYear === "all"
      ? receipts
      : receipts.filter((r) => {
          if (!r.date) return false;
          const d = new Date(r.date);
          return !isNaN(d.getTime()) && getFiscalYear(d) === selectedFiscalYear;
        });

  // When the fiscal year changes (or receipts reload), re-run the search filter.
  $: filteredReceipts = applySearch(scopedReceipts, {
    query: searchQuery,
    category: selectedCategory,
    status: selectedStatus,
  } as FilterParams);

  $: suspiciousReceipts = filteredReceipts.filter((receipt) =>
    isReceiptSuspicious(receipt),
  );
  $: suspiciousPendingCount = receipts.filter(
    (receipt) => receipt.status === "pending" && isReceiptSuspicious(receipt),
  ).length;

  function applySearch(list: Receipt[], f: FilterParams): Receipt[] {
    const q = (f.query ?? "").toLowerCase();
    return list.filter((r) => {
      const matchesQuery =
        !q ||
        r.vendor.toLowerCase().includes(q) ||
        (r.auditInfo?.businessPurpose ?? "").toLowerCase().includes(q);
      const matchesCategory = !f.category || r.category === f.category;
      const matchesStatus = !f.status || r.status === f.status;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }

  // Calculate currency breakdown - group receipts by currency (within selected FY)
  $: currencyBreakdown = scopedReceipts.reduce((acc, receipt) => {
    const currency = (receipt.currency || 'HKD') as SupportedCurrency;
    if (!acc[currency]) {
      acc[currency] = { total: 0, taxDeductible: 0, count: 0 };
    }
    acc[currency].total += receipt.amount;
    acc[currency].count += 1;
    if (receipt.taxDeductible) {
      acc[currency].taxDeductible += receipt.amount;
    }
    return acc;
  }, {} as Record<string, { total: number; taxDeductible: number; count: number }>);

  // Calculate totals converted to HKD
  $: totalInHKD = Object.entries(currencyBreakdown).reduce((sum, [currency, data]) => {
    return sum + convertToHKD(data.total, currency as SupportedCurrency, exchangeRates);
  }, 0);

  $: taxDeductibleInHKD = Object.entries(currencyBreakdown).reduce((sum, [currency, data]) => {
    return sum + convertToHKD(data.taxDeductible, currency as SupportedCurrency, exchangeRates);
  }, 0);

  // Bulk upload state
  let bulkFiles: File[] = [];
  let bulkUploadProgress: {
    file: string;
    status: "pending" | "uploading" | "success" | "error";
    message?: string;
  }[] = [];
  let isBulkUploading = false;
  let selectedReceiptIds = new Set<string>();
  let isBulkDeleting = false;

  $: visibleReceiptIds = filteredReceipts.map((receipt) => receipt.id);
  $: selectedVisibleCount = visibleReceiptIds.filter((receiptId) =>
    selectedReceiptIds.has(receiptId),
  ).length;
  $:
    allVisibleSelected =
      visibleReceiptIds.length > 0 &&
      selectedVisibleCount === visibleReceiptIds.length;
  $: {
    const visibleIdSet = new Set(visibleReceiptIds);
    const nextSelectedIds = [...selectedReceiptIds].filter((receiptId) =>
      visibleIdSet.has(receiptId),
    );

    if (nextSelectedIds.length !== selectedReceiptIds.size) {
      selectedReceiptIds = new Set(nextSelectedIds);
    }
  }

  // Initialize from server data
  onMount(() => {
    receipts = data?.receipts ?? [];

    // Load currency display settings from localStorage
    if (typeof localStorage !== 'undefined') {
      const savedMode = localStorage.getItem('currencyDisplayMode');
      if (savedMode === 'original' || savedMode === 'converted') {
        displayMode = savedMode;
      }
      const savedRates = localStorage.getItem('exchangeRates');
      if (savedRates) {
        try {
          exchangeRates = { ...DEFAULT_EXCHANGE_RATES, ...JSON.parse(savedRates) };
        } catch (e) {
          console.error('Failed to parse exchange rates:', e);
        }
      }
    }
  });

  function handleSearch(event: CustomEvent<FilterParams>) {
    // Update state; the reactive block above recomputes filteredReceipts
    // (so the fiscal-year filter and search filter compose).
    searchQuery = event.detail.query ?? "";
    selectedCategory = event.detail.category ?? "";
    selectedStatus = event.detail.status ?? "";
  }

  async function handleReceiptUploaded(event: CustomEvent<Receipt>) {
    // Receipt was already created during upload via /api/receipts/upload
    // Now we update it with the user's verified data (status = approved)
    const r = event.detail;

    // If receipt was saved during upload (has a proper receipt number format), update it
    // Receipt number format: RCP-YYYY-NNNN-HASH (e.g., RCP-2026-0014-fd5b70)
    const isUploadedReceipt = r.id && /^RCP-\d{4}-\d{4}-[a-f0-9]+$/i.test(r.id);

    if (isUploadedReceipt) {
      // Update existing receipt (created during upload)
      const res = await fetch(`/api/receipts/${r.id}`, {
        method: "PUT",
        body: JSON.stringify({
          vendor: r.vendor,
          amount: r.amount,
          date: r.date,
          category: r.category,
          status: "approved",
          taxDeductible: r.taxDeductible,
          receiptImageUrl: r.receiptImageUrl ?? null,
          receiptImageKey: r.receiptImageKey,
          notes: r.notes || "",
          auditInfo: r.auditInfo,
        }),
        headers: { "content-type": "application/json" },
      });

      if (res.ok) {
        // Prepend to list (remove any existing with same ID first)
        receipts = [r, ...receipts.filter((existing) => existing.id !== r.id)];
        showUpload = false;
      } else {
        const msg = await res.text();
        alert(`Failed to update receipt: ${msg}`);
      }
    } else {
      // Manual entry without upload - create new receipt
      const res = await fetch("/api/receipts", {
        method: "POST",
        body: JSON.stringify({
          vendor: r.vendor,
          amount: r.amount,
          date: r.date,
          category: r.category,
          status: "approved",
          taxDeductible: r.taxDeductible,
          receiptImageUrl: r.receiptImageUrl ?? null,
          notes: r.notes || "",
          auditInfo: r.auditInfo,
        }),
        headers: { "content-type": "application/json" },
      });

      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        if (result?.id) r.id = result.id;
        receipts = [r, ...receipts];
        showUpload = false;
      } else {
        const msg = await res.text();
        alert(`Failed to save receipt: ${msg}`);
      }
    }
  }

  function handleReceiptDeleted(event: CustomEvent<string>) {
    const deletedId = event.detail;
    receipts = receipts.filter((r) => r.id !== deletedId);

    if (selectedReceiptIds.has(deletedId)) {
      const nextSelectedIds = new Set(selectedReceiptIds);
      nextSelectedIds.delete(deletedId);
      selectedReceiptIds = nextSelectedIds;
    }
  }

  function toggleReceiptSelection(receiptId: string) {
    const nextSelectedIds = new Set(selectedReceiptIds);

    if (nextSelectedIds.has(receiptId)) {
      nextSelectedIds.delete(receiptId);
    } else {
      nextSelectedIds.add(receiptId);
    }

    selectedReceiptIds = nextSelectedIds;
  }

  function toggleAllVisibleSelection() {
    const nextSelectedIds = new Set(selectedReceiptIds);

    if (allVisibleSelected) {
      for (const receiptId of visibleReceiptIds) {
        nextSelectedIds.delete(receiptId);
      }
    } else {
      for (const receiptId of visibleReceiptIds) {
        nextSelectedIds.add(receiptId);
      }
    }

    selectedReceiptIds = nextSelectedIds;
  }

  function clearReceiptSelection() {
    selectedReceiptIds = new Set();
  }

  async function deleteSelectedReceipts() {
    if (selectedVisibleCount === 0 || isBulkDeleting) return;

    const receiptIdsToDelete = visibleReceiptIds.filter((receiptId) =>
      selectedReceiptIds.has(receiptId),
    );
    const confirmed = confirm(
      `Delete ${receiptIdsToDelete.length} selected receipt${receiptIdsToDelete.length === 1 ? "" : "s"}? They will be archived and removed from this list.`,
    );

    if (!confirmed) return;

    isBulkDeleting = true;
    const failedReceiptIds: string[] = [];

    for (const receiptId of receiptIdsToDelete) {
      try {
        const response = await fetch(`/api/receipts/${receiptId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          failedReceiptIds.push(receiptId);
        }
      } catch (error) {
        failedReceiptIds.push(receiptId);
      }
    }

    const failedReceiptIdSet = new Set(failedReceiptIds);
    const deletedReceiptIds = receiptIdsToDelete.filter(
      (receiptId) => !failedReceiptIdSet.has(receiptId),
    );

    if (deletedReceiptIds.length > 0) {
      const deletedReceiptIdSet = new Set(deletedReceiptIds);
      receipts = receipts.filter((receipt) => !deletedReceiptIdSet.has(receipt.id));
    }

    selectedReceiptIds = new Set(failedReceiptIds);
    isBulkDeleting = false;

    if (failedReceiptIds.length > 0) {
      alert(
        `Deleted ${deletedReceiptIds.length} receipt${deletedReceiptIds.length === 1 ? "" : "s"}, but ${failedReceiptIds.length} could not be removed.`,
      );
      return;
    }

    alert(
      `Deleted ${deletedReceiptIds.length} receipt${deletedReceiptIds.length === 1 ? "" : "s"}.`,
    );
  }

  // Bulk upload handlers
  function handleBulkFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files).filter((f) =>
        ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          f.type,
        ),
      );
      bulkFiles = [...bulkFiles, ...newFiles];
      bulkUploadProgress = bulkFiles.map((f) => ({
        file: f.name,
        status: "pending" as const,
      }));
    }
  }

  function handleBulkDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      const newFiles = Array.from(event.dataTransfer.files).filter((f) =>
        ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          f.type,
        ),
      );
      bulkFiles = [...bulkFiles, ...newFiles];
      bulkUploadProgress = bulkFiles.map((f) => ({
        file: f.name,
        status: "pending" as const,
      }));
    }
  }

  function removeBulkFile(index: number) {
    bulkFiles = bulkFiles.filter((_, i) => i !== index);
    bulkUploadProgress = bulkUploadProgress.filter((_, i) => i !== index);
  }

  async function startBulkUpload() {
    if (bulkFiles.length === 0) return;

    isBulkUploading = true;
    const newReceipts: Receipt[] = [];

    for (let i = 0; i < bulkFiles.length; i++) {
      const file = bulkFiles[i];
      bulkUploadProgress[i] = { file: file.name, status: "uploading" };
      bulkUploadProgress = [...bulkUploadProgress]; // trigger reactivity

      try {
        const formData = await createReceiptUploadFormData(file);

        const res = await fetch("/api/receipts/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          bulkUploadProgress[i] = {
            file: file.name,
            status: "success",
            message: `${data.receipt?.vendor || "Unknown"} - ${formatAmount(data.receipt?.amount || 0, data.receipt?.currency)}`,
          };
          if (data.receipt) {
            newReceipts.push(data.receipt);
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          bulkUploadProgress[i] = {
            file: file.name,
            status: "error",
            message: errorData.error || "Upload failed",
          };
        }
      } catch (err) {
        bulkUploadProgress[i] = {
          file: file.name,
          status: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        };
      }
      bulkUploadProgress = [...bulkUploadProgress]; // trigger reactivity
    }

    // Add successfully uploaded receipts to list
    if (newReceipts.length > 0) {
      receipts = [...newReceipts, ...receipts];
    }

    isBulkUploading = false;
  }

  function closeBulkUpload() {
    showBulkUpload = false;
    bulkFiles = [];
    bulkUploadProgress = [];
  }
</script>

<div class="space-y-4 md:space-y-6">
  <!-- Page Header -->
  <div
    class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
  >
    <div>
      <h1 class="text-2xl md:text-3xl font-bold text-gray-900">Receipts</h1>
      <p class="text-sm md:text-base text-gray-600 mt-1">
        Manage and process your business receipts
      </p>
    </div>
    <div class="flex flex-wrap gap-2 md:gap-3">
      <!-- Fiscal Year Filter -->
      <label class="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg border border-gray-300">
        <span class="text-gray-500">📅</span>
        <span class="sr-only">Fiscal year</span>
        <select
          bind:value={selectedFiscalYear}
          class="bg-transparent border-0 focus:ring-0 text-sm pr-1 cursor-pointer"
          aria-label="Filter by fiscal year"
        >
          <option value="all">All fiscal years</option>
          {#each availableFiscalYears as fy}
            <option value={fy}>FY{fy}</option>
          {/each}
        </select>
      </label>

      <!-- Currency Toggle Button -->
      <button
        on:click={toggleDisplayMode}
        class="px-3 md:px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
        title={displayMode === 'original' ? 'Click to show all amounts in HKD' : 'Click to show original currencies'}
      >
        {#if displayMode === 'original'}
          💱 Original
        {:else}
          🇭🇰 HKD
        {/if}
      </button>
      <!-- Duplicate Scan Button -->
      <button
        on:click={checkForDuplicates}
        class="px-3 md:px-4 py-2 bg-amber-100 text-amber-800 text-sm rounded-lg hover:bg-amber-200 transition-colors border border-amber-300"
        title="Scan all visible receipts for likely duplicates"
      >
        🔍 Check Duplicates
      </button>
      {#if receipts.filter((r) => r.status === "pending").length > 0}
        <a
          href="/receipts/approve"
          class="px-3 md:px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 transition-colors"
        >
          ⚡ Approve ({receipts.filter((r) => r.status === "pending").length})
        </a>
      {/if}
      <button
        on:click={() => (showUpload = true)}
        class="px-3 md:px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
      >
        📸 Upload
      </button>
      <button
        on:click={() => (showBulkUpload = true)}
        class="px-3 md:px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        📤 Bulk
      </button>
    </div>
  </div>

  <!-- Upload Modal -->
  {#if showUpload}
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div
        class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-gray-900">Upload Receipt</h2>
            <button
              on:click={() => (showUpload = false)}
              class="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <ReceiptUpload on:uploaded={handleReceiptUploaded} />
        </div>
      </div>
    </div>
  {/if}

  <!-- Bulk Upload Modal -->
  {#if showBulkUpload}
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div
        class="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-gray-900">
              Bulk Upload Receipts
            </h2>
            <button
              on:click={closeBulkUpload}
              class="text-gray-400 hover:text-gray-600"
              disabled={isBulkUploading}
            >
              ✕
            </button>
          </div>

          <!-- Drop Zone -->
          <div
            role="button"
            tabindex="0"
            class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors mb-4"
            on:dragover|preventDefault
            on:drop={handleBulkDrop}
            on:keydown={() => {}}
          >
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              on:change={handleBulkFileSelect}
              class="hidden"
              id="bulk-file-input"
              disabled={isBulkUploading}
            />
            <label for="bulk-file-input" class="cursor-pointer">
              <div class="text-4xl mb-2">📁</div>
              <p class="text-lg font-medium text-gray-700">
                Drop multiple receipt images here
              </p>
              <p class="text-sm text-gray-500">
                or click to browse (JPG, PNG, PDF)
              </p>
            </label>
          </div>

          <!-- File List -->
          {#if bulkFiles.length > 0}
            <div class="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {#each bulkUploadProgress as item, i}
                <div
                  class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div class="flex items-center space-x-3 flex-1 min-w-0">
                    <span class="text-xl">
                      {#if item.status === "pending"}📄
                      {:else if item.status === "uploading"}⏳
                      {:else if item.status === "success"}✅
                      {:else}❌
                      {/if}
                    </span>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-700 truncate">
                        {item.file}
                      </p>
                      {#if item.message}
                        <p
                          class="text-xs {item.status === 'error'
                            ? 'text-red-500'
                            : 'text-green-600'} truncate"
                        >
                          {item.message}
                        </p>
                      {/if}
                    </div>
                  </div>
                  {#if item.status === "pending" && !isBulkUploading}
                    <button
                      on:click={() => removeBulkFile(i)}
                      class="text-gray-400 hover:text-red-500 ml-2"
                    >
                      ✕
                    </button>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- Upload Summary -->
            <div
              class="flex items-center justify-between p-3 bg-blue-50 rounded-lg mb-4"
            >
              <span class="text-sm text-blue-700">
                {bulkFiles.length} file{bulkFiles.length === 1 ? "" : "s"} selected
                {#if bulkUploadProgress.filter((p) => p.status === "success").length > 0}
                  • {bulkUploadProgress.filter((p) => p.status === "success")
                    .length} uploaded
                {/if}
                {#if bulkUploadProgress.filter((p) => p.status === "error").length > 0}
                  • {bulkUploadProgress.filter((p) => p.status === "error")
                    .length} failed
                {/if}
              </span>
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-end space-x-3">
              <button
                on:click={closeBulkUpload}
                class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={isBulkUploading}
              >
                {isBulkUploading ? "Processing..." : "Cancel"}
              </button>
              {#if !isBulkUploading && bulkUploadProgress.some((p) => p.status === "pending")}
                <button
                  on:click={startBulkUpload}
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Upload {bulkUploadProgress.filter(
                    (p) => p.status === "pending",
                  ).length} Receipt{bulkUploadProgress.filter(
                    (p) => p.status === "pending",
                  ).length === 1
                    ? ""
                    : "s"}
                </button>
              {:else if !isBulkUploading}
                <button
                  on:click={closeBulkUpload}
                  class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Done
                </button>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Filters and Search -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <ReceiptFilters on:filter={handleSearch} />
  </div>

  <!-- Receipt Statistics -->
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600">Total Receipts</p>
          <p class="text-2xl font-bold text-gray-900">{receipts.length}</p>
        </div>
        <span class="text-2xl">🧾</span>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600">Pending Review</p>
          <p class="text-2xl font-bold text-yellow-600">
            {receipts.filter((r) => r.status === "pending").length}
          </p>
        </div>
        <span class="text-2xl">⏳</span>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600">Total Amount {displayMode === 'converted' ? '(HKD)' : ''}</p>
          {#if displayMode === 'converted'}
            <p class="text-2xl font-bold text-gray-900">
              {formatAmount(totalInHKD, 'HKD')}
            </p>
          {:else}
            <div class="space-y-1">
              {#each Object.entries(currencyBreakdown) as [currency, data]}
                <p class="text-lg font-bold text-gray-900">
                  {formatAmount(data.total, currency)}
                  <span class="text-xs text-gray-500 font-normal">({data.count})</span>
                </p>
              {/each}
              {#if Object.keys(currencyBreakdown).length === 0}
                <p class="text-lg text-gray-400">-</p>
              {/if}
            </div>
          {/if}
        </div>
        <span class="text-2xl">💰</span>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600">Tax Deductible {displayMode === 'converted' ? '(HKD)' : ''}</p>
          {#if displayMode === 'converted'}
            <p class="text-2xl font-bold text-green-600">
              {formatAmount(taxDeductibleInHKD, 'HKD')}
            </p>
          {:else}
            <div class="space-y-1">
              {#each Object.entries(currencyBreakdown).filter(([_, data]) => data.taxDeductible > 0) as [currency, data]}
                <p class="text-lg font-bold text-green-600">
                  {formatAmount(data.taxDeductible, currency)}
                </p>
              {/each}
              {#if Object.entries(currencyBreakdown).filter(([_, data]) => data.taxDeductible > 0).length === 0}
                <p class="text-lg text-gray-400">-</p>
              {/if}
            </div>
          {/if}
        </div>
        <span class="text-2xl">🏛️</span>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600">Suspicious</p>
          <p class="text-2xl font-bold text-rose-600">
            {suspiciousReceipts.length}
          </p>
          <p class="text-xs text-gray-500 mt-1">Current view</p>
        </div>
        <span class="text-2xl">🚩</span>
      </div>
    </div>
  </div>

  {#if suspiciousReceipts.length > 0}
    <div
      class="rounded-xl border border-rose-200 bg-rose-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div class="flex items-start gap-3">
        <span class="text-2xl">🚩</span>
        <div>
          <p class="font-medium text-rose-900">
            Found {suspiciousReceipts.length} suspicious receipt{suspiciousReceipts.length === 1
              ? ""
              : "s"} in the current view.
          </p>
          <p class="text-sm text-rose-700">
            These rows are highlighted in red below. Zero-dollar amounts, missing vendors, and future dates should be checked before approval.
          </p>
        </div>
      </div>
      {#if suspiciousPendingCount > 0}
        <a
          href="/receipts/approve"
          class="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors"
        >
          Review {suspiciousPendingCount} pending suspicious
        </a>
      {/if}
    </div>
  {/if}

  <!-- Duplicate Scan Banner -->
  {#if duplicateScanRan}
    <div
      class="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3
             {duplicateClusters.length > 0
               ? 'bg-amber-50 border-amber-300 text-amber-900'
               : 'bg-green-50 border-green-300 text-green-900'}"
    >
      <div class="flex items-start gap-3">
        <span class="text-2xl">
          {duplicateClusters.length > 0 ? "⚠️" : "✅"}
        </span>
        <div>
          {#if duplicateClusters.length > 0}
            <p class="font-medium">
              Found {duplicateClusters.length} duplicate
              {duplicateClusters.length === 1 ? "group" : "groups"}
              ({duplicateIds.size} receipts)
            </p>
            <p class="text-sm opacity-80">
              Highlighted in amber below. Click "Compare Side-by-Side" to
              review and resolve them.
            </p>
          {:else}
            <p class="font-medium">No duplicates found in the current view.</p>
            <p class="text-sm opacity-80">
              Scanned {scopedReceipts.length} receipts.
            </p>
          {/if}
        </div>
      </div>
      <div class="flex gap-2">
        {#if duplicateClusters.length > 0}
          <button
            on:click={compareDuplicates}
            class="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
          >
            Compare Side-by-Side →
          </button>
        {/if}
        <button
          on:click={clearDuplicateScan}
          class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          Dismiss
        </button>
      </div>
    </div>
  {/if}

  {#if selectedVisibleCount > 0}
    <div class="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="flex items-start gap-3">
        <span class="text-2xl">🗑️</span>
        <div>
          <p class="font-medium text-red-900">
            {selectedVisibleCount} receipt{selectedVisibleCount === 1 ? "" : "s"} selected.
          </p>
          <p class="text-sm text-red-700">
            Use the checkboxes in the table to select multiple receipts, then delete them together.
          </p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          on:click={clearReceiptSelection}
          class="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm"
          disabled={isBulkDeleting}
        >
          Clear selection
        </button>
        <button
          on:click={deleteSelectedReceipts}
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:cursor-not-allowed disabled:bg-red-300"
          disabled={isBulkDeleting}
        >
          {#if isBulkDeleting}
            Deleting...
          {:else}
            Delete selected
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <!-- Receipt List -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200">
    <ReceiptList
      receipts={filteredReceipts}
      highlightIds={duplicateIds}
      selectedIds={selectedReceiptIds}
      on:delete={handleReceiptDeleted}
      on:selectiontoggle={(event) => toggleReceiptSelection(event.detail)}
      on:selectiontoggleall={toggleAllVisibleSelection}
    />
  </div>
</div>
