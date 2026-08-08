-- render_queue: tracks pending Blender render jobs.
-- See docs/NFT-METADATA-IMAGE-ARCH.md for full schema rationale.
-- Render worker polls this table (FOR UPDATE SKIP LOCKED) every 5s.

CREATE TABLE IF NOT EXISTS public.render_queue (
  id         BIGSERIAL    PRIMARY KEY,
  token_id   BIGINT       NOT NULL,
  tree_id    UUID         NOT NULL REFERENCES public.trees(id),
  trigger    TEXT         NOT NULL CHECK (trigger IN ('mint','prune','wire','tick')),
  status     TEXT         NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','processing','done','failed')),
  attempts   INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_render_queue_status_created
  ON public.render_queue (status, created_at)
  WHERE status = 'pending';
