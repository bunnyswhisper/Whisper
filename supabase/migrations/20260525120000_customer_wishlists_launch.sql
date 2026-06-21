-- Launch V1.1: customer wishlists + one-time first-wishlist Bunny Points reward.

CREATE TABLE IF NOT EXISTS public.customer_wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_wishlists_user_product_unique UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_wishlists_user_id
  ON public.customer_wishlists (user_id);

CREATE INDEX IF NOT EXISTS idx_customer_wishlists_product_id
  ON public.customer_wishlists (product_id);

CREATE INDEX IF NOT EXISTS idx_customer_wishlists_created_at
  ON public.customer_wishlists (created_at DESC);

COMMENT ON TABLE public.customer_wishlists IS
  'Per-customer product wishlists; toggled via toggle_wishlist_atomic.';

CREATE TABLE IF NOT EXISTS public.customer_reward_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  points_awarded numeric NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_reward_events_user_event_unique UNIQUE (user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_customer_reward_events_user_id
  ON public.customer_reward_events (user_id);

COMMENT ON TABLE public.customer_reward_events IS
  'One-time reward ledger (e.g. first_wishlist); unique per user + event_type.';

CREATE OR REPLACE FUNCTION public.toggle_wishlist_atomic(
  p_user_id uuid,
  p_product_id uuid
)
RETURNS TABLE (
  wishlisted boolean,
  first_wishlist_reward_granted boolean,
  points_awarded numeric,
  points_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_granted boolean := false;
  v_points_awarded numeric := 0;
  v_balance numeric := 0;
  v_lifetime numeric := 0;
BEGIN
  IF p_user_id IS NULL OR p_product_id IS NULL THEN
    RAISE EXCEPTION 'Invalid wishlist request'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = p_product_id AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Product not found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.customer_wishlists cw
    WHERE cw.user_id = p_user_id
      AND cw.product_id = p_product_id
  )
  INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.customer_wishlists
    WHERE user_id = p_user_id
      AND product_id = p_product_id;

    SELECT cp.points_balance
    INTO v_balance
    FROM public.customer_points cp
    WHERE cp.user_id = p_user_id;

    v_balance := coalesce(v_balance, 0);

    wishlisted := false;
    first_wishlist_reward_granted := false;
    points_awarded := 0;
    points_balance := v_balance;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.customer_wishlists (user_id, product_id)
  VALUES (p_user_id, p_product_id);

  INSERT INTO public.customer_points (user_id, points_balance, lifetime_points, updated_at)
  SELECT p_user_id, 0, 0, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.customer_points WHERE user_id = p_user_id
  );

  WITH reward_insert AS (
    INSERT INTO public.customer_reward_events (
      user_id,
      event_type,
      points_awarded,
      metadata
    )
    VALUES (
      p_user_id,
      'first_wishlist',
      100,
      jsonb_build_object('product_id', p_product_id)
    )
    ON CONFLICT ON CONSTRAINT customer_reward_events_user_event_unique DO NOTHING
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM reward_insert)
  INTO v_granted;

  IF v_granted THEN
    v_points_awarded := 100;

    SELECT cp.points_balance, cp.lifetime_points
    INTO v_balance, v_lifetime
    FROM public.customer_points cp
    WHERE cp.user_id = p_user_id
    FOR UPDATE;

    v_balance := coalesce(v_balance, 0) + v_points_awarded;
    v_lifetime := coalesce(v_lifetime, 0) + v_points_awarded;

    UPDATE public.customer_points
    SET
      points_balance = v_balance,
      lifetime_points = v_lifetime,
      updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    SELECT cp.points_balance
    INTO v_balance
    FROM public.customer_points cp
    WHERE cp.user_id = p_user_id;

    v_balance := coalesce(v_balance, 0);
  END IF;

  wishlisted := true;
  first_wishlist_reward_granted := v_granted;
  points_awarded := v_points_awarded;
  points_balance := v_balance;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.toggle_wishlist_atomic(uuid, uuid) IS
  'Adds or removes a wishlist row; grants 100 Bunny Points once on first-ever wishlist add.';

GRANT EXECUTE ON FUNCTION public.toggle_wishlist_atomic(uuid, uuid)
  TO service_role;
