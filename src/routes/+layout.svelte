<script lang="ts">
  import "../app.css";
  import ReloadPrompt from "$lib/components/ReloadPrompt.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  // PWA link interceptor - keeps navigation within the app on iOS standalone mode
  onMount(() => {
    // Check if running as standalone PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (!isStandalone) return;

    // Intercept all link clicks
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a") as HTMLAnchorElement | null;

      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Skip if modifier keys are pressed (user wants new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      // Skip download links
      if (anchor.hasAttribute("download")) return;

      // Skip external links - let them open in browser
      if (href.startsWith("http://") || href.startsWith("https://")) {
        const url = new URL(href);
        if (url.origin !== window.location.origin) {
          return; // External link, let it open normally
        }
      }

      // Skip anchor links
      if (href.startsWith("#")) return;

      // Skip javascript: links
      if (href.startsWith("javascript:")) return;

      // Skip mailto: and tel: links
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

      // For internal links, prevent default and use SvelteKit navigation
      e.preventDefault();

      // Handle relative and absolute internal URLs
      const path = href.startsWith("/") ? href : `/${href}`;
      goto(path);
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  });
</script>

<slot />
<ReloadPrompt />
