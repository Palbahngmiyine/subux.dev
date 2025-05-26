import { component$, useSignal, Slot, useVisibleTask$, type QwikIntrinsicElements } from "@builder.io/qwik";

type TabsProps = {
    defaultValue?: string;
    value?: string;
    class?: string;
} & QwikIntrinsicElements['div'];

type TabsListProps = {
    class?: string;
} & QwikIntrinsicElements['div'];

type TabsTriggerProps = {
    value: string;
    class?: string;
} & QwikIntrinsicElements['button'];

type TabsContentProps = {
    value: string;
    class?: string;
} & QwikIntrinsicElements['div'];

export const Tabs = component$<TabsProps>(({ defaultValue, value, class: className, ...props }) => {
    const activeTab = useSignal(defaultValue || value || '');

    useVisibleTask$(() => {
        if (activeTab.value) {
            const tabsRoot = document.querySelector('[data-active-tab]') as HTMLElement;
            if (tabsRoot) {
                tabsRoot.setAttribute('data-active-tab', activeTab.value);

                // Set initial active state
                const triggers = tabsRoot.querySelectorAll('[data-value]');
                triggers.forEach(trigger => {
                    if (trigger.getAttribute('data-value') === activeTab.value) {
                        trigger.setAttribute('data-state', 'active');
                    } else {
                        trigger.setAttribute('data-state', 'inactive');
                    }
                });

                const contents = tabsRoot.querySelectorAll('[data-content-value]');
                contents.forEach(content => {
                    if (content.getAttribute('data-content-value') === activeTab.value) {
                        content.setAttribute('data-state', 'active');
                    } else {
                        content.setAttribute('data-state', 'inactive');
                    }
                });
            }
        }
    });

    return (
        <div
            {...props}
            class={`tabs-root ${className || ''}`}
            data-active-tab={activeTab.value}
        >
            <Slot />
        </div>
    );
});

export const TabsList = component$<TabsListProps>(({ class: className, ...props }) => {
    return (
        <div
            {...props}
            class={`inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500 border border-slate-200 ${className || ''}`}
            role="tablist"
        >
            <Slot />
        </div>
    );
});

export const TabsTrigger = component$<TabsTriggerProps>(({ value, class: className, ...props }) => {
    return (
        <button
            {...props}
            class={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm hover:bg-white/50 ${className || ''}`}
            type="button"
            role="tab"
            data-value={value}
            onClick$={() => {
                const tabsRoot = document.querySelector('[data-active-tab]') as HTMLElement;
                if (tabsRoot) {
                    tabsRoot.setAttribute('data-active-tab', value);

                    // Update all triggers
                    const triggers = tabsRoot.querySelectorAll('[data-value]');
                    triggers.forEach(trigger => {
                        if (trigger.getAttribute('data-value') === value) {
                            trigger.setAttribute('data-state', 'active');
                        } else {
                            trigger.setAttribute('data-state', 'inactive');
                        }
                    });

                    // Update all content
                    const contents = tabsRoot.querySelectorAll('[data-content-value]');
                    contents.forEach(content => {
                        if (content.getAttribute('data-content-value') === value) {
                            content.setAttribute('data-state', 'active');
                        } else {
                            content.setAttribute('data-state', 'inactive');
                        }
                    });
                }
            }}
        >
            <Slot />
        </button>
    );
});

export const TabsContent = component$<TabsContentProps>(({ value, class: className, ...props }) => {
    return (
        <div
            {...props}
            class={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 data-[state=inactive]:hidden ${className || ''}`}
            role="tabpanel"
            data-content-value={value}
            data-state="inactive"
        >
            <Slot />
        </div>
    );
}); 