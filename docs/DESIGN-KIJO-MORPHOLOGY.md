# Design Decision: Kijo Morphology — Tree-to-Body Mapping

**Confirmed by Jeremy:** from GDD (v0.2, July 23 2026)
**Status: AUTHORITATIVE**

---

## Overview

The kijo's body is built deterministically from the kijonsai's voxel structure. There is no separate character creator. No random generation. No artist designing the body. The tree IS the body, interpreted through a direct anatomical mapping from tree parts to body parts.

The same 256³ voxel grid that represents the kijonsai is re-interpreted as a body plan. Every structural decision the caretaker made (which branches to keep, which to prune, how thick the trunk grew) shapes the kijo's physical form, combat capabilities, and visual identity.

**Morphology is a Phase 2 feature.** Phase 1 delivers a 2D silhouette preview (see below). Full 3D generation is Phase 2. This document is authoritative for both the preview and the full implementation.

---

## Primary Mapping: Trunk → Torso

The trunk is the torso. All trunk measurements map directly:

| Trunk Property | Kijo Property | Combat Implication |
|---|---|---|
| Thickness < 4 voxels wide | Lithe, narrow frame | Low mass, higher speed |
| Thickness 4–7 voxels | Athletic, balanced build | Standard |
| Thickness 8+ voxels | Broad, heavy frame | High mass, damage absorption |
| Curvature | Posture — curved trunk = dynamic/leaning pose | Visual identity |
| Trunk length | Torso height → kijo's overall height | Visual identity |
| Upper trunk section + crown base | Head shape + face structure | See Face Generation |
| Trunk knots/texture variations | Facial feature variation | A gnarled old trunk = weathered face |

---

## Limb Mapping: Depth-1 Branches → Legs and Arms

Depth-1 branches (the primary branches emerging directly from the trunk) are sorted by their vertical position on the trunk (Y-axis in the voxel grid) and split:

**Lower depth-1 branches → Legs**
- The lowest set of major branches become the kijo's legs
- Branch thickness = leg thickness
- Branch angle = stance width
- Branch length = leg length and reach
- Configuration variants:
  - Two lower branches = standard bipedal stance
  - Three lower branches = tripod/tailed stance (one rear limb for stability)
  - One lower branch = rooted pillar stance — immovable but slow

**Upper depth-1 branches → Arms**
- The upper set of major branches become arms
- Same thickness and length mapping as legs
- Branch angle determines reach arc
- Configuration variants:
  - Two upper branches = standard dual arms (most common)
  - Three or more = multi-armed (rare — requires specific growth patterns)
  - One upper branch = single dominant arm (power style — all attack resources concentrated)

**Key property:** branch length maps directly to limb length. A long depth-1 branch = long arm/leg reach. A short thick one = compact powerful limb. The caretaker who prunes to keep branches short and thick is literally building a short-reach, high-power kijo.

---

## Extremity Mapping: Depth-2+ Branches → Digits

Depth-2+ branches (sub-branches extending from limb branches) become the kijo's digits:

- Each depth-2 sub-branch off a leg branch → a toe/foot structure
- Each depth-2 sub-branch off an arm branch → a finger/hand structure
- Depth-3+ branches off digits → claw tips, nail detail, joint articulation

**Depth-2 branch length → claw/digit length:**
- Long thin sub-branches = long claws (slashing attack style)
- Short thick sub-branches = stubby powerful digits (grappling/crushing style)

**Pruned sub-branches = missing digits:**
- Removes grip/reach diversity from that limb
- The stump hardens (prune scar) — focused power in remaining digits
- Pruning a sub-branch is literally removing a finger/toe to concentrate power in what remains

**Combat connection:** In the fighting game model, depth-2 branches ARE the combo slots (one slot per depth-2 branch). The morphological digits ARE the moves. A kijo with 8 depth-2 branches has 8 fingers/toes/claws AND 8 combo slots. A heavily pruned kijo with 3 depth-2 branches has 3 powerful digits AND 3 devastating moves.

---

## Canopy Mapping: Leaves → Crown, Hair, Aura

- Leaf density at branch tips → crown volume and character
- Seasonal leaf color → crown color (autumn = red/gold, spring = vivid green, etc.)
- Rare leaf color → crown inherits the rare color permanently (see `DESIGN-LEAF-COLOR-RARITY.md`)

Configuration variants:
- Heavy full canopy = lush flowing crown/mane
- Heavily pruned canopy = spiked angular crown (battle-hardened look)
- Winter state (no leaves, hardwood) = bare horned/antlered silhouette

---

## Scar Mapping: Prune Points → Battle Marks

Every prune scar on the kijonsai corresponds to a visible scar on the kijo's body at the anatomically mapped location:

- Trunk prune scars = torso scars
- Upper branch prune scars = arm scars
- Lower branch prune scars = leg scars
- Sub-branch prune scars = missing/scarred digits

Scars are badge-of-honor visual markers. A heavily scarred kijo tells a story of deliberate shaping. A deeply-pruned kijo's body reveals the caretaker's sculpting history. This is the visual provenance — you can read a kijo's care history from her body.

Wire scars (from late wire removal) also appear at the contact points on the kijonsai's bark, mapping to the corresponding body location on the kijo. These are not badges of honor — they represent imperfect technique.

