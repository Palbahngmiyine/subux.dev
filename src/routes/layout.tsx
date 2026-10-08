import { component$, Slot } from '@qwik.dev/core'
import type { RequestHandler } from '@qwik.dev/router'

export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    staleWhileRevalidate: 60 * 60 * 24 * 7,
    maxAge: 5,
  })
}

export default component$(() => {
  return (
    <main class="site-container">
      <Slot />
    </main>
  )
})
