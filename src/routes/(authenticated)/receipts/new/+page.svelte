<script lang="ts">
    import { goto } from "$app/navigation";
    import ReceiptForm from "$lib/components/ReceiptForm.svelte";
    import FileUploader from "$lib/components/FileUploader.svelte";
    import CameraCapture from "$lib/components/CameraCapture.svelte";
    import { createReceiptUploadFormData } from "$lib/utils/receiptUpload";
    import type { ReceiptFormData } from "$lib/types";

    let loading = false;
    let error: string | null = null;
    let uploadedImageUrl: string | null = null;
    let uploadedImageKey: string | null = null;
    let originalImageUrl: string | null = null;
    let uploading = false;

    // Camera state
    let showCamera = false;
    let capturedImageUrl: string | null = null;

    // AI recognition state
    let isRecognizing = false;
    let recognizedData: Partial<ReceiptFormData> | null = null;
    let receiptNumber: string | null = null;
    let aiConfidence: number | null = null;

    // Preview tab state
    type PreviewTab = "preview" | "details";
    let activePreviewTab: PreviewTab = "preview";

    // Input mode
    type InputMode = "upload" | "camera" | "manual";
    let inputMode: InputMode = "upload";

    function setInputMode(mode: InputMode) {
        inputMode = mode;
        if (mode === "camera") {
            showCamera = true;
        } else {
            showCamera = false;
        }
    }

    async function handleCameraCapture(
        e: CustomEvent<{ blob: Blob; dataUrl: string }>,
    ) {
        showCamera = false;
        capturedImageUrl = e.detail.dataUrl;

        // Upload and process the captured image
        await processImage(e.detail.blob);
    }

    function handleCameraCancel() {
        showCamera = false;
        inputMode = "upload";
    }

    function handleCameraError(e: CustomEvent<{ message: string }>) {
        error = e.detail.message;
        showCamera = false;
        inputMode = "upload";
    }

    async function handleImageUpload(e: CustomEvent<{ file: File }>) {
        await processImage(e.detail.file);
    }

    async function processImage(file: File | Blob) {
        uploading = true;
        isRecognizing = true;
        error = null;

        try {
            const uploadFile =
                file instanceof File
                    ? file
                    : new File([file], `receipt-${Date.now()}.jpg`, {
                          type: file.type || "image/jpeg",
                          lastModified: Date.now(),
                      });

            const formData = await createReceiptUploadFormData(uploadFile);

            // Call unified upload API (handles PDF conversion + AI recognition)
            // Receipt is saved immediately with status "pending"
            const res = await fetch("/api/receipts/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? "Upload failed");
            }

            const data = await res.json();

            // Store receipt info - receipt is now saved in DB with status "pending"
            receiptNumber = data.receiptNumber;
            uploadedImageUrl = data.pdfUrl;
            uploadedImageKey = data.receipt?.receiptImageKey;

            // Store original image URL for preview
            if (data.receipt?.originalImageKey) {
                originalImageUrl = `/api/upload/${data.receipt.originalImageKey}`;
            }

            // If AI recognized, populate form
            if (data.aiRecognized && data.receipt) {
                const r = data.receipt;
                recognizedData = {
                    vendor: r.vendor || "",
                    amount: r.amount || 0,
                    currency: r.currency || "HKD",
                    date: r.date || new Date().toISOString().split("T")[0],
                    category: r.category || "",
                    paymentMethod: r.paymentMethod || "card",
                    notes: r.notes || "",
                    auditInfo: {
                        businessPurpose: r.auditInfo?.businessPurpose || "",
                    },
                };
                aiConfidence = r.ocrData?.confidence ?? null;
            }

            // Show preview tab by default after upload
            activePreviewTab = "preview";
        } catch (err) {
            error = err instanceof Error ? err.message : "Upload failed";
        } finally {
            uploading = false;
            isRecognizing = false;
        }
    }

    async function handleImageRemove() {
        // If we have a receipt number, delete the receipt from DB
        if (receiptNumber) {
            try {
                await fetch(`/api/receipts/${receiptNumber}`, {
                    method: "DELETE",
                });
            } catch (err) {
                console.error("Failed to delete receipt:", err);
            }
        }

        uploadedImageUrl = null;
        uploadedImageKey = null;
        originalImageUrl = null;
        capturedImageUrl = null;
        recognizedData = null;
        receiptNumber = null;
        aiConfidence = null;
        activePreviewTab = "preview";
    }

    function handleUploadError(e: CustomEvent<string>) {
        error = e.detail;
    }

    async function handleSubmit(e: CustomEvent<ReceiptFormData>) {
        loading = true;
        error = null;

        try {
            // Receipt was already created during upload, now we update it
            // and mark it as "approved" (verified)
            const payload = {
                ...e.detail,
                id: receiptNumber,
                receiptImageUrl: uploadedImageUrl,
                receiptImageKey: uploadedImageKey,
                status: "approved", // Mark as verified when form is submitted
            };

            const res = await fetch(`/api/receipts/${receiptNumber}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(
                    data.error?.fieldErrors
                        ? "Validation failed"
                        : "Failed to save receipt",
                );
            }

            const result = await res.json();
            goto(`/receipts/${result.id || receiptNumber}`);
        } catch (err) {
            error =
                err instanceof Error ? err.message : "Failed to save receipt";
        } finally {
            loading = false;
        }
    }

    function handleCancel() {
        goto("/receipts");
    }
</script>

<div class="max-w-6xl mx-auto space-y-4 md:space-y-6">
    <!-- Page Header -->
    <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
        <div>
            <h1 class="text-2xl md:text-3xl font-bold text-gray-900">
                Add Receipt
            </h1>
            <p class="text-sm md:text-base text-gray-600 mt-1">
                {#if receiptNumber}
                    <span class="font-mono text-blue-600">{receiptNumber}</span>
                {:else}
                    Upload and record a new expense receipt
                {/if}
            </p>
        </div>
        <a
            href="/receipts"
            class="text-gray-600 hover:text-gray-800 flex items-center space-x-1 text-sm"
        >
            <span>←</span>
            <span>Back to Receipts</span>
        </a>
    </div>

    {#if error}
        <div
            class="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg"
        >
            {error}
        </div>
    {/if}

    <!-- Camera Modal -->
    {#if showCamera}
        <div
            class="fixed inset-0 z-50 bg-black flex items-center justify-center"
        >
            <CameraCapture
                on:capture={handleCameraCapture}
                on:cancel={handleCameraCancel}
                on:error={handleCameraError}
            />
        </div>
    {/if}

    <!-- Input Mode Selector -->
    {#if !uploadedImageUrl && !showCamera}
        <div
            class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6"
        >
            <h2 class="text-base md:text-lg font-semibold text-gray-900 mb-4">
                How would you like to add your receipt?
            </h2>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <!-- Camera Option -->
                <button
                    type="button"
                    on:click={() => setInputMode("camera")}
                    class="flex flex-col items-center p-4 md:p-6 rounded-xl border-2 transition-all
                           {inputMode === 'camera'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}"
                >
                    <span class="text-3xl md:text-4xl mb-2">📷</span>
                    <span class="font-medium text-gray-900 text-sm md:text-base"
                        >Take Photo</span
                    >
                    <span class="text-xs md:text-sm text-gray-500 mt-1"
                        >Use your camera</span
                    >
                </button>

                <!-- Upload Option -->
                <button
                    type="button"
                    on:click={() => setInputMode("upload")}
                    class="flex flex-col items-center p-6 rounded-xl border-2 transition-all
                           {inputMode === 'upload'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}"
                >
                    <span class="text-4xl mb-2">📤</span>
                    <span class="font-medium text-gray-900">Upload File</span>
                    <span class="text-sm text-gray-500 mt-1"
                        >From your device</span
                    >
                </button>

                <!-- Manual Option -->
                <button
                    type="button"
                    on:click={() => setInputMode("manual")}
                    class="flex flex-col items-center p-6 rounded-xl border-2 transition-all
                           {inputMode === 'manual'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}"
                >
                    <span class="text-4xl mb-2">✏️</span>
                    <span class="font-medium text-gray-900">Enter Manually</span
                    >
                    <span class="text-sm text-gray-500 mt-1"
                        >No receipt image</span
                    >
                </button>
            </div>

            <!-- File Upload Area (shown when upload mode selected) -->
            {#if inputMode === "upload"}
                <div class="mt-6">
                    <FileUploader
                        previewUrl={null}
                        {uploading}
                        on:upload={handleImageUpload}
                        on:remove={handleImageRemove}
                        on:error={handleUploadError}
                    />
                </div>
            {/if}
        </div>
    {/if}

    <!-- Processing Indicator -->
    {#if isRecognizing}
        <div
            class="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center"
        >
            <div
                class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"
            ></div>
            <p class="text-blue-700 font-medium">Processing your receipt...</p>
            <p class="text-blue-600 text-sm mt-1">
                Converting to PDF and recognizing details with AI
            </p>
        </div>
    {/if}

    <!-- Two-Column Layout: Preview + Form (after upload) -->
    {#if uploadedImageUrl && !isRecognizing}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Left Column: Preview Panel with Tabs -->
            <div
                class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
                <!-- Tab Navigation -->
                <div class="flex border-b border-gray-200">
                    <button
                        type="button"
                        on:click={() => (activePreviewTab = "preview")}
                        class="flex-1 px-4 py-3 text-sm font-medium transition-colors
                               {activePreviewTab === 'preview'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
                    >
                        📄 Preview
                    </button>
                    <button
                        type="button"
                        on:click={() => (activePreviewTab = "details")}
                        class="flex-1 px-4 py-3 text-sm font-medium transition-colors
                               {activePreviewTab === 'details'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
                    >
                        🤖 AI Details
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="p-4">
                    {#if activePreviewTab === "preview"}
                        <!-- Preview Tab: Show Image or PDF -->
                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                <h3 class="font-medium text-gray-900">
                                    Receipt Document
                                </h3>
                                <button
                                    type="button"
                                    on:click={handleImageRemove}
                                    class="text-red-600 hover:text-red-700 text-sm font-medium"
                                >
                                    ✕ Remove
                                </button>
                            </div>

                            <!-- Preview Container -->
                            <div
                                class="bg-gray-100 rounded-lg overflow-hidden"
                                style="min-height: 400px;"
                            >
                                {#if capturedImageUrl}
                                    <!-- Camera captured image -->
                                    <img
                                        src={capturedImageUrl}
                                        alt="Captured receipt"
                                        class="w-full h-auto object-contain"
                                    />
                                {:else if originalImageUrl}
                                    <!-- Original uploaded image -->
                                    <img
                                        src={originalImageUrl}
                                        alt="Uploaded receipt"
                                        class="w-full h-auto object-contain"
                                    />
                                {:else if uploadedImageUrl}
                                    <!-- PDF Preview -->
                                    <iframe
                                        src={uploadedImageUrl}
                                        title="Receipt PDF"
                                        class="w-full h-full border-0"
                                        style="min-height: 500px;"
                                    ></iframe>
                                {/if}
                            </div>

                            <!-- Quick Actions -->
                            <div class="flex gap-2">
                                <a
                                    href={uploadedImageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="flex-1 text-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Open in New Tab ↗
                                </a>
                            </div>
                        </div>
                    {:else}
                        <!-- AI Details Tab -->
                        <div class="space-y-4">
                            <h3 class="font-medium text-gray-900">
                                AI Recognition Results
                            </h3>

                            {#if aiConfidence !== null}
                                <div class="space-y-2">
                                    <div
                                        class="flex items-center justify-between text-sm"
                                    >
                                        <span class="text-gray-500"
                                            >Confidence Score</span
                                        >
                                        <span class="font-medium text-gray-700"
                                            >{Math.round(
                                                aiConfidence * 100,
                                            )}%</span
                                        >
                                    </div>
                                    <div
                                        class="h-3 bg-gray-200 rounded-full overflow-hidden"
                                    >
                                        <div
                                            class="h-full rounded-full transition-all {aiConfidence >
                                            0.8
                                                ? 'bg-green-500'
                                                : aiConfidence > 0.6
                                                  ? 'bg-yellow-500'
                                                  : 'bg-red-500'}"
                                            style="width: {aiConfidence * 100}%"
                                        ></div>
                                    </div>
                                </div>
                            {/if}

                            {#if recognizedData}
                                <div
                                    class="bg-gray-50 rounded-lg p-4 space-y-3"
                                >
                                    <h4
                                        class="text-sm font-medium text-gray-700"
                                    >
                                        Extracted Data
                                    </h4>
                                    <div class="grid gap-2 text-sm">
                                        {#if recognizedData.vendor}
                                            <div class="flex justify-between">
                                                <span class="text-gray-500"
                                                    >Vendor</span
                                                >
                                                <span class="font-medium"
                                                    >{recognizedData.vendor}</span
                                                >
                                            </div>
                                        {/if}
                                        {#if recognizedData.amount}
                                            <div class="flex justify-between">
                                                <span class="text-gray-500"
                                                    >Amount</span
                                                >
                                                <span class="font-medium"
                                                    >{recognizedData.currency ||
                                                        "HKD"}
                                                    {recognizedData.amount.toLocaleString()}</span
                                                >
                                            </div>
                                        {/if}
                                        {#if recognizedData.currency}
                                            <div class="flex justify-between">
                                                <span class="text-gray-500"
                                                    >Currency</span
                                                >
                                                <span
                                                    class="font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded"
                                                    >{recognizedData.currency}</span
                                                >
                                            </div>
                                        {/if}
                                        {#if recognizedData.date}
                                            <div class="flex justify-between">
                                                <span class="text-gray-500"
                                                    >Date</span
                                                >
                                                <span class="font-medium"
                                                    >{recognizedData.date}</span
                                                >
                                            </div>
                                        {/if}
                                        {#if recognizedData.category}
                                            <div class="flex justify-between">
                                                <span class="text-gray-500"
                                                    >Category</span
                                                >
                                                <span class="font-medium"
                                                    >{recognizedData.category}</span
                                                >
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {:else}
                                <div class="text-center py-8 text-gray-500">
                                    <span class="text-3xl block mb-2">🤖</span>
                                    <p>AI could not extract receipt details.</p>
                                    <p class="text-sm">
                                        Please fill in the form manually.
                                    </p>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Right Column: Verification Form -->
            <div
                class="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
                <!-- Status Badge -->
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-semibold text-gray-900">
                        Verify Receipt Details
                    </h2>
                    <span
                        class="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full"
                    >
                        ⏳ Pending Verification
                    </span>
                </div>

                {#if recognizedData}
                    <div
                        class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg"
                    >
                        <p class="text-sm text-green-700">
                            ✓ Form auto-filled by AI. Please verify the details
                            are correct.
                        </p>
                    </div>
                {:else}
                    <div
                        class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                    >
                        <p class="text-sm text-yellow-700">
                            ⚠️ AI could not extract details. Please enter them
                            manually.
                        </p>
                    </div>
                {/if}

                <ReceiptForm
                    {loading}
                    initialData={recognizedData}
                    submitLabel="✓ Verify & Save"
                    on:submit={handleSubmit}
                    on:cancel={handleCancel}
                />
            </div>
        </div>
    {/if}

    <!-- Manual Entry Form (no image) -->
    {#if inputMode === "manual" && !uploadedImageUrl}
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">
                Receipt Details
                <span class="text-sm font-normal text-gray-500 ml-2">
                    (Manual Entry)
                </span>
            </h2>
            <ReceiptForm
                {loading}
                initialData={null}
                on:submit={handleSubmit}
                on:cancel={handleCancel}
            />
        </div>
    {/if}
</div>
