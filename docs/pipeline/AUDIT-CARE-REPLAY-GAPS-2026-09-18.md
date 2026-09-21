# AUDIT: Care Replay Gaps — 2026-09-18

**Auditor:** Claude (adversarial-auditor skill)  
**Scope:** JinEngine stub | Landscape replay gap | Care action alignment  
**Verdict:** CAVEATS — two replay-breaking gaps confirmed in production path

---

## 1. JinEngine Stub

**File:** `packages/engine/src/JinEngine.ts` (51 lines)

### What it does

`JinEngine.applyJin(tree, branchId, segmentIndex, jinCost)` is a **Phase 1 stub** that:

1. Validates `branchId` — returns `{ ok: false, reason: 'not-found' }` if out of range
2. Validates `b.pruned` — returns `{ ok: false, reason: 'pruned' }` if branch was pruned
3. Validates `segmentIndex` — returns `{ ok: false, reason: 'segment-out-of-range' }` if outside `[0, branch.length)`
4. **Throws `CareLogReplayError`** after all validation passes (line 49)

### What it does NOT do

- Does NOT convert bark voxels to `VoxelRole.SCAR`
- Does NOT freeze branch angle (deadwood behavior)
- Does NOT increment `jinCount` on the tree
- Does NOT log a care entry
- Does NOT call `markDirty`
- Does NOT consume `jinCost` consumables

### Consequence for replay

`CareLogReplay` line 144 calls `tree.applyJin(a.branchId, a.segmentIndex, a.jinCost)`. This delegates to `JinEngine.applyJin`, which **always throws** after validation. Therefore: **any care log containing a `jin` action will fail reconstruction**. The server accepts `jin` actions (they are in ALLOWED_ACTION_TYPES), so jin entries can exist in production care logs right now.

### Phase 2 requirements (from TODO on line 45)

- Convert bark voxels from `segmentIndex` to tip to `VoxelRole.SCAR`
- Freeze branch angle (deadwood)
- Increment `jinCount`
- Log care entry
- Call `markDirty`
- Consume `jinCost` consumables (currently `void`'d on line 46)

---

## 2. Landscape Replay Gap

**File:** `packages/engine/src/CareLogReplay.ts`, lines 145–150

### What happens

```typescript
} else if (a.type === 'landscape') {
    throw new CareLogReplayError(
      `'landscape' is not yet implemented and cannot be replayed (Phase 2).`
    );
}
```

The handler exists but **unconditionally throws**. Any care log containing a `landscape` action will fail reconstruction.

### TechniqueClassifier dependency (cross-reference with DESIGN-TECHNIQUE-CLASSIFICATION.md)

The classifier requires `landscapeCount` (count of landscape elements placed) to determine the Water-and-Land overlay:

```
if landscapeCount >= 3:
    overlays.push(WATER_AND_LAND)
```

**The chain is broken:**

1. Server accepts `landscape` → entry written to care_log_entries ✓
2. CareLogReplay encounters `landscape` → **throws** ✗
3. TechniqueClassifier never runs because tree reconstruction failed ✗
4. `landscapeCount` is never computed ✗
5. Water-and-Land overlay is never classified ✗

### What landscape replay would need to do

The design doc says landscape elements are rocks, water features, moss, and ceramic decorations placed around the tree. Replay would need to:

- Apply the landscape element to the tree's scene/composition state
- Increment `landscapeCount` so the classifier can read it
- Preserve deterministic placement (same seed → same result)
- NOT affect growth/branch physics (landscape is aesthetic-only per design)

---

## 3. Care Action Alignment Table

**Server whitelist** (line 98 of `care-action/index.ts`):
```
water, prune, wire, wire-remove, fertilize, rotate, jin, landscape, twine, twine-remove, weight, weight-remove
```

**CareLogReplay handlers** (lines 104–158 of `CareLogReplay.ts`):

| Action Type    | Server accepts? | CareLogReplay handles? | Notes |
|----------------|:-:|:-:|-------|
| `water`        | YES | YES | Wrapped in try/catch, re-throws as CareLogReplayError |
| `prune`        | YES | YES | Delegates to `PruneEngine.prune` |
| `wire`         | YES | YES | Delegates to `WireEngine.wire` |
| `wire-remove`  | YES | YES | Delegates to `WireEngine.removeWire` (Phase 2 complete) |
| `fertilize`    | YES | YES | Delegates to `tree.fertilize()` |
| `rotate`       | YES | YES | Delegates to `tree.rotate()` |
| `jin`          | YES | **THROWS** | Delegates to `tree.applyJin` → `JinEngine.applyJin` → throws CareLogReplayError (Phase 1 stub) |
| `landscape`    | YES | **THROWS** | Explicit throw: "not yet implemented" |
| `twine`        | YES | YES | Passes `a.degradeDays` for RNG replay stability |
| `twine-remove` | YES | YES | Delegates to `tree.removeTwine` |
| `weight`       | YES | YES | Delegates to `tree.applyWeight` |
| `weight-remove`| YES | YES | Delegates to `tree.removeWeight` |
| `tick`         | **NO** (server-generated) | **NO** (not in replay — ticks are GrowthEngine.growTick per day) | Server injects `tick` entries via lazy-tick loop but they are not in the ALLOWED_ACTION_TYPES whitelist. Replay generates ticks implicitly via the day loop. Correct. |

### Flags

**2 action types the server accepts but CareLogReplay cannot replay:**

1. **`jin`** — Server writes jin entries to care_log_entries. CareLogReplay calls JinEngine.applyJin which throws. Any tree with a jin action in its log **cannot be reconstructed**. This corrupts the care log for NFT verification.

2. **`landscape`** — Server writes landscape entries to care_log_entries. CareLogReplay throws on encounter. Any tree with a landscape action in its log **cannot be reconstructed**. This also breaks TechniqueClassifier's Water-and-Land overlay detection.

**10 of 12 action types replay cleanly.** The 2 that don't are both premium/advanced features gated behind consumable purchases, which limits blast radius — but any tree that has used them is unverifiable.

---

## VERDICT: CAVEATS

```
CLAIMS CHECKED:
  (no completion claim — this is a gap audit, not a completion verification)

SCOPE:
  3 areas audited, all from source. No files outside scope touched or read.

FRAUDS HUNTED:
  weakened tests:    N/A (audit scope, not implementation)
  false completion:  N/A
  intent inversion:  FOUND — server accepts jin and landscape, but engine
                     throws on replay. The server-side whitelist and engine-side
                     replay are out of sync. The intent (accept → replay → verify)
                     is broken at the replay step.
  phantom evidence:  none — all line numbers and code verified from source

INTENT CHECK:
  code does:     Server accepts jin/landscape, writes to care_log. Replay throws on both.
  check expects: N/A (no test covers cross-system alignment)
  spec says:     TechniqueClassifier needs landscapeCount from replay. JinEngine needs
                 to produce SCAR voxels for jinCount to be meaningful.
  verdict:       CONFLICT — server and engine disagree on what's replayable.

BOTTOM LINE:
  Two action types (jin, landscape) are accepted by the server but crash replay.
  Any tree that has used either feature has a corrupted care log — it cannot be
  reconstructed for NFT verification. Phase 2 implementation of both engines will
  close the gap, but until then these actions should either be gated on the server
  or the client should not offer them.
```
