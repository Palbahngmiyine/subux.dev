import { component$ } from '@builder.io/qwik'

export const NotFound = component$(() => {
  return (
    <div class="not-found-page">
      <h1 class="not-found-title">이곳엔 아무것도 없습니다.</h1>
      <a href="/" class="not-found-link">
        처음으로
      </a>
    </div>
  )
})
