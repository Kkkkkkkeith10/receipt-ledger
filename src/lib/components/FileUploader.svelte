<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let accept = "image/jpeg,image/png,image/webp,application/pdf";
    export let maxSize = 10 * 1024 * 1024; // 10MB
    export let uploading = false;
    export let previewUrl: string | null = null;

    const dispatch = createEventDispatcher<{
        upload: { file: File };
        remove: void;
        error: string;
    }>();

    let dragover = false;
    let fileInput: HTMLInputElement;

    function handleFiles(files: FileList | null) {
        if (!files || files.length === 0) return;

        const file = files[0];

        // Validate type
        const acceptedTypes = accept.split(",").map((t) => t.trim());
        if (
            !acceptedTypes.some((type) =>
                file.type.match(type.replace("*", ".*")),
            )
        ) {
            dispatch("error", `Invalid file type. Accepted: ${accept}`);
            return;
        }

        // Validate size
        if (file.size > maxSize) {
            dispatch(
                "error",
                `File too large. Maximum size: ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
            );
            return;
        }

        dispatch("upload", { file });
    }

    function handleDrop(e: DragEvent) {
        dragover = false;
        handleFiles(e.dataTransfer?.files ?? null);
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        dragover = true;
    }

    function handleDragLeave() {
        dragover = false;
    }

    function handleChange(e: Event) {
        const input = e.target as HTMLInputElement;
        handleFiles(input.files);
    }

    function triggerFileSelect() {
        fileInput?.click();
    }
</script>

<div class="space-y-4">
    {#if previewUrl}
        <!-- Preview Mode -->
        <div class="relative">
            <div class="border rounded-lg overflow-hidden bg-gray-50">
                {#if previewUrl.includes(".pdf")}
                    <div
                        class="flex items-center justify-center h-48 bg-gray-100"
                    >
                        <div class="text-center">
                            <span class="text-4xl">📄</span>
                            <p class="text-sm text-gray-500 mt-2">
                                PDF Document
                            </p>
                        </div>
                    </div>
                {:else}
                    <img
                        src={previewUrl}
                        alt="Receipt preview"
                        class="w-full h-48 object-contain bg-white"
                    />
                {/if}
            </div>
            <button
                type="button"
                on:click={() => dispatch("remove")}
                class="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
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
        </div>
    {:else}
        <!-- Upload Mode -->
        <div
            role="button"
            tabindex="0"
            on:click={triggerFileSelect}
            on:keypress={(e) => e.key === "Enter" && triggerFileSelect()}
            on:drop|preventDefault={handleDrop}
            on:dragover={handleDragOver}
            on:dragleave={handleDragLeave}
            class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
        {dragover
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}"
        >
            {#if uploading}
                <div class="flex flex-col items-center">
                    <svg
                        class="animate-spin h-8 w-8 text-blue-500 mb-2"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                            fill="none"
                        />
                        <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                    <span class="text-sm text-gray-500">Uploading...</span>
                </div>
            {:else}
                <div class="flex flex-col items-center">
                    <span class="text-4xl mb-2">📷</span>
                    <p class="text-sm font-medium text-gray-700">
                        Drop receipt image here or <span class="text-blue-600"
                            >browse</span
                        >
                    </p>
                    <p class="text-xs text-gray-500 mt-1">
                        JPEG, PNG, WebP or PDF up to 10MB
                    </p>
                </div>
            {/if}
        </div>

        <input
            bind:this={fileInput}
            type="file"
            {accept}
            on:change={handleChange}
            class="hidden"
        />
    {/if}
</div>
