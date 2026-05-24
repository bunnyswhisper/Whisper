/** Same-tab cart count updates for Navbar (storage event only fires across tabs). */
export const CART_CHANGED_EVENT = 'bw-cart-changed';

export function notifyCartChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
}
