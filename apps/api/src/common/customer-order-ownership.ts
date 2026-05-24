import { Logger, UnauthorizedException } from '@nestjs/common';
import { shortIdForLog } from './safe-log';

/** Generic customer-facing denial (missing order or wrong owner). */
export const CUSTOMER_ORDER_NOT_FOUND_MESSAGE = 'Order not found';

export type CustomerOrderOwnershipRow = {
  user_id?: string | null;
  customer_email?: string | null;
};

export type CustomerOrderOwnershipUser = {
  id: string;
  email?: string | null;
};

export type CustomerOrderOwnershipResult = {
  owns: boolean;
  ownsByUserId: boolean;
  ownsByEmail: boolean;
  normalizedAuthEmail: string;
  normalizedOrderEmail: string;
  orderUserId: string;
  /** Order has a different user_id but customer_email matches auth email. */
  mismatchUserIdButEmailMatches: boolean;
  /** Order user_id matches auth but customer_email differs from auth email. */
  mismatchEmailButUserIdMatches: boolean;
};

export function normalizeCustomerEmail(
  email: string | null | undefined,
): string {
  return String(email ?? '').trim().toLowerCase();
}

export function evaluateCustomerOrderOwnership(
  order: CustomerOrderOwnershipRow,
  user: CustomerOrderOwnershipUser,
): CustomerOrderOwnershipResult {
  const normalizedAuthEmail = normalizeCustomerEmail(user.email);
  const normalizedOrderEmail = normalizeCustomerEmail(order.customer_email);
  const orderUserId = order.user_id != null ? String(order.user_id) : '';

  const ownsByUserId = Boolean(orderUserId) && orderUserId === user.id;
  const ownsByEmail =
    Boolean(normalizedAuthEmail) &&
    Boolean(normalizedOrderEmail) &&
    normalizedOrderEmail === normalizedAuthEmail;
  const owns = ownsByUserId || ownsByEmail;

  const mismatchUserIdButEmailMatches =
    ownsByEmail &&
    Boolean(orderUserId) &&
    orderUserId !== user.id;

  const mismatchEmailButUserIdMatches =
    ownsByUserId &&
    Boolean(normalizedOrderEmail) &&
    Boolean(normalizedAuthEmail) &&
    normalizedOrderEmail !== normalizedAuthEmail;

  return {
    owns,
    ownsByUserId,
    ownsByEmail,
    normalizedAuthEmail,
    normalizedOrderEmail,
    orderUserId,
    mismatchUserIdButEmailMatches,
    mismatchEmailButUserIdMatches,
  };
}

export function logCustomerOrderOwnershipMismatches(
  logger: Logger,
  scope: string,
  orderId: string,
  authUserId: string,
  ownership: CustomerOrderOwnershipResult,
): void {
  const shortOrder = shortIdForLog(orderId);
  const shortUser = shortIdForLog(authUserId);
  const shortOrderUser = shortIdForLog(ownership.orderUserId);

  if (ownership.mismatchUserIdButEmailMatches) {
    logger.warn(
      `[${scope}] ownership mismatch order=${shortOrder} authUser=${shortUser} orderUser=${shortOrderUser} emailMatch=true userIdMatch=false`,
    );
  }

  if (ownership.mismatchEmailButUserIdMatches) {
    logger.warn(
      `[${scope}] ownership mismatch order=${shortOrder} authUser=${shortUser} orderUser=${shortOrderUser} userIdMatch=true emailMatch=false`,
    );
  }
}

/** Throws {@link CUSTOMER_ORDER_NOT_FOUND_MESSAGE} when order is null or not owned. */
export function assertCustomerOrderOwnership<T extends CustomerOrderOwnershipRow>(
  logger: Logger,
  scope: string,
  order: T | null | undefined,
  user: CustomerOrderOwnershipUser,
  orderId: string,
): asserts order is T {
  if (!order) {
    logger.warn(
      `[${scope}] denied order=${shortIdForLog(orderId)} user=${shortIdForLog(user.id)} reason=missing`,
    );
    throw new UnauthorizedException(CUSTOMER_ORDER_NOT_FOUND_MESSAGE);
  }

  const ownership = evaluateCustomerOrderOwnership(order, user);

  if (!ownership.owns) {
    logger.warn(
      `[${scope}] denied order=${shortIdForLog(orderId)} user=${shortIdForLog(user.id)} reason=not_owner`,
    );
    throw new UnauthorizedException(CUSTOMER_ORDER_NOT_FOUND_MESSAGE);
  }

  logCustomerOrderOwnershipMismatches(logger, scope, orderId, user.id, ownership);
}
