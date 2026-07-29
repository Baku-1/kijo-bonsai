-- Migration: reverse-lookup function for wallet-auth edge function
--
-- The wallets table has NO user_id column. The wallets ↔ auth.users link is
-- unidirectional from auth.users: raw_user_meta_data->>'wallet_row_id' = wallets.id.
-- This function inverts that join so the wallet-auth edge function can resolve
-- the Supabase user_id from a wallet address.
--
-- SECURITY DEFINER: allows the service-role RPC caller to read auth.users,
-- which is not accessible via PostgREST or the public schema directly.
-- search_path = public prevents search-path injection.
--
-- Called from wallet-auth/index.ts as:
--   serviceClient.rpc('get_user_id_by_wallet_address', { addr: address.toLowerCase() })

CREATE OR REPLACE FUNCTION public.get_user_id_by_wallet_address(addr TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM auth.users u
  JOIN public.wallets w
    ON w.id = (u.raw_user_meta_data->>'wallet_row_id')::uuid
  WHERE LOWER(w.wallet_address) = LOWER(addr)
  LIMIT 1
$$;
