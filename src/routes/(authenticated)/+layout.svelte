<script lang="ts">
    import { onMount, setContext } from "svelte";
    import "../../app.css";
    import Sidebar from "$lib/components/Sidebar.svelte";
    import Header from "$lib/components/Header.svelte";

    export let data;

    let loading = true;
    let sidebarOpen = false;

    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
    }

    function closeSidebar() {
        sidebarOpen = false;
    }

    onMount(() => {
        loading = false;
    });
</script>

<div
    class={"pointer-events-none fixed flex min-h-screen w-full items-center justify-center bg-blue-600 py-16 text-gray-100 transition-opacity duration-500 " +
        (loading ? "z-50 opacity-100" : "z-0 opacity-0")}
>
    <div class="flex items-center gap-3">
        <p class="mb-1 text-xl font-medium">Loading...</p>
        <div
            class="inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-current border-t-transparent"
            role="status"
            aria-label="loading"
        ></div>
    </div>
</div>

{#if !loading}
    <div class="min-h-screen bg-gray-50">
        <Header user={data?.session?.user} onMenuClick={toggleSidebar} />
        <div class="flex">
            <!-- Mobile sidebar overlay -->
            {#if sidebarOpen}
                <button
                    class="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                    on:click={closeSidebar}
                    aria-label="Close sidebar"
                ></button>
            {/if}

            <!-- Sidebar -->
            <div class="hidden lg:block">
                <Sidebar />
            </div>

            <!-- Mobile sidebar -->
            <div
                class="fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:hidden {sidebarOpen
                    ? 'translate-x-0'
                    : '-translate-x-full'}"
            >
                <Sidebar on:navigate={closeSidebar} />
            </div>

            <main class="flex-1 p-4 md:p-6 w-full min-w-0">
                <slot />
            </main>
        </div>
    </div>
{/if}
