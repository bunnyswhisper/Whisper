/**
 * Keeps the user near review UI after async updates (avoids landing on DeferredSocialFooter).
 */
export function scrollToAnchor(
  anchorId: string,
  options?: { behavior?: ScrollBehavior; block?: ScrollLogicalPosition },
) {
  const behavior = options?.behavior ?? 'auto';
  const block = options?.block ?? 'start';

  requestAnimationFrame(() => {
    const el = document.getElementById(anchorId);
    if (el) {
      el.scrollIntoView({ behavior, block });
      return;
    }
    window.scrollTo({ top: 0, behavior });
  });
}

export async function withPreservedScroll<T>(fn: () => Promise<T>): Promise<T> {
  const y = window.scrollY;
  try {
    return await fn();
  } finally {
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: 'auto' });
    });
  }
}
