import { component$, isDev, useStyles$ } from '@qwik.dev/core'
import {
  useQwikRouter,
  RouterOutlet,
  ServiceWorkerRegister,
} from '@qwik.dev/router'
import { RouterHead } from './components/router-head/router-head'
import styles from './global.css?inline'

export default component$(() => {
  useQwikRouter()
  useStyles$(styles)

  return (
    <>
      <head>
        <meta charset="utf-8" />
        {!isDev && (
          <link
            rel="manifest"
            href={`${import.meta.env.BASE_URL}manifest.json`}
          />
        )}
        <RouterHead />
      </head>
      <body lang="ko" class="min-h-screen flex flex-col">
        <RouterOutlet />
        {!isDev && <ServiceWorkerRegister />}
      </body>
    </>
  )
})
