import { component$, Slot } from '@builder.io/qwik'
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
    <div class="tabs-container">
      <nav class="tabs-nav" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <a
              key={tab.id}
              href={`${currentPath}?tab=${tab.id}`}
              class="tab-link"
              style={{
                borderBottomColor: isActive
                  ? 'var(--color-primary)'
                  : 'transparent',
                color: isActive
                  ? 'var(--color-text)'
                  : 'var(--color-text-muted)',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </a>
          )
        })}
      </nav>
      <div class="tabs-content">
        <Slot />
      </div>
    </div>
  )
})
