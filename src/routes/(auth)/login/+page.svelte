<script lang="ts">
    import { signIn } from "@auth/sveltekit/client";
    import { crossfade } from "svelte/transition";
    import { cubicOut } from "svelte/easing";

    let email = "";
    let password = "";
    let isLoading = false;
    let error = "";

    const [send, receive] = crossfade({
        duration: 200,
        easing: cubicOut,
        fallback: (node) => {
            return {
                duration: 200,
                css: (t) => `opacity: ${t}`,
            };
        },
    });

    async function handleCredentialsSignIn() {
        error = "";
        isLoading = true;

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                error = "Invalid email or password";
            } else {
                // Successful login, redirect to home
                window.location.href = "/";
            }
        } catch (err) {
            error = "An error occurred. Please try again.";
            console.error("Login error:", err);
        } finally {
            isLoading = false;
        }
    }
</script>

<svelte:head>
    <title>Login - Receipt Ledger</title>
</svelte:head>

<div
    class="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 py-16"
>
    <main
        class="relative mx-6 mt-7 w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
    >
        <div class="mb-8 text-center">
            <h1 class="text-2xl font-semibold text-gray-800">
                Receipt Ledger
            </h1>
            <p class="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>

        <form
            on:submit|preventDefault={handleCredentialsSignIn}
            class="space-y-4"
        >
            <div>
                <label
                    for="email"
                    class="mb-1 block text-sm font-medium text-gray-700"
                >
                    Email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    bind:value={email}
                    placeholder="your-email@example.com"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isLoading}
                />
            </div>

            <div>
                <label
                    for="password"
                    class="mb-1 block text-sm font-medium text-gray-700"
                >
                    Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    bind:value={password}
                    placeholder="Enter your password"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isLoading}
                />
            </div>

            {#if error}
                <p class="text-sm text-red-600">{error}</p>
            {/if}

            <button
                type="submit"
                disabled={isLoading}
                class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isLoading ? "Signing in..." : "Sign in"}
            </button>
        </form>
    </main>

    <div class="mt-4 text-center text-sm text-gray-400">
        <p>&copy; 2025 Receipt Ledger. All rights reserved.</p>
    </div>
</div>
