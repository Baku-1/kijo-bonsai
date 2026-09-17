# Growth Engine End Goal

**Created:** 2026-09-09
**Status:** Target spec - authoritative for this workstream until superseded
**Owner:** Jeremy Gordon
**Governs:** the kijonsai growth engine (packages/engine), its stat/derivation
contract, and the care-loop truthfulness around it.

---

## 1. Why this document exists

The growth engine does not meet the target that is already written down in this
repo. That is the entire problem, and it is documented:

- **Target (documented):** `DECISIONS.md` line 12 - the branch-count target is
  **15-30 branches**. The fork constants were reconciled *to reach that target*.
- **Observed (audited):** replaying kijonsai `140ec05f-...` (seed
  7472909771253292, tropical, day 106, 139 log rows) produced **4 living
  branches** (trunk + 4 segments = "5" in the UI label).
- **Admitted deviation:** `GrowthEngine.ts` carries the comment that the
  constants were adjusted to satisfy `count>=5` - a test threshold - not the
  15-30 design target.

Additional confirmed gaps (adversarial audit, run_c012305a):

- Realism mechanisms named by the project's own research are absent from every
  package: phototropism / space colonization, internode length and curvature,
  and per-species L-system grammars. Per-species `forkAngle` is dead data.
- `fork_chance` in code (`forkChance x (1.0 - depth x 0.1) x rate`, species
  values 0.10 / 0.12 / 0.16) still differs from `KIJO-TECH-SPEC.md` s4.2
  (`0.38 - depth x 0.05`); the header text was never updated.
- The care loop can silently lose player actions: `care-action` rejects
  prune/wire when the wallet lacks the `shears`/`wire` consumable
  (`seed-tree` creates them at quantity 0), and the client historically
  swallowed the failure - so a cut branch reappears on reload.
- The UI branch label counts the trunk and every segment, not what a player
  perceives as limbs.

## 2. End goal statement

**The kijonsai growth engine must produce a realistic bonsai: a tree that
reaches the documented branch target, obeys the documented structural rules,
expresses species character, and responds to the caretaker's actions - while
remaining bit-for-bit deterministic and without altering how already-minted
kijonsai derive.**

## 3. Requirements

**R1 - Branch target.** A healthy, well-tended kijonsai reaches the documented
**15-30 branch** range within the documented growth window, for all three
species (Hardwood / Evergreen / Tropical). "Healthy, well-tended" is a named
care regime used by the acceptance check, not a vibe.

**R2 - Structural rules (GDD / TECH-SPEC s4.6).**
- One-third rule: the lowest main branch attaches at roughly one-third up the
  trunk; the lower 33-50 percent stays bare.
- Taper rule: trunk thickest at base, thinning monotonically toward apex; the
  lowest branch is thickest, the highest thinnest.
- Max branching depth 6.
- Fork creates 1-2 child branches at species-appropriate angles.

**R3 - Realism mechanisms (from the project's own research).** The engine must
implement, or explicitly and durably defer with a logged decision:
- apical dominance (leader suppresses laterals; pruning releases them),
- phototropism / light-driven growth (rotation must have a real effect),
- internode length and branch curvature as growing limbs rather than straight
  one-shot segments,
- per-species branching grammar (branch angle, internode length, bifurcation
  probability, apical dominance strength).

**R4 - Species character.** Hardwood / Evergreen / Tropical must differ in ways
a player can see, driven by grammar parameters - not by three numbers that are
partly unused (`forkAngle` is currently dead data).

**R5 - Determinism (non-negotiable).** Same seed + species + care log produces
a bit-identical tree. No `Math.random`, `Date.now`, or `crypto` in engine or
voxelizer. `round4` after every growth write. Verified by running twice and
diffing, never by the existence of a test.

**R6 - Minted-asset safety (non-negotiable).** Changing growth behaviour must
not change how already-minted kijonsai derive. Existing trees must replay under
the behaviour they were minted under. This requires an engine-version mechanism
(or an owner-approved, explicitly-logged migration), decided during the
architect phase - not a silent constant edit.

**R7 - Care-loop truthfulness.** No player action may be silently lost. If a
care action is rejected (e.g. no shears consumable), the player sees the real
reason and the local tree does not keep a change the care log does not have.
The branch label must show a count that matches what a player sees.

**R8 - Stat contract intact.** Voxel roles (TRUNK/ARM/LEG/DIGIT/CANOPY/ROOT/
SCAR) and stat derivation (hp, power, endurance, ki, skillSlots, skillPoints,
wisdom, matchPct) keep working; canopy remains the Ki source; the mesh keeps
mirroring the voxelizer.

## 4. Non-negotiables

- Import boundaries: engine imports only shared; voxelizer imports only shared
  and engine. No rendering, I/O, or network in the deterministic core.
- Terminology canon from the verified-architect skill (kijonsai, kijo,
  Flower Guild Rank, matchPct, 7 combat styles).
- GDD is the authority; a conflict with the GDD is surfaced to the owner, never
  silently overridden.
- One package per task; decisions logged in DECISIONS.md; STATE.md updated on
  completion.

## 5. Acceptance checks (named, runnable)

1. `test_growth.mjs` reports all G-checks passing.
2. `npm test` in the engine package passes, including the care-log determinism
   suite and the identity suite.
3. Determinism: reconstruct the same tree twice and diff - identical.
4. Branch target: for each species, a named healthy-care regime reaches 15-30
   living branches within the documented window; the count and the care regime
   are printed as evidence.
5. One-third rule and taper hold on the resulting trees (asserted, printed).
6. Legacy safety: a recorded pre-change tree's care log replays to the same
   structure as before the change.
7. Care-loop: prune/wire without the consumable produces a visible error and
   no divergent local state; the branch label matches visible limbs.

## 6. Visual expectation (dream-loop principle)

The dream-loop method applies in its decision-shaping sense: establish what
"correct" looks like as a target before building, and compare the result
against it. A reference image of the intended mature kijonsai (informal
upright, one-third bare trunk, tapered trunk, layered side branches, species
foliage) should be produced and treated as the visual target.

Honest limitation: this environment cannot screenshot the running web client,
so the dream-loop's automated critic step cannot run here. The visual judge is
the owner, or a screenshot the owner provides. The algorithm and structural
acceptance checks above are the machine-verifiable part.

## 7. Process (the project's own skills)

Run the three-stage pipeline, in order:

1. **verified-architect** - `res://kijo-bonsai/.claude/skills/verified-architect/SKILL.md`
   Produce the design: verified claims, cross-reference check against GDD /
   TECH-SPEC / Architecture / Engine API / PRD, assumptions register, open
   questions. Resolve R6 (versioning) explicitly. STOP for owner approval.
2. **disciplined-implementer** - `res://kijo-bonsai/.claude/skills/disciplined-implementer/SKILL.md`
   Build the smallest correct change with the intent gate, `round4`,
   run-twice determinism verification, DECISIONS.md + STATE.md updates.
3. **adversarial-auditor** - `res://kijo-bonsai/.claude/skills/adversarial-auditor/SKILL.md`
   Re-verify adversarially; hunt weakened tests and false completion.

## 8. Open decisions for the owner

1. Engine versioning: stamp an `engineVersion` on new trees and replay legacy
   trees under the old constants - or accept a logged, owner-approved balance
   change to existing trees?
2. Scope of R3 realism: implement apical dominance + phototropism + internodes
   now, or stage them (branch target first, realism second)?
3. Whether the visual reference image should be generated as part of this
   workstream.
