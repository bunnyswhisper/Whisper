import { notifyCartChanged } from '@/lib/cartSync';

/** Active cart — existing UI and `storage` listeners use this key. */
export const ACTIVE_CART_KEY = 'cart';

/** @deprecated Use ACTIVE_CART_KEY */
export const CART_STORAGE_KEY = ACTIVE_CART_KEY;

const GUEST_CART_KEY = 'cart_guest';
const USER_CART_PREFIX = 'cart_user_';
const SCOPE_META_KEY = 'cart_active_scope';

export type CartLineItem = Record<string, unknown>;

type CartScope =
  | { kind: 'guest' }
  | { kind: 'user'; userId: string };

/** Set by CartScopeSync from Supabase session — source of truth for writes while logged in. */
let sessionUserId: string | null = null;
let currentScope: CartScope = { kind: 'guest' };
let scopeInitialized = false;

export function setSessionCartUserId(userId: string | null | undefined): void {
  sessionUserId = userId?.trim() ? userId : null;
}

export function getSessionCartUserId(): string | null {
  return sessionUserId;
}

function snapshotKey(scope: CartScope): string {
  return scope.kind === 'guest'
    ? GUEST_CART_KEY
    : `${USER_CART_PREFIX}${scope.userId}`;
}

export function guestCartStorageKey(): string {
  return GUEST_CART_KEY;
}

export function userCartStorageKey(userId: string): string {
  return `${USER_CART_PREFIX}${userId}`;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function parseCartJson(raw: string | null): CartLineItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CartLineItem[]) : [];
  } catch {
    return [];
  }
}

function readActiveRaw(): CartLineItem[] {
  if (!isBrowser()) return [];
  return parseCartJson(localStorage.getItem(ACTIVE_CART_KEY));
}

function writeActive(items: CartLineItem[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(ACTIVE_CART_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function getCartForUser(userId: string): CartLineItem[] {
  return parseCartJson(localStorage.getItem(userCartStorageKey(userId)));
}

export function setCartForUser(userId: string, items: CartLineItem[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(userCartStorageKey(userId), JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function readSnapshot(scope: CartScope): CartLineItem[] {
  if (!isBrowser()) return [];
  try {
    return parseCartJson(localStorage.getItem(snapshotKey(scope)));
  } catch {
    return [];
  }
}

function writeSnapshot(scope: CartScope, items: CartLineItem[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(snapshotKey(scope), JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function persistScopeMeta(scope: CartScope): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(
      SCOPE_META_KEY,
      scope.kind === 'guest' ? 'guest' : scope.userId,
    );
  } catch {
    /* ignore */
  }
}

function loadScopeFromMeta(): CartScope {
  if (!isBrowser()) return { kind: 'guest' };
  try {
    const raw = localStorage.getItem(SCOPE_META_KEY);
    if (raw && raw !== 'guest') {
      return { kind: 'user', userId: raw };
    }
  } catch {
    /* ignore */
  }
  return { kind: 'guest' };
}

function scopesEqual(a: CartScope, b: CartScope): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'guest' && b.kind === 'guest') return true;
  if (a.kind === 'user' && b.kind === 'user') return a.userId === b.userId;
  return false;
}

/** Scope used for snapshot writes — prefers live session, then persisted meta. */
function resolveWriteScope(): CartScope {
  if (sessionUserId) {
    return { kind: 'user', userId: sessionUserId };
  }
  ensureScopeInitialized();
  if (currentScope.kind === 'user') {
    return currentScope;
  }
  return { kind: 'guest' };
}

function applyScopeState(scope: CartScope): void {
  currentScope = scope;
  scopeInitialized = true;
  persistScopeMeta(scope);
}

function ensureScopeInitialized(): void {
  if (scopeInitialized) return;
  currentScope = loadScopeFromMeta();
  if (currentScope.kind === 'user' && !sessionUserId) {
    sessionUserId = currentScope.userId;
  }
  scopeInitialized = true;
}

function persistActiveToScope(scope: CartScope, items: CartLineItem[]): void {
  writeActive(items);
  writeSnapshot(scope, items);
}

/**
 * Read the active cart (`cart` key).
 */
export function readCart(): CartLineItem[] {
  return getActiveCart();
}

export function getActiveCart(): CartLineItem[] {
  if (!isBrowser()) return [];
  ensureScopeInitialized();
  return readActiveRaw();
}

/**
 * Write active cart and the correct guest or user snapshot.
 */
export function writeCart(items: CartLineItem[]): void {
  setActiveCart(items);
}

export function setActiveCart(items: CartLineItem[]): void {
  if (!isBrowser()) return;
  ensureScopeInitialized();
  const scope = resolveWriteScope();
  applyScopeState(scope);
  persistActiveToScope(scope, items);
  notifyCartChanged();
}

export function clearCart(): void {
  clearCartForCurrentUser();
}

export function clearCartForCurrentUser(): void {
  if (!isBrowser()) return;
  ensureScopeInitialized();
  const scope = resolveWriteScope();
  applyScopeState(scope);
  persistActiveToScope(scope, []);
  notifyCartChanged();
}

function reconcileActiveWithSnapshot(scope: CartScope): void {
  const snapshot = readSnapshot(scope);
  const active = readActiveRaw();
  if (snapshot.length === 0 && active.length > 0) {
    writeSnapshot(scope, active);
    return;
  }
  if (snapshot.length > 0) {
    writeActive(snapshot);
  }
}

/**
 * Load user snapshot into active cart (login / account switch).
 */
export function switchCartToUser(userId: string): void {
  switchCartScope({ kind: 'user', userId });
}

export function switchCartToGuest(): void {
  switchCartScope({ kind: 'guest' });
}

export function switchCartScope(next: CartScope): void {
  if (!isBrowser()) return;
  ensureScopeInitialized();

  setSessionCartUserId(next.kind === 'user' ? next.userId : null);

  if (scopesEqual(currentScope, next)) {
    applyScopeState(next);
    reconcileActiveWithSnapshot(next);
    notifyCartChanged();
    return;
  }

  const activeItems = readActiveRaw();
  writeSnapshot(currentScope, activeItems);

  if (
    currentScope.kind === 'guest' &&
    next.kind === 'user' &&
    activeItems.length > 0
  ) {
    const userSnapshot = readSnapshot(next);
    if (userSnapshot.length === 0) {
      writeSnapshot(next, activeItems);
    }
  }

  applyScopeState(next);

  const nextItems = readSnapshot(next);
  writeActive(nextItems);
  notifyCartChanged();
}

export function syncCartScopeFromSession(userId: string | null | undefined): void {
  if (!isBrowser()) return;
  setSessionCartUserId(userId);
  if (userId) {
    switchCartToUser(userId);
    return;
  }
  switchCartToGuest();
}

/**
 * Call before signOut while session still has user id.
 * Saves active cart to cart_user_<userId>, then loads guest cart into active.
 */
export function prepareCartForLogout(userId: string | null | undefined): void {
  if (!isBrowser()) return;
  const activeItems = readActiveRaw();
  const uid = userId?.trim();
  if (uid) {
    setCartForUser(uid, activeItems);
    setSessionCartUserId(null);
  }
  switchCartToGuest();
}
