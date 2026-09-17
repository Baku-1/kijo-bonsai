// debug-branches.mjs — deterministic branch audit for a Kijo tree.
// Replays the tree's care log from Supabase and prints every branch with a
// REACHABLE flag that mirrors tree_mesh.ts computePlacements (children-walk
// from root 0). Branches that are counted but unreachable are the invisible
// ones: present in the flat array, never drawn by the renderer.
//
// Run from kijo-bonsai:  node scripts/debug-branches.mjs <tree_id>
// Example:               node scripts/debug-branches.mjs 140ec05f-04c0-429b-89ca-609cf25bae7a
import { BonsaiTree, CareLogReplay } from '@kijo/engine';

const SUPABASE_URL = 'https://xutjubkaskwchzyzwryk.supabase.co';
const treeId = process.argv[2];
if (!treeId) {
  console.error('usage: node scripts/debug-branches.mjs <tree_id>');
  process.exit(1);
}

const res = await fetch(`${SUPABASE_URL}/functions/v1/get-tree?tree_id=${treeId}`);
if (!res.ok) {
  console.error('get-tree failed:', res.status, await res.text());
  process.exit(1);
}
const data = await res.json();
console.log('tree:', data.tree_id, 'seed', data.seed, 'species', data.species, 'day', data.current_day, 'actions', data.care_log.length);

// Map server care log -> engine CareLogEntry[]. Ticks are implicit days.
const entries = data.care_log
  .filter((e) => e.action_type !== 'tick')
  .map((e) => ({
    day: e.game_day,
    action: { type: e.action_type, ...e.action_data },
  }));

const tree = data.current_day > 0
  ? CareLogReplay.reconstruct(data.seed, data.species, entries, data.current_day)
  : new BonsaiTree(data.seed, data.species);
const branches = tree.getBranches();

// Reachability: walk children links from root 0 exactly like computePlacements.
const reachable = new Set();
const walk = (id) => {
  reachable.add(id);
  for (const c of branches[id]?.children ?? []) walk(c);
};
walk(0);

console.log('\ncountLivingBranches()  =', tree.countLivingBranches());
console.log('flat non-pruned count  =', branches.filter((b) => !b.pruned).length);
console.log('reachable from root    =', reachable.size, '\n');

for (const b of branches) {
  const reach = reachable.has(b.id);
  const counted = !b.pruned && b.parent !== null;
  const flag = counted && !reach ? '  <-- COUNTED BUT NEVER DRAWN' : '';
  console.log(
    `id=${b.id} parent=${b.parent} depth=${b.depth} len=${b.length.toFixed(2)} thk=${b.thickness.toFixed(2)} pruned=${b.pruned} children=[${b.children.join(',')}] counted=${counted} reach=${reach}${flag}`
  );
}
