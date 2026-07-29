-- Migration: wrap kijonsai_token_id_seq in a SECURITY DEFINER function
-- so Edge Functions can call nextval via RPC without direct sequence access.
--
-- The sequence kijonsai_token_id_seq must already exist.
-- Called from seed-claim/index.ts as: serviceClient.rpc('get_next_kijonsai_token_id')

CREATE OR REPLACE FUNCTION get_next_kijonsai_token_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT nextval('kijonsai_token_id_seq');
$$;
