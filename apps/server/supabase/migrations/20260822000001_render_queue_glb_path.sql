-- Migration: 20260822000001_render_queue_glb_path.sql
-- Add glb_path to render_queue to track GLB output status independently of the PNG.
-- NULL = GLB not yet built, or build failed (non-fatal; PNG may still exist).
-- Populated by render worker after successful GLB upload to Supabase Storage.
-- PNG path is not stored (always derivable as renders/{token_id}.png).

ALTER TABLE public.render_queue
  ADD COLUMN IF NOT EXISTS glb_path TEXT;

COMMENT ON COLUMN public.render_queue.glb_path IS
  'Supabase Storage path of the built GLB, e.g. renders/42.glb. NULL if not yet built or build failed.';
