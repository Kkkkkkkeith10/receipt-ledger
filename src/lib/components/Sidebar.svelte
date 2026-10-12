<script>
  import { page } from "$app/stores";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  const navigation = [
    { name: "Dashboard", href: "/", icon: "📊" },
    { name: "Receipts", href: "/receipts", icon: "🧾" },
    { name: "Transactions", href: "/transactions", icon: "💰" },
    { name: "Reports", href: "/reports", icon: "📈" },
    { name: "Chart of Accounts", href: "/accounts", icon: "📋" },
    { name: "Settings", href: "/settings", icon: "⚙️" },
  ];

  $: currentPath = $page.url.pathname;

  function handleNavClick() {
    dispatch("navigate");
  }
</script>

<aside class="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
  <nav class="p-4 md:p-6">
    <ul class="space-y-1 md:space-y-2">
      {#each navigation as item}
        <li>
          <a
            href={item.href}
            on:click={handleNavClick}
            class="flex items-center space-x-3 px-3 md:px-4 py-2.5 md:py-3 rounded-lg transition-colors {currentPath ===
            item.href
              ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-700'
              : 'text-gray-700 hover:bg-gray-100'}"
          >
            <span class="text-lg">{item.icon}</span>
            <span class="font-medium">{item.name}</span>
          </a>
        </li>
      {/each}
    </ul>
  </nav>
</aside>
