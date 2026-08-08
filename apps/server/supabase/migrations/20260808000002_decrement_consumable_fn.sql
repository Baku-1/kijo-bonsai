-- decrement_consumable: atomic consumable decrement for care-action.
-- Replaces the two-step read+write pattern in care-action/index.ts s6
-- with a single UPDATE that evaluates `quantity - 1` server-side, preventing
-- double-spend races when concurrent requests both see quantity > 1.
--
-- Returns the updated row if decrement succeeded (quantity was > 0).
-- Returns empty result set if quantity was already 0 or ownership check failed.
-- Caller maps empty result to 409 (same behaviour as current code).
--
-- wallet_id check is included for defense-in-depth (mirrors the s1 ownership
-- check in care-action, but enforced atomically at the DB write layer).
--
-- Called from care-action/index.ts:
--   serviceClient.rpc('decrement_consumable', {
--     p_consumable_id: consumableRow.id,
--     p_wallet_id: wallet_row_id,
--   })
--
-- SECURITY DEFINER: runs with definer privileges to bypass RLS on consumables.
-- search_path = public prevents search-path injection.
--
-- Down (reference only -- never run in production):
-- DROP FUNCTION IF EXISTS public.decrement_consumable(UUID, UUID);

CREATE OR REPLACE FUNCTION public.decrement_consumable(
  p_consumable_id UUID,
  p_wallet_id     UUID
)
RETURNS TABLE(id UUID, quantity INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.consumables
     SET quantity = quantity - 1
   WHERE id        = p_consumable_id
     AND wallet_id = p_wallet_id
     AND quantity  > 0
  RETURNING id, quantity;
$$;
