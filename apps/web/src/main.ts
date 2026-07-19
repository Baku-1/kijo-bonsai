import { BonsaiTree } from '@kijo/engine';
import type { SpeciesClass } from '@kijo/shared';
import { createScene } from './renderer/scene.js';
import { buildTreeMesh } from './renderer/tree_mesh.js';
import { CareBridge } from './bridge/care_bridge.js';
import { CareHud } from './ui/hud.js';

// ---------------------------------------------------------------------------
// Kijo care client — Layer 1 boot.
//
// Wiring only. The engine (@kijo/engine) owns ALL growth logic; the web
// client never computes growth itself. Flow per action:
//   UI event → CareBridge → engine call → tree marks dirty →
//   afterAction → rebuild mesh (renderer clears dirty) → HUD refresh.
// ---------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || 464497;
const speciesParam = params.get('species');
const species: SpeciesClass =
  speciesParam === 'evergreen' || speciesParam === 'tropical' ? speciesParam : 'hardwood';

const tree = new BonsaiTree(seed, species);

const container = document.getElementById('scene-container')!;
const careScene = createScene(container);

function livingBranchCount(): number {
  return tree.getBranches().filter((b) => !b.pruned).length;
}

function refreshView(): void {
  // Dirty-flag handshake (DECISIONS.md): the renderer — and only the
  // renderer — clears the flag, after rebuilding from engine truth.
  if (tree.isDirty()) {
	buildTreeMesh(careScene.treeRoot, tree);
	tree.clearDirty();
  }
  hud.update(tree, livingBranchCount());
}

const bridge = new CareBridge(tree, refreshView);

const hud = new CareHud({
  onWater: () => bridge.water(),
  onNextDay: () => bridge.nextDay(),
  onToggleAuto: () => bridge.toggleAuto(),
});

// First paint: trunk exists from creation, but isDirty() starts false —
// build the initial mesh explicitly.
buildTreeMesh(careScene.treeRoot, tree);
hud.update(tree, livingBranchCount());
console.log(`[kijo-care] boot seed=${seed} species=${species}`);

// Render loop — OrbitControls damping requires continuous update; the tree
// mesh itself only rebuilds on the dirty-flag handshake above.
function animate(): void {
  requestAnimationFrame(animate);
  careScene.controls.update();
  careScene.renderer.render(careScene.scene, careScene.camera);
}
animate();
