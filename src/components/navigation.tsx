import { component$ } from '@builder.io/qwik'
import { Link, useLocation } from '@builder.io/qwik-city'

export const Navigation = component$(() => {
  const location = useLocation()
  const currentPath = location.url.pathname

  const getCurrentTab = () => {
    if (currentPath === '/') return 'home'
    if (currentPath.startsWith('/articles')) return 'articles'
    return 'home'
  }

  const navItems = [
    { href: '/', value: 'home', label: 'About me' },
    { href: '/articles', value: 'articles', label: 'Articles' },
  ]

  return (
    <nav class="mb-8">
      <div class="w-full max-w-md">
        <div class="h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500 border border-slate-200 grid grid-cols-2 w-full">
          {navItems.map((item) => (
            <Link key={item.value} href={item.href} class="no-underline w-full">
              <button
                class={`cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-white/50 w-full ${
                  getCurrentTab() === item.value
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'bg-transparent text-slate-500'
                }`}
                type="button"
              >
                {item.label}
              </button>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
})
