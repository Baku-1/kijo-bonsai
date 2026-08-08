-- Auto-update render_queue.updated_at on row UPDATE.
-- Without this, the column stays at its INSERT value regardless of status changes.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER render_queue_set_updated_at
  BEFORE UPDATE ON public.render_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
