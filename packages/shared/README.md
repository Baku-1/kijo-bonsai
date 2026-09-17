# @kijo/shared

Foundation types and utilities used by all Kijo packages.

## Purpose

Single source of truth for types, the PRNG, spatial hash, and rounding discipline. Every other package imports from here. Nothing imports into here.

## Public Surface

**Types**
- `Branch` — `{ id, parent, depth, angle, length, thickness, pruned, children: number[] }`
- `TreeState` — full tree: seed, species, day, moisture, health, rotation, fertilizer, rngState, branches[]
- `CareAction` — `water | rotate | prune(branchId) | fertilize`
- `CareLogEntry` — `{ day, action: CareAction }`
- `SpeciesClass` — `'hardwood' | 'evergreen' | 'tropical'`
- `Coordinate`, `StatType`, `StatSheet`

**Utilities**
- `SeededRNG` — Mulberry32 variant. `new SeededRNG(seed)`, `.next() → [0,1)`
- `spatialHash(seed, x, y, z) → uint32` — deterministic coordinate hash for terrain stats
- `round4(x) → number` — `Math.round(x * 10000) / 10000`; call after every growth float op
- `SPECIES_PARAMS: Record<SpeciesClass, SpeciesParams>` — extensionMultiplier, forkSpread, secondaryForkChance, trunkMaturationRate

**Constants**
- `GRID_SIZE = 256`
- `MAX_DEPTH = 6`

## Gate Status

S1 ✓ Types compile  
S2 ✓ SeededRNG determinism (same seed → same sequence)  
S3 ✓ spatialHash determinism  
S4 ✓ round4 precision  
S5 ✓ SPECIES_PARAMS present for all three species  

## Dependencies

None. This package has zero runtime dependencies.

## Spirit morale contract and pure rules (2026-09-16)

Public exports in `src/spiritMorale.ts` are available through `@kijo/shared`.
`MoraleState` is JSON-safe live state with a value and persisted refusal latch.
It is separate from `TreeState`, `StatSheet`, voxel morphology and its hash.
`createNewTreeMorale()` starts a newly planted tree at **50**, as approved by
Jeremy. It is never a fallback for missing state, a wallet-claim reset, or an
existing-tree migration.

`readMoraleState` validates finite 0-100 values and a boolean latch, and returns
a fresh canonical state. Below 20 sets refusal; 50 or more clears it. From 20
through 49.999 the saved latch is retained. Never reconstruct that latch from
the current value alone. `getMoraleAdmission` reports either permission or an
explicit refusal reason. `getMoraleExpression` uses 20/40/70 boundaries (exactly 40
is composed, exactly 70 remains composed); the separate willingness field in
`MoraleCareView` keeps a recovering spirit distinct from an unrefused one.
The caretaker view contains no numeric morale.

`applyMoraleEvent` applies one **server-validated fact**, without mutating input.
Known care/combat deltas follow `docs/DESIGN-SPIRIT-MORALE.md`. The day event
nets optimal-care +2, rest +3 and moisture-stress -3 once per assessed day;
`healthStable` and `restDay` must come from an authoritative day assessment.
It does not invent the undefined stable-health predicate. Care never checks
combat admission. Successful pruning and fertilizer facts must reflect actual
canonical effect acceptance, including fertilizer cooldown.

The Soothing Leaf Potion effect restores 100 immediately. Ronin recovery takes
an explicit amount from a separately approved server policy and cannot raise
morale above 65 or lower an existing value above 65. The module does **not**
implement a Ronin amount schedule, diminishing-return window, inventory,
burn verification or token operations. A named event is not proof of its
authorization. No event deduplication or persistence is implemented here:
repeating a credited event repeats its effect.

### Integration status and next boundary

This is a tested shared foundation, **not connected gameplay**. Extend the
existing `apps/server/supabase/functions/care-action/index.ts` transaction and
tree read responses. That endpoint currently inserts the care log and then
decrements consumables separately; the authoritative transaction must commit
valid care, inventory, morale/latch and a unique event identity together.
Deduplicate day/care/result/potion facts under the same transaction, including
concurrent retries. Admission must use persisted authoritative state and protect
the actual battle-start operation, not merely a client button. Keep existing
offline training independent of live morale.

Use the shared JSON contract in the existing web transport and Godot reader;
keep live morale outside the immutable snapshot. No changes here alter those
consumers, server storage, growth math or stats. Existing-tree initialization,
health-stable assessment, first-loss qualification and Ronin policy remain
integration decisions; the pure event API does not resolve them.

### Second Brain comparison

Read references: `wiki/patterns/SageStarCodes/guards-and-checks.md`, sections 1-3,
and `wiki/patterns/SageStarCodes/event-handlers.md`, sections 1-3.
The former's explicit validation and reason-bearing eligibility checks map to
`readMoraleState`, field validation and `getMoraleAdmission`. The latter's
separation of event wiring and business logic maps to `applyMoraleEvent` as a
pure shared rule called by the existing authoritative server. Its event-filter
requirements are **not satisfied merely by calling this function**: endpoint
authorization and transaction guards remain to be integrated. These citations
are pattern comparisons, not claims that the source authors reviewed KIJO.

### Verification

From the repository root:

```text
npm run build -w @kijo/shared
npm run typecheck -w @kijo/shared
node packages/shared/test_shared.mjs
node --test packages/shared/test_spirit_morale.mjs
```

The new tests cover initial 50, refusal serialization and recovery, gradual care,
known deltas, immediate potions, caps, invalid inputs, immutability, qualitative
transport and the explicit lack of replay protection.
