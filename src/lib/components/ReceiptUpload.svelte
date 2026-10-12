<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { DEFAULT_CATEGORIES, getCategoryName } from "$lib/categories";
  import { createReceiptUploadFormData } from "$lib/utils/receiptUpload";
  import type { ReceiptFormData } from "$lib/types";

  const dispatch = createEventDispatcher();

  // Form data
  let receiptData: ReceiptFormData = {
    vendor: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    category: "",
    paymentMethod: "card",
    auditInfo: {
      businessPurpose: "",
      projectCode: "",
      location: "",
      attendees: "",
      businessMeal: false,
      travelRelated: false,
    },
    notes: "",
    tags: [],
  };

  // Saved receipt data from upload API
  let savedReceiptNumber: string | null = null;
  let savedReceiptImageUrl: string | null = null;
  let savedReceiptImageKey: string | null = null;

  let selectedFile: File | null = null;
  let dragActive = false;
  let uploadProgress = 0;
  let isProcessing = false;

  // Use categories from categories.ts (consistent with AI and API)
  const categories = DEFAULT_CATEGORIES.filter((c) => c.active);
  const paymentMethods = [
    { value: "cash", label: "Cash" },
    { value: "card", label: "Card" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "octopus", label: "Octopus" },
    { value: "fps", label: "FPS" },
    { value: "payme", label: "PayMe" },
  ];

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragActive = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    dragActive = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragActive = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }

  function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }

  function handleFileSelect(file: File) {
    // Validate file type and size
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a JPG, PNG, or PDF file.");
      return;
    }

    if (file.size > maxSize) {
      alert("File size must be less than 10MB.");
      return;
    }

    selectedFile = file;

    // Start AI receipt recognition (with orientation fix for images)
    processReceiptImage(file);
  }

  async function processReceiptImage(file: File) {
    isProcessing = true;
    uploadProgress = 0;

    // Start progress indicator
    const progressInterval = setInterval(() => {
      if (uploadProgress < 90) {
        uploadProgress += 5;
      }
    }, 300);

    try {
      // Use unified upload API - saves to R2, runs AI, saves to D1
      const formData = await createReceiptUploadFormData(file);

      const response = await fetch("/api/receipts/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      uploadProgress = 100;

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();

      if (result.success && result.receipt) {
        const r = result.receipt;

        // Store saved receipt info
        savedReceiptNumber = result.receiptNumber;
        savedReceiptImageUrl = result.pdfUrl;
        savedReceiptImageKey = r.receiptImageKey;

        // Update form with AI-recognized data
        receiptData = {
          ...receiptData,
          vendor: r.vendor || "",
          amount: r.amount || 0,
          date: r.date || receiptData.date,
          category: r.category || "",
          paymentMethod: r.paymentMethod || "card",
          auditInfo: {
            ...receiptData.auditInfo,
            businessPurpose:
              r.auditInfo?.businessPurpose || r.ocrData?.description || "",
          },
          notes: r.ocrData?.brNumber ? `BR: ${r.ocrData.brNumber}` : "",
        };

        // Store OCR data for reference
        (receiptData as any).ocrData = r.ocrData;
      }
    } catch (error) {
      console.error("Upload/recognition error:", error);
      // Fall back to manual entry
      alert(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}. Please try again or enter details manually.`,
      );
    } finally {
      clearInterval(progressInterval);
      isProcessing = false;
    }
  }

  function handleSubmit() {
    // Validate required fields
    if (
      !receiptData.vendor ||
      !receiptData.amount ||
      !receiptData.category ||
      !receiptData.auditInfo.businessPurpose
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    if (receiptData.auditInfo.businessPurpose.length < 10) {
      alert("Business purpose must be at least 10 characters long.");
      return;
    }

    // Create receipt object with saved data
    const matchingCategory = categories.find(
      (c) => c.id === receiptData.category,
    );
    const receiptToSave = {
      id: savedReceiptNumber || `RCP-${Date.now()}`,
      ...receiptData,
      status: "approved",
      taxDeductible: matchingCategory?.taxDeductible ?? true,
      categoryName:
        matchingCategory?.name || getCategoryName(receiptData.category),
      receiptImageUrl: savedReceiptImageUrl,
      receiptImageKey: savedReceiptImageKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dispatch("uploaded", receiptToSave);
  }

  function clearForm() {
    receiptData = {
      vendor: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      category: "",
      paymentMethod: "card",
      auditInfo: {
        businessPurpose: "",
        projectCode: "",
        location: "",
        attendees: "",
        businessMeal: false,
        travelRelated: false,
      },
      notes: "",
      tags: [],
    };
    selectedFile = null;
    uploadProgress = 0;
    isProcessing = false;
    savedReceiptNumber = null;
    savedReceiptImageUrl = null;
    savedReceiptImageKey = null;
  }
</script>

<div class="space-y-6">
  <!-- File Upload Area -->
  <div class="space-y-4">
    <h3 class="text-lg font-medium text-gray-900">Upload Receipt Image</h3>

    <div
      role="button"
      tabindex="0"
      class="relative border-2 border-dashed {dragActive
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-300'} rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
      on:dragover={handleDragOver}
      on:dragleave={handleDragLeave}
      on:drop={handleDrop}
      on:keydown={() => {}}
    >
      {#if selectedFile}
        <div class="space-y-4">
          <div class="flex items-center justify-center">
            <span class="text-4xl">📄</span>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900">{selectedFile.name}</p>
            <p class="text-sm text-gray-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>

          {#if isProcessing}
            <div class="space-y-2">
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style="width: {uploadProgress}%"
                ></div>
              </div>
              <p class="text-sm text-blue-600">
                Processing with AI OCR... {Math.round(uploadProgress)}%
              </p>
            </div>
          {/if}
        </div>
      {:else}
        <div class="space-y-4">
          <div class="flex items-center justify-center">
            <span class="text-4xl text-gray-400">📸</span>
          </div>
          <div>
            <p class="text-lg font-medium text-gray-900">
              Drop receipt image here
            </p>
            <p class="text-sm text-gray-500">or click to browse files</p>
            <p class="text-xs text-gray-400 mt-2">
              Supports JPG, PNG, PDF up to 10MB
            </p>
          </div>
          <input
            type="file"
            accept="image/*,.pdf"
            on:change={handleFileInput}
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      {/if}
    </div>
  </div>

  <!-- Receipt Information Form -->
  <form on:submit|preventDefault={handleSubmit} class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Vendor -->
      <div>
        <label
          for="vendor"
          class="block text-sm font-medium text-gray-700 mb-1"
        >
          Vendor/Merchant Name <span class="text-red-500">*</span>
        </label>
        <input
          id="vendor"
          type="text"
          required
          bind:value={receiptData.vendor}
          placeholder="e.g., Office Depot Hong Kong"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Amount -->
      <div>
        <label
          for="amount"
          class="block text-sm font-medium text-gray-700 mb-1"
        >
          Amount (HKD) <span class="text-red-500">*</span>
        </label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          required
          bind:value={receiptData.amount}
          placeholder="0.00"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Date -->
      <div>
        <label for="date" class="block text-sm font-medium text-gray-700 mb-1">
          Purchase Date <span class="text-red-500">*</span>
        </label>
        <input
          id="date"
          type="date"
          required
          bind:value={receiptData.date}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Category -->
      <div>
        <label
          for="category"
          class="block text-sm font-medium text-gray-700 mb-1"
        >
          Expense Category <span class="text-red-500">*</span>
        </label>
        <select
          id="category"
          required
          bind:value={receiptData.category}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a category</option>
          {#each categories as category}
            <option value={category.id}>
              {category.icon}
              {category.name}
            </option>
          {/each}
        </select>
      </div>

      <!-- Payment Method -->
      <div>
        <label
          for="payment-method"
          class="block text-sm font-medium text-gray-700 mb-1"
        >
          Payment Method
        </label>
        <select
          id="payment-method"
          bind:value={receiptData.paymentMethod}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {#each paymentMethods as method}
            <option value={method.value}>{method.label}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Business Purpose (Required for Tax Compliance) -->
    <div>
      <label
        for="business-purpose"
        class="block text-sm font-medium text-gray-700 mb-1"
      >
        Business Purpose <span class="text-red-500">*</span>
      </label>
      <textarea
        id="business-purpose"
        required
        minlength="10"
        bind:value={receiptData.auditInfo.businessPurpose}
        placeholder="Describe the business purpose for this expense (minimum 10 characters for tax compliance)"
        rows="3"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      ></textarea>
      <p class="text-sm text-gray-500 mt-1">
        Characters: {receiptData.auditInfo.businessPurpose.length}/10 minimum
      </p>
    </div>

    <!-- Additional Information -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label
          for="project-code"
          class="block text-sm font-medium text-gray-700 mb-1"
        >
          Project Code (Optional)
        </label>
        <input
          id="project-code"
          type="text"
          bind:value={receiptData.auditInfo.projectCode}
          placeholder="e.g., PROJ-2025-001"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          for="location"
          class="block text-sm font-medium text-gray-700 mb-1"
        >
          Location
        </label>
        <input
          id="location"
          type="text"
          bind:value={receiptData.auditInfo.location}
          placeholder="e.g., Taipei Main Office"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>

    <!-- Special Categories -->
    <div class="flex flex-wrap gap-4">
      <label class="flex items-center">
        <input
          type="checkbox"
          bind:checked={receiptData.auditInfo.businessMeal}
          class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
        />
        <span class="ml-2 text-sm text-gray-700"
          >Business Meal (50% deductible)</span
        >
      </label>

      <label class="flex items-center">
        <input
          type="checkbox"
          bind:checked={receiptData.auditInfo.travelRelated}
          class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
        />
        <span class="ml-2 text-sm text-gray-700">Travel Related</span>
      </label>
    </div>

    <!-- Notes -->
    <div>
      <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">
        Additional Notes
      </label>
      <textarea
        id="notes"
        bind:value={receiptData.notes}
        placeholder="Any additional notes about this expense..."
        rows="2"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      ></textarea>
    </div>

    <!-- Action Buttons -->
    <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
      <button
        type="button"
        on:click={clearForm}
        class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Clear Form
      </button>
      <button
        type="submit"
        disabled={isProcessing}
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isProcessing ? "Processing..." : "Save Receipt"}
      </button>
    </div>
  </form>
</div>
