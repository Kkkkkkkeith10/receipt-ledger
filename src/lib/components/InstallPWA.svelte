<script lang="ts">
    import { onMount } from "svelte";

    let deferredPrompt: any = null;
    let canInstall = false;
    let isInstalled = false;
    let showTooltip = false;
    let isIOS = false;
    let isAndroid = false;

    onMount(() => {
        // Check if already installed (running as standalone PWA)
        if (
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true
        ) {
            isInstalled = true;
            return;
        }

        // Detect platform
        isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        isAndroid = /Android/.test(navigator.userAgent);

        // Listen for the beforeinstallprompt event (Chrome/Edge/Samsung)
        window.addEventListener("beforeinstallprompt", (e: Event) => {
            e.preventDefault();
            deferredPrompt = e;
            canInstall = true;
        });

        // Listen for successful installation
        window.addEventListener("appinstalled", () => {
            canInstall = false;
            isInstalled = true;
            deferredPrompt = null;
        });
    });

    async function installApp() {
        if (deferredPrompt) {
            // Show the install prompt
            deferredPrompt.prompt();

            // Wait for the user's response
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === "accepted") {
                canInstall = false;
            }

            deferredPrompt = null;
        } else {
            // Show tooltip with manual instructions
            showTooltip = true;
            setTimeout(() => (showTooltip = false), 8000);
        }
    }
</script>

{#if !isInstalled}
    <div class="relative">
        <button
            on:click={installApp}
            class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors {canInstall
                ? 'text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                : isIOS
                  ? 'text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100'
                  : 'text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100'}"
            title="Install app for offline access"
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
            </svg>
            <span class="hidden sm:inline"
                >{isIOS ? "Add to Home" : "Install App"}</span
            >
        </button>

        {#if showTooltip}
            <div
                class="absolute right-0 top-full mt-2 w-72 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-50"
            >
                {#if isIOS}
                    <p class="font-semibold mb-2 text-orange-400">
                        📱 Install on iPhone/iPad:
                    </p>
                    <ol
                        class="text-gray-300 space-y-1 list-decimal list-inside"
                    >
                        <li>
                            Tap the <strong>Share</strong> button
                            <span class="text-blue-400"
                                >(⬆️ square with arrow)</span
                            >
                        </li>
                        <li>Scroll down in the menu</li>
                        <li>Tap <strong>"Add to Home Screen"</strong></li>
                        <li>Tap <strong>"Add"</strong> in the top right</li>
                    </ol>
                    <p class="text-xs text-gray-400 mt-2">
                        Note: Must use Safari browser
                    </p>
                {:else if isAndroid}
                    <p class="font-semibold mb-2 text-green-400">
                        📱 Install on Android:
                    </p>
                    <ol
                        class="text-gray-300 space-y-1 list-decimal list-inside"
                    >
                        <li>Tap the <strong>⋮ menu</strong> (three dots)</li>
                        <li>
                            Tap <strong>"Install app"</strong> or
                            <strong>"Add to Home screen"</strong>
                        </li>
                    </ol>
                {:else}
                    <p class="font-medium mb-1">Install this app:</p>
                    <p class="text-gray-300">
                        On <strong>Chrome/Edge</strong>: Click the install icon
                        in the address bar or use menu → "Install app"
                    </p>
                    <p class="text-gray-300 mt-1">
                        On <strong>Safari (iOS)</strong>: Tap Share → "Add to
                        Home Screen"
                    </p>
                {/if}
                <div
                    class="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"
                ></div>
            </div>
        {/if}
    </div>
{/if}
