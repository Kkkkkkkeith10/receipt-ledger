<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let url: string;
    export let title: string = "View Document";
    export let show: boolean = false;

    const dispatch = createEventDispatcher();

    function close() {
        show = false;
        dispatch("close");
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") close();
    }

    // Detect if running as PWA
    function isPWA(): boolean {
        if (typeof window === "undefined") return false;
        return (
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true
        );
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
    <!-- Modal Backdrop -->
    <div
        class="fixed inset-0 z-50 bg-black/80 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewer-title"
    >
        <!-- Header -->
        <div
            class="flex items-center justify-between p-4 bg-gray-900 text-white"
        >
            <h2 id="viewer-title" class="font-medium truncate">{title}</h2>
            <div class="flex items-center gap-2">
                <a
                    href={url}
                    download
                    class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
                >
                    📥 Download
                </a>
                <button
                    on:click={close}
                    class="p-2 hover:bg-gray-700 rounded-full transition-colors"
                    aria-label="Close viewer"
                >
                    <svg
                        class="w-6 h-6"
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
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto bg-gray-100">
            {#if url.endsWith(".pdf") || url.includes("/api/upload/")}
                <iframe
                    src={url}
                    {title}
                    class="w-full h-full border-0"
                    style="min-height: calc(100vh - 64px);"
                ></iframe>
            {:else}
                <div class="flex items-center justify-center h-full p-4">
                    <img
                        src={url}
                        alt={title}
                        class="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    />
                </div>
            {/if}
        </div>
    </div>
{/if}
