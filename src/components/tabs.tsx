import { Slot, component$ } from '@builder.io/qwik'
import { useLocation } from '@builder.io/qwik-city'

export interface Tab {
  id: string
  label: string
  href: string
}

interface TabsProps {
  tabs: Tab[]
}

export const Tabs = component$<TabsProps>(({ tabs }) => {
  const location = useLocation()
  const currentPath = location.url.pathname
  const activeTab = location.url.searchParams.get('tab') || tabs[0].id

  return (
    <div class="w-full">
      <div class="border-b border-gray-200 mb-4 sm:mb-6 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
        <nav class="flex space-x-4 sm:space-x-8 min-w-max" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <a
                key={tab.id}
                href={`${currentPath}?tab=${tab.id}`}
                class={`
                  py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap
                  ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
              </a>
            )
          })}
        </nav>
      </div>
      <div>
        <Slot />
      </div>
    </div>
  )
})
