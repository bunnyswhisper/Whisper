-- Atomic promo claim: one unclaimed point_claim_codes row per call; no double-credit under concurrency.

CREATE OR REPLACE FUNCTION public.claim_point_code_atomic(
  p_user_id uuid,
  p_code text
)
RETURNS TABLE (
  points_added numeric,
  points_balance numeric,
  lifetime_points numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_points_added numeric;
  v_balance numeric;
  v_lifetime numeric;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already claimed code'
      USING ERRCODE = 'P0001';
  END IF;

  v_code := upper(trim(coalesce(p_code, '')));

  IF v_code = '' THEN
    RAISE EXCEPTION 'Invalid or already claimed code'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.customer_points (user_id, points_balance, lifetime_points, updated_at)
  SELECT p_user_id, 0, 0, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.customer_points WHERE user_id = p_user_id
  );

  UPDATE public.point_claim_codes
  SET
    is_claimed = true,
    claimed_by = p_user_id,
    claimed_at = now()
  WHERE upper(trim(code)) = v_code
    AND is_claimed = false
  RETURNING points INTO v_points_added;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already claimed code'
      USING ERRCODE = 'P0001';
  END IF;

  v_points_added := coalesce(v_points_added, 0);

  SELECT cp.points_balance, cp.lifetime_points
  INTO v_balance, v_lifetime
  FROM public.customer_points cp
  WHERE cp.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already claimed code'
      USING ERRCODE = 'P0001';
  END IF;

  v_balance := v_balance + v_points_added;
  v_lifetime := v_lifetime + v_points_added;

  UPDATE public.customer_points
  SET
    points_balance = v_balance,
    lifetime_points = v_lifetime,
    updated_at = now()
  WHERE user_id = p_user_id;

  points_added := v_points_added;
  points_balance := v_balance;
  lifetime_points := v_lifetime;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.claim_point_code_atomic(uuid, text) IS
  'Claims one promo code row (is_claimed=false) and credits customer_points once; concurrent callers cannot double-credit.';

GRANT EXECUTE ON FUNCTION public.claim_point_code_atomic(uuid, text)
  TO service_role;
