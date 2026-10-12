<script lang="ts">
  import { page } from "$app/stores";
  import { signOut } from "@auth/sveltekit/client";
  import InstallPWA from "./InstallPWA.svelte";

  interface User {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }

  export let user: User | null = null;
  export let onMenuClick: (() => void) | undefined = undefined;
  let showMenu = false;

  function handleSignOut() {
    signOut({ callbackUrl: "/login" });
  }

  // Get initials from name or email
  function getInitials(user: User | null): string {
    if (user?.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  }
</script>

<header
  class="bg-white shadow-sm border-b border-gray-200 px-4 md:px-6 py-3 md:py-4"
>
  <div class="flex items-center justify-between">
    <div class="flex items-center space-x-3 md:space-x-4">
      <!-- Mobile menu button -->
      {#if onMenuClick}
        <button
          on:click={onMenuClick}
          class="lg:hidden p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
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
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      {/if}
      <h1 class="text-lg md:text-2xl font-bold text-gray-900">
        Receipt Ledger
      </h1>
      <span class="hidden sm:inline text-sm text-gray-500"
        >Year-End Audit-Ready System</span
      >
    </div>
    <div class="flex items-center space-x-2 md:space-x-4">
      <!-- Install PWA button -->
      <InstallPWA />

      <a
        href="/receipts/new"
        class="hidden sm:inline-flex px-3 md:px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        Add Receipt
      </a>
      <!-- Mobile add button -->
      <a
        href="/receipts/new"
        class="sm:hidden p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        aria-label="Add Receipt"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
      </a>

      <!-- User menu -->
      <div class="relative">
        <button
          on:click={() => (showMenu = !showMenu)}
          class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center hover:bg-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {#if user?.image}
            <img src={user.image} alt="Profile" class="w-8 h-8 rounded-full" />
          {:else}
            <span class="text-sm font-medium text-gray-600"
              >{getInitials(user)}</span
            >
          {/if}
        </button>

        {#if showMenu}
          <div
            class="absolute right-0 top-10 z-20 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {#if user?.name || user?.email}
              <div class="border-b border-gray-100 px-4 py-2">
                <p class="text-sm font-medium text-gray-900">
                  {user.name || "User"}
                </p>
                <p class="text-xs text-gray-500">{user.email}</p>
              </div>
            {/if}
            <button
              on:click={handleSignOut}
              class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</header>

<!-- Click outside to close menu -->
{#if showMenu}
  <button
    class="fixed inset-0 z-10 cursor-default"
    on:click={() => (showMenu = false)}
    aria-label="Close menu"
  ></button>
{/if}
