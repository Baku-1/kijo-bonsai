-- Migration: 20260817000001_claim_render_job_fn.sql
-- Postgres function for atomic render job claim.
-- Called by the render worker via supabase.rpc('claim_render_job').
-- Uses FOR UPDATE SKIP LOCKED for multi-instance safety (two workers won't
-- claim the same job simultaneously).
-- Returns the claimed row (after status update) so worker has all job fields.

CREATE OR REPLACE FUNCTION public.claim_render_job()
RETURNS SETOF public.render_queue
LANGUAGE sql
AS $$
  UPDATE public.render_queue
  SET    status     = 'processing',
         updated_at = now(),
         attempts   = attempts + 1
  WHERE  id = (
    SELECT id
    FROM   public.render_queue
    WHERE  status = 'pending'
    ORDER  BY created_at ASC
    LIMIT  1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
