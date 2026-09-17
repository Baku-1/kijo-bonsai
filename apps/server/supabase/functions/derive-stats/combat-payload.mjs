import { buildCombatSnapshot } from './engine.bundle.mjs';

/** Transport identity only; never included in growth math or treated as a signature. */
export async function createCombatPayload(tree, voxelization) {
  const payload = buildCombatSnapshot(tree, voxelization);
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const snapshotId = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return { ...payload, snapshotId };
}
