-- Convert all existing admin replies to public visibility (private replies removed from UI)

UPDATE public.customer_reviews
SET admin_reply_visibility = 'public'
WHERE admin_reply IS NOT NULL
  AND admin_reply_visibility IS DISTINCT FROM 'public';
