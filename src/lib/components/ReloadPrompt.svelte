<script lang="ts">
    import { onMount } from "svelte";

    let offlineReady = false;
    let needRefresh = false;
    let updateServiceWorker:
        | ((reloadPage?: boolean) => Promise<void>)
        | undefined;

    onMount(async () => {
        if (typeof window !== "undefined") {
            const { useRegisterSW } = await import(
                "virtual:pwa-register/svelte"
            );
            const {
                offlineReady: or,
                needRefresh: nr,
                updateServiceWorker: usw,
            } = useRegisterSW({
                onRegistered(r) {
                    console.log("SW Registered:", r);
                },
                onRegisterError(error) {
                    console.log("SW registration error", error);
                },
            });

            or.subscribe((value) => (offlineReady = value));
            nr.subscribe((value) => (needRefresh = value));
            updateServiceWorker = usw;
        }
    });

    function close() {
        offlineReady = false;
        needRefresh = false;
    }
</script>

{#if offlineReady || needRefresh}
    <div
        class="fixed bottom-0 right-0 m-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
        role="alert"
    >
        <div class="mb-2 text-sm text-gray-700 dark:text-gray-300">
            {#if offlineReady}
                <span>App ready to work offline</span>
            {:else}
                <span
                    >New content available, click on reload button to update.</span
                >
            {/if}
        </div>
        <div class="flex gap-2">
            {#if needRefresh}
                <button
                    class="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    on:click={() => updateServiceWorker?.(true)}
                >
                    Reload
                </button>
            {/if}
            <button
                class="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                on:click={close}
            >
                Close
            </button>
        </div>
    </div>
{/if}
