// subux.dev site profile, loaded by Subux as a module on every page.

// Returning visitors may still run the service worker and cache of the earlier
// Qwik builds; remove both.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        if (registration.active?.scriptURL.endsWith('service-worker.js')) {
          registration.unregister().catch(console.error)
        }
      }
    })
    .catch(console.error)
}
if ('caches' in window) {
  caches
    .keys()
    .then((keys) => {
      const stale = keys.find((key) => key.startsWith('QwikBuild'))
      if (stale) caches.delete(stale).catch(console.error)
    })
    .catch(console.error)
}

// Tabs keep their query-string address (/?tab=tech). The theme's own links
// (/tech/) remain for visitors without JavaScript.
for (const tab of document.querySelectorAll('a.tab-link[data-tab-id]')) {
  tab.setAttribute('href', `/?tab=${tab.dataset.tabId}`)
}

// Mermaid diagrams are authored as fenced code blocks. Claim them before the
// theme's own loader runs (it runs after this module), so they render once,
// with this site's Mermaid version and colors.
const mermaidBlocks = Array.from(
  document.querySelectorAll('.article-content pre > code.language-mermaid'),
)
for (const block of mermaidBlocks) {
  block.classList.replace('language-mermaid', 'language-mermaid-source')
}

const renderMermaid = async () => {
  if (mermaidBlocks.length === 0) return

  const { default: mermaid } = await import('/vendor/mermaid.mjs')

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    layout: 'dagre',
    look: 'classic',
    themeVariables: {
      background: '#ffffff',
      primaryColor: '#eff6ff',
      primaryBorderColor: '#2563eb',
      primaryTextColor: '#0f172a',
      secondaryColor: '#ecfdf5',
      secondaryBorderColor: '#059669',
      tertiaryColor: '#fff7ed',
      tertiaryBorderColor: '#f97316',
      lineColor: '#2563eb',
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
  })

  const nodes = []
  for (const block of mermaidBlocks) {
    const pre = block.parentElement
    if (!pre?.isConnected) continue

    const diagram = document.createElement('div')
    diagram.className = 'mermaid'
    diagram.textContent = block.textContent ?? ''
    pre.replaceWith(diagram)
    nodes.push(diagram)
  }
  if (nodes.length === 0) return

  await mermaid.run({ nodes })

  for (const node of nodes) {
    const svg = node.querySelector('svg')
    const [, , width] = svg?.getAttribute('viewBox')?.split(/\s+/) ?? []
    const intrinsicWidth = Number.parseFloat(width ?? '')

    if (svg && Number.isFinite(intrinsicWidth) && intrinsicWidth > 0) {
      // Keep diagrams readable on narrow screens; the container handles overflow.
      svg.setAttribute('width', String(Math.ceil(intrinsicWidth)))
      svg.style.maxWidth = 'none'
    }
  }
}

renderMermaid()
  .catch(console.error)
  .finally(() => {
    // Lets automated checks know when the page has settled.
    document.documentElement.dataset.profileReady = 'true'
  })
