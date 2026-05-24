-- Replaces jsonb-returning redeem_points_coupon_atomic with row-returning variant.
-- Signature and behavior: lock customer_points FOR UPDATE, validate balance, deduct,
-- insert customer_coupons, return inserted row; insufficient balance raises exception.

DROP FUNCTION IF EXISTS public.redeem_points_coupon_atomic(uuid, integer, integer, numeric, text, timestamptz);

CREATE OR REPLACE FUNCTION public.redeem_points_coupon_atomic(
  p_coupon_code text,
  p_discount_percent integer,
  p_expires_at timestamptz,
  p_min_order_amount numeric,
  p_points_cost integer,
  p_user_id uuid
)
RETURNS public.customer_coupons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_balance numeric;
  v_new_balance numeric;
  v_row public.customer_coupons%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid user'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_points_cost IS NULL OR p_points_cost <= 0 THEN
    RAISE EXCEPTION 'Invalid coupon tier'
      USING ERRCODE = 'P0001';
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
    RAISE EXCEPTION 'Could not load points balance'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_old_balance < p_points_cost THEN
    RAISE EXCEPTION 'Not enough points'
      USING ERRCODE = 'P0001';
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
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.redeem_points_coupon_atomic(text, integer, timestamptz, numeric, integer, uuid) IS
  'Per user: FOR UPDATE on customer_points serializes concurrent calls; deduct, insert coupon, return row; raises on insufficient points.';

GRANT EXECUTE ON FUNCTION public.redeem_points_coupon_atomic(text, integer, timestamptz, numeric, integer, uuid)
  TO service_role;
