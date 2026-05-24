-- Atomic points redemption + coupon creation (single transaction, row lock).
-- Concurrent redeem requests serialize on customer_points FOR UPDATE.
-- If INSERT fails, the whole transaction rolls back (no orphaned deduction).

CREATE OR REPLACE FUNCTION public.redeem_points_coupon_atomic(
  p_user_id uuid,
  p_points_cost integer,
  p_discount_percent integer,
  p_min_order_amount numeric,
  p_coupon_code text,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_balance numeric;
  v_new_balance numeric;
BEGIN
  IF p_points_cost IS NULL OR p_points_cost <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid coupon tier');
  END IF;

  INSERT INTO public.customer_points (user_id, points_balance, lifetime_points, updated_at)
  SELECT p_user_id, 0, 0, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.customer_points WHERE user_id = p_user_id
  );

  SELECT points_balance INTO v_old_balance
  FROM public.customer_points
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_old_balance IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Could not load points balance');
  END IF;

  IF v_old_balance < p_points_cost THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Not enough points',
      'balance', v_old_balance
    );
  END IF;

  v_new_balance := v_old_balance - p_points_cost;

  UPDATE public.customer_points
  SET
    points_balance = v_new_balance,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.customer_coupons (
    user_id,
    code,
    discount_percent,
    points_cost,
    min_order_amount,
    is_used,
    status,
    source,
    expires_at
  ) VALUES (
    p_user_id,
    p_coupon_code,
    p_discount_percent,
    p_points_cost,
    p_min_order_amount,
    false,
    'active',
    'points',
    p_expires_at
  );

  RETURN jsonb_build_object(
    'ok', true,
    'new_balance', v_new_balance,
    'coupon_code', p_coupon_code
  );
END;
$$;

COMMENT ON FUNCTION public.redeem_points_coupon_atomic(uuid, integer, integer, numeric, text, timestamptz)
  IS 'Locks customer_points row (FOR UPDATE), checks balance, deducts points and inserts coupon atomically.';

GRANT EXECUTE ON FUNCTION public.redeem_points_coupon_atomic(uuid, integer, integer, numeric, text, timestamptz)
  TO service_role;