---

## Weapon Generation: Prune Stumps → Body Weapons

Pruned branch stumps that were thick at the time of cutting become weapons. The kijo doesn't carry separate weapons — her weapons grow FROM her body at the prune points.

| Stump Angle | Weapon Type |
|---|---|
| Downward-angled stump | Blade/sword |
| Horizontal stump | Shield/guard |
| Upward stump | Horn/spike |

Stump thickness determines weapon weight class. A thick stump cut early (when the branch was already substantial) produces a heavier weapon than a thin twig cut young.

**The caretaker literally forged the weapons by choosing what to cut, when.** An upward-angled branch cut at substantial thickness becomes a horn. A horizontal branch cut early becomes a shield boss. The weapon is not chosen — it grew from the cut.

---

## Face and Eye Generation

**Eye generation (species-determined):**
| Species | Eye Color |
|---|---|
| Hardwood | Steady amber |
| Evergreen | Cool silver |
| Tropical | Vibrant green |

**Face generation:**
- Upper trunk section + crown base = head shape
- Trunk knots and texture variations map to facial feature variation
- A gnarled, old trunk = weathered face with character and age
- A smooth, young trunk = youthful/fierce expression
- Expression is driven by morale state:
  - High morale (>70): Fierce, eager, fully present
  - Medium morale (40–70): Neutral, composed
  - Low morale (20–40): Reluctant, distant
  - Below 20 (refuses): Withdrawn — turned away, will not meet the fighter's gaze

---

## 2D Silhouette Preview (Phase 1 Deliverable)

During the care loop, the player sees a real-time kijo silhouette preview before awakening is available. This is computed from the current tree state and costs nothing to produce — no art request, no rendering queue.

Pipeline:
1. Run morphology mapper on current tree state
2. Generate 2D filled outline from the skeleton + mesh
3. Render as translucent overlay or side panel
4. Updates every growth tick

Timeline of the preview:
- Day 1: Vague humanoid outline — barely recognizable as a figure
- Day 100: Recognizable fighter with visible limbs, crown, rough proportions
- Day 300: Detailed character with claws, crown, stance, scar locations visible

This is the "progress porn" that motivates continued care. The player watches their kijo take shape. The preview is motivation, not the deliverable.

---

## Morphology Implications for Gameplay

Pruning decisions have direct combat anatomy consequences:

| Care Decision | Morphology Result | Combat Impact |
|---|---|---|
| Prune a lower branch | Remove structural support from a leg | Less endurance for movement-based abilities |
| Prune an upper branch | Remove arm capability | Less attack diversity from that side |
| Prune sub-branches | Fewer but stronger digits | Specialist grip vs. versatile hands (fewer but more powerful combo slots) |
| Early prune (while thin) | Remaining branches grow thicker/longer | Surviving limbs become more powerful |
| Late prune (after substantial growth) | Remove established capability | Loses existing stat voxels; surviving branches don't compensate fully |
| No pruning (wild growth) | Maximum branch count, maximum digit count | Many combat options; no specialization; lower power per slot |

A caretaker who understands the morphology mapping can deliberately sculpt a kijo's combat body through their pruning pattern. This is the deepest skill expression in the care loop — growing a fighter, not just growing a tree.

---

## For Implementers

- The morphology mapper is its own processing step, separate from the growth engine and the voxelizer. It takes the tree structure (branch data with depth, angles, length, thickness) and outputs a skeleton.
- Skeleton format uses semantic bone names: `torso`, `left_leg`, `right_leg`, `left_arm`, `right_arm`, `digits_L[1..N]`, `digits_R[1..N]`, `crown`. This naming is what allows universal animation clips to work across all kijo body shapes.
- Depth-1 branches must be classified into leg vs. arm by Y-position on the trunk. The threshold (lower third → legs, upper → arms) must be defined — the GDD's "attachment height determines the arm/leg morphology split" (KIJO-TECH-SPEC.md §4.6 is the reference).
- The silhouette preview must be computed from the morphology mapper output (not the voxelizer output) for performance — parametric branch data → skeleton → 2D outline is much cheaper than voxelization at preview frequency.
- Wire scar positions on bark must be stored in the voxel material layer (not as a separate data structure) so that the morphology mapper can read them and place the corresponding kijo body marks.
- Phase 1 delivers 2D silhouette only. Full 3D mesh generation is Phase 2.

---

## For Auditors

- A kijo arm appearing on the wrong side (L/R inverted) is a **bug** in the branch-to-arm assignment.
- A kijo with 0 arms (upper branches pruned to none before awakening) is NOT necessarily a bug — but it is an unusual edge case that should be tested: what does a no-arm kijo look like and fight like?
- Weapon generation at any non-prune-scar location is a **bug** — weapons grow only from prune stumps.
- Scar appearing on the kijo's body at a location with no corresponding prune scar on the tree is a **bug**.
- Eye color not matching species class is a **bug** — eye color is species-locked.
- Morale expression not updating after morale changes is a **bug** — the face expression is a live state, not baked at awakening.
- The silhouette preview showing in Phase 1 with full 3D detail is **out-of-scope for Phase 1** but not a correctness bug — flag for scope review.
