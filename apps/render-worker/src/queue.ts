// apps/render-worker/src/queue.ts
// Atomic render job claim and status update helpers.
// Uses a Postgres function (claim_render_job) for FOR UPDATE SKIP LOCKED --
// the Supabase JS client does not expose this via its query builder.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RenderJob {
  id: number;
  token_id: number;
  tree_id: string;
  trigger: string;
  attempts: number;
}

// Atomic claim: selects oldest pending job, marks it 'processing', increments attempts.
// Returns the claimed job row, or null if the queue is empty.
// claim_render_job() is defined in migrations/20260817000001_claim_render_job_fn.sql.
export async function claimJob(supabase: SupabaseClient): Promise<RenderJob | null> {
  const { data, error } = await supabase.rpc('claim_render_job');
  if (error) {
    console.error('[queue] claimJob error:', error.message);
    return null;
  }
  const rows = data as RenderJob[] | null;
  return rows?.[0] ?? null;
}

export async function markDone(supabase: SupabaseClient, jobId: number): Promise<void> {
  const { error } = await supabase
    .from('render_queue')
    .update({ status: 'done' })
    .eq('id', jobId);
  if (error) console.error('[queue] markDone error:', error.message);
}

export async function markFailed(
  supabase: SupabaseClient,
  jobId: number,
  errorMsg: string,
): Promise<void> {
  const { error } = await supabase
    .from('render_queue')
    .update({ status: 'failed', error: errorMsg })
    .eq('id', jobId);
  if (error) console.error('[queue] markFailed error:', error.message);
}

export async function markPending(supabase: SupabaseClient, jobId: number): Promise<void> {
  const { error } = await supabase
    .from('render_queue')
    .update({ status: 'pending' })
    .eq('id', jobId);
  if (error) console.error('[queue] markPending error:', error.message);
}
