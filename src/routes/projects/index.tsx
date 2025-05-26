import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
    return (
        <div class="min-h-screen flex items-center justify-center">
            <div class="text-center p-8">
                <div class="mb-8">
                    <div class="text-6xl mb-4">🚧</div>
                    <h1 class="text-4xl font-bold text-gray-800 mb-4">
                        Projects
                    </h1>
                    <p class="text-xl text-gray-600 mb-6">
                        This page is under construction.
                    </p>
                    <p class="text-gray-500">
                        Soon you will be able to find new projects here!
                    </p>
                </div>
                <div class="animate-bounce">
                    <div class="w-16 h-16 mx-auto bg-blue-400 rounded-full flex items-center justify-center">
                        <span class="text-2xl">🔧</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

export const head: DocumentHead = {
    title: "Projects - Under construction",
    meta: [
        {
            name: "description",
            content: "Projects page is under construction.",
        },
    ],
}; 