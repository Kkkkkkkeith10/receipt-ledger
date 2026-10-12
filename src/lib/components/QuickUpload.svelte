<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte";
    import { goto } from "$app/navigation";
    import { createReceiptUploadFormData } from "$lib/utils/receiptUpload";

    const dispatch = createEventDispatcher();

    type JobStatus = "pending" | "uploading" | "done" | "error";

    interface DuplicateInfo {
        id: string;
        vendor: string | null;
        amount: number | null;
        currency: string;
        date: string | null;
        score: number;
    }

    interface UploadJob {
        id: string;
        fileName: string;
        previewUrl: string | null;
        size: number;
        status: JobStatus;
        progress: string;
        error?: string;
        receiptId?: string;
        receiptVendor?: string;
        receiptAmount?: number;
        receiptCurrency?: string;
        possibleDuplicates?: DuplicateInfo[];
    }

    let fileInput: HTMLInputElement;
    let jobs: UploadJob[] = [];

    // Concurrency limit so the user can pick many files at once without
    // hammering the AI endpoint. The browser still keeps the UI responsive.
    const MAX_CONCURRENT = 3;

    $: activeCount = jobs.filter((j) => j.status === "uploading").length;
    $: pendingCount = jobs.filter((j) => j.status === "pending").length;
    $: doneCount = jobs.filter((j) => j.status === "done").length;
    $: errorCount = jobs.filter((j) => j.status === "error").length;
    $: dupCount = jobs.filter(
        (j) => j.status === "done" && (j.possibleDuplicates?.length ?? 0) > 0,
    ).length;
    $: anyInFlight = activeCount + pendingCount > 0;

    onDestroy(() => {
        for (const j of jobs) {
            if (j.previewUrl) URL.revokeObjectURL(j.previewUrl);
        }
    });

    function openCamera() {
        if (!fileInput) return;
        fileInput.setAttribute("capture", "environment");
        fileInput.click();
    }

    function openGallery() {
        if (!fileInput) return;
        fileInput.removeAttribute("capture");
        fileInput.click();
    }

    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        const files = input.files;
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
            const job: UploadJob = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                fileName: file.name || "receipt",
                size: file.size,
                previewUrl: file.type.startsWith("image/")
                    ? URL.createObjectURL(file)
                    : null,
                status: "pending",
                progress: "Queued",
            };
            jobs = [job, ...jobs];
            // Fire and forget; queue is bounded by MAX_CONCURRENT inside runJob.
            void runJob(job, file);
        }

        input.value = "";
    }

    async function runJob(job: UploadJob, file: File) {
        // Wait for a slot.
        while (
            jobs.filter((j) => j.status === "uploading").length >=
            MAX_CONCURRENT
        ) {
            await new Promise((r) => setTimeout(r, 150));
            if (job.status !== "pending") return; // got cancelled / removed
        }

        updateJob(job.id, { status: "uploading", progress: "Preparing..." });

        try {
            if (file.type === "application/pdf") {
                updateJob(job.id, { progress: "Rendering PDF preview for AI..." });
            } else if (file.type.startsWith("image/")) {
                updateJob(job.id, { progress: "Fixing orientation..." });
            }

            updateJob(job.id, { progress: "Uploading & running AI..." });

            const formData = await createReceiptUploadFormData(file);

            const response = await fetch("/api/receipts/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            const result = await response.json();
            const receipt = result.receipt;
            const dups: DuplicateInfo[] = result.possibleDuplicates ?? [];

            updateJob(job.id, {
                status: "done",
                progress: "",
                receiptId: receipt?.id,
                receiptVendor: receipt?.vendor,
                receiptAmount: receipt?.amount,
                receiptCurrency: receipt?.currency,
                possibleDuplicates: dups,
            });

            dispatch("uploaded", result);
        } catch (e) {
            updateJob(job.id, {
                status: "error",
                progress: "",
                error: e instanceof Error ? e.message : "Upload failed",
            });
        }
    }

    function updateJob(id: string, patch: Partial<UploadJob>) {
        jobs = jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
    }

    function removeJob(id: string) {
        const j = jobs.find((x) => x.id === id);
        if (j?.previewUrl) URL.revokeObjectURL(j.previewUrl);
        jobs = jobs.filter((x) => x.id !== id);
    }

    function clearFinished() {
        for (const j of jobs) {
            if (
                (j.status === "done" || j.status === "error") &&
                j.previewUrl
            ) {
                URL.revokeObjectURL(j.previewUrl);
            }
        }
        jobs = jobs.filter(
            (j) => j.status === "pending" || j.status === "uploading",
        );
    }

    function viewReceipt(id: string | undefined) {
        if (id) goto(`/receipts/${id}`);
    }

    function fmtMoney(amount?: number, currency?: string) {
        if (amount == null || !currency) return "—";
        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency,
            }).format(amount);
        } catch {
            return `${currency} ${amount.toFixed(2)}`;
        }
    }
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
    <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">📸 Quick Upload</h3>
        {#if jobs.length > 0}
            <div class="flex items-center gap-2 text-xs">
                {#if anyInFlight}
                    <span
                        class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700"
                    >
                        <span
                            class="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"
                        ></span>
                        {activeCount + pendingCount} in progress
                    </span>
                {/if}
                {#if doneCount > 0}
                    <span
                        class="px-2 py-1 rounded-full bg-green-50 text-green-700"
                        >{doneCount} done</span
                    >
                {/if}
                {#if dupCount > 0}
                    <span
                        class="px-2 py-1 rounded-full bg-amber-50 text-amber-700"
                        >⚠ {dupCount} possible duplicate{dupCount > 1
                            ? "s"
                            : ""}</span
                    >
                {/if}
                {#if errorCount > 0}
                    <span
                        class="px-2 py-1 rounded-full bg-red-50 text-red-700"
                        >{errorCount} failed</span
                    >
                {/if}
            </div>
        {/if}
    </div>

    <input
        bind:this={fileInput}
        type="file"
        accept="image/*,application/pdf"
        multiple
        class="hidden"
        on:change={handleFileSelect}
    />

    <div class="grid grid-cols-2 gap-4 mb-3">
        <button
            on:click={openCamera}
            class="flex flex-col items-center justify-center p-6 bg-green-50 border-2 border-dashed border-green-300 rounded-xl hover:bg-green-100 hover:border-green-400 transition-colors"
        >
            <span class="text-4xl mb-2">📷</span>
            <span class="text-green-700 font-medium">Take Photo</span>
            <span class="text-green-600 text-xs">Keep going — uploads in background</span>
        </button>
        <button
            on:click={openGallery}
            class="flex flex-col items-center justify-center p-6 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl hover:bg-blue-100 hover:border-blue-400 transition-colors"
        >
            <span class="text-4xl mb-2">🖼️</span>
            <span class="text-blue-700 font-medium">Pick Files</span>
            <span class="text-blue-600 text-xs">Multi-select supported</span>
        </button>
    </div>

    <p class="text-center text-gray-500 text-xs">
        JPEG · PNG · WebP · PDF · up to 10 MB each
    </p>

    {#if jobs.length > 0}
        <div class="mt-4 border-t border-gray-200 pt-3">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-700"
                    >Recent uploads</span
                >
                {#if doneCount + errorCount > 0}
                    <button
                        on:click={clearFinished}
                        class="text-xs text-gray-500 hover:text-gray-700"
                        >Clear finished</button
                    >
                {/if}
            </div>

            <ul class="space-y-2 max-h-80 overflow-y-auto pr-1">
                {#each jobs as job (job.id)}
                    <li
                        class="flex items-start gap-3 p-2 rounded-lg border {job.status ===
                        'error'
                            ? 'border-red-200 bg-red-50'
                            : job.possibleDuplicates?.length
                              ? 'border-amber-300 bg-amber-50'
                              : job.status === 'done'
                                ? 'border-green-200 bg-green-50'
                                : 'border-gray-200 bg-gray-50'}"
                    >
                        <div
                            class="flex-shrink-0 w-12 h-12 rounded bg-gray-200 overflow-hidden flex items-center justify-center"
                        >
                            {#if job.previewUrl}
                                <img
                                    src={job.previewUrl}
                                    alt=""
                                    class="w-full h-full object-cover"
                                />
                            {:else}
                                <span class="text-2xl">📄</span>
                            {/if}
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span
                                    class="text-sm font-medium text-gray-900 truncate"
                                    >{job.receiptVendor || job.fileName}</span
                                >
                                {#if job.status === "uploading" || job.status === "pending"}
                                    <span
                                        class="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"
                                    ></span>
                                {:else if job.status === "done"}
                                    <span class="text-xs text-green-700">✓</span
                                    >
                                {:else}
                                    <span class="text-xs text-red-700">✕</span>
                                {/if}
                            </div>

                            {#if job.status === "done"}
                                <div
                                    class="text-xs text-gray-600 truncate flex items-center gap-2"
                                >
                                    <span
                                        >{fmtMoney(
                                            job.receiptAmount,
                                            job.receiptCurrency,
                                        )}</span
                                    >
                                    <span class="text-gray-400">·</span>
                                    <button
                                        on:click={() =>
                                            viewReceipt(job.receiptId)}
                                        class="text-blue-600 hover:underline"
                                        >Review</button
                                    >
                                </div>
                                {#if job.possibleDuplicates?.length}
                                    <div
                                        class="mt-1 text-xs text-amber-800 leading-tight"
                                    >
                                        ⚠ Possible duplicate of:
                                        {#each job.possibleDuplicates.slice(0, 2) as d, i}
                                            {#if i > 0},
                                            {/if}
                                            <a
                                                href="/receipts/{d.id}"
                                                class="font-medium underline hover:text-amber-900"
                                                >{d.vendor || d.id}</a
                                            >
                                            {#if d.amount}({fmtMoney(
                                                    d.amount,
                                                    d.currency,
                                                )}){/if}
                                        {/each}
                                        {#if job.possibleDuplicates.length > 2}
                                            and {job.possibleDuplicates.length -
                                                2} more
                                        {/if}
                                    </div>
                                {/if}
                            {:else if job.status === "error"}
                                <div class="text-xs text-red-700 truncate">
                                    {job.error || "Upload failed"}
                                </div>
                            {:else}
                                <div class="text-xs text-gray-500 truncate">
                                    {job.progress}
                                </div>
                            {/if}
                        </div>

                        <button
                            on:click={() => removeJob(job.id)}
                            class="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                            title="Dismiss"
                            aria-label="Dismiss"
                        >
                            <svg
                                class="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </li>
                {/each}
            </ul>
        </div>
    {/if}
</div>
