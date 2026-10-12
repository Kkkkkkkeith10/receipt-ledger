<script lang="ts">
    import { onMount, onDestroy } from "svelte";

    export let url: string;
    export let className: string = "";

    let blobUrl: string | null = null;
    let loading = true;
    let error: string | null = null;
    let fileType: "pdf" | "image" | "unknown" = "unknown";

    // Determine file type from URL
    $: {
        if (url) {
            if (url.endsWith(".pdf")) {
                fileType = "pdf";
            } else if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                fileType = "image";
            } else {
                fileType = "unknown";
            }
        }
    }

    onMount(async () => {
        if (!url) {
            loading = false;
            return;
        }

        try {
            const response = await fetch(url, {
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error(`Failed to load file: ${response.status}`);
            }

            const blob = await response.blob();
            blobUrl = URL.createObjectURL(blob);
            loading = false;
        } catch (err) {
            console.error("Error loading receipt file:", err);
            error = err instanceof Error ? err.message : "Failed to load file";
            loading = false;
        }
    });

    onDestroy(() => {
        // Clean up blob URL to prevent memory leaks
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
        }
    });
</script>

{#if loading}
    <div
        class="flex items-center justify-center p-8 bg-gray-50 rounded-lg {className}"
    >
        <div class="flex flex-col items-center space-y-2">
            <div
                class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"
            ></div>
            <span class="text-sm text-gray-500">Loading receipt...</span>
        </div>
    </div>
{:else if error}
    <div
        class="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg border border-red-200 {className}"
    >
        <span class="text-4xl mb-2">⚠️</span>
        <p class="text-red-600 text-sm">{error}</p>
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            class="mt-3 text-blue-600 hover:text-blue-800 text-sm underline"
        >
            Try opening directly →
        </a>
    </div>
{:else if blobUrl}
    {#if fileType === "pdf"}
        <div class="space-y-3">
            <iframe
                src={blobUrl}
                title="Receipt PDF"
                class="w-full rounded-lg border {className}"
                style="min-height: 600px;"
            ></iframe>
            <a
                href={blobUrl}
                download="receipt.pdf"
                class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
                <span class="mr-2">📥</span>
                Download PDF
            </a>
        </div>
    {:else if fileType === "image"}
        <img
            src={blobUrl}
            alt="Receipt"
            class="max-w-full h-auto rounded-lg border {className}"
        />
    {:else}
        <!-- Unknown file type - offer download -->
        <div
            class="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border {className}"
        >
            <span class="text-4xl mb-2">📄</span>
            <p class="text-gray-600 text-sm mb-3">File loaded</p>
            <a
                href={blobUrl}
                download="receipt"
                class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
                <span class="mr-2">📥</span>
                Download File
            </a>
        </div>
    {/if}
{:else}
    <div
        class="flex items-center justify-center p-8 bg-gray-100 rounded-lg {className}"
    >
        <span class="text-gray-400">No file to display</span>
    </div>
{/if}
