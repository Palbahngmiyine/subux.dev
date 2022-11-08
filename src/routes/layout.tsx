import { component$, Slot } from '@builder.io/qwik';

export default component$(() => {
  return (
    <div class="container px-8 sm:px-16 py-8 mx-auto">
      <Slot />        
    </div>
  );
});
