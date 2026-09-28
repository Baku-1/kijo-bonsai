# Design Decision: Spirit Morale System

**Confirmed by Jeremy:** from GDD (v0.2, July 23 2026); bridge framing confirmed 2026-07-30
**Status: AUTHORITATIVE**

**Jeremy's clarification — 2026-09-16:** Morale rises gradually while the tree is being cared for. Potions are a quick fix: Soothing Leaf Potion restores 100% immediately on successful application; Smooth Love Potion grants its capped partial boost immediately after the server confirms the burn. Sustained care can reach 100% without a potion. The 65% ceiling applies to Ronin SLP recovery, not care-based recovery. This clarification resolves the earlier conflict about potion recovery taking time; other documented gains and losses remain unchanged.

---

## What Morale Is

Morale is the kijo's willingness to fight. It is a **Phase 2 combat-phase mechanic** that is **built during Phase 1 through caretaking**.

| | |
|---|---|
| **Scale** | 0–100 (server-side float, per kijo) |
| **Starting morale** | **50/100 for a newly planted tree** — neutral; confirmed by Jeremy 2026-09-16. Subsequent care changes this value before awakening. This is an initialization rule, not a reset of existing trees. |
| **Phase that builds it** | Phase 1 — caretaking actions accumulate morale over time |
| **Phase that uses it** | Phase 2 — morale gates combat participation |
| **What it controls** | Whether the kijo will enter combat (willingness), NOT combat power |
| **What it does NOT control** | Care actions — the kijo never refuses watering, pruning, or any Phase 1 action based on morale |

A kijo with low morale will refuse to fight for a neglectful player. A kijo with high morale enters combat willingly. Morale is the direct economic link between Phase 1 care quality and Phase 2 combat access.

---

## The Bridge Design (Intentional)

This is the core retention loop: a caretaker who neglects their tree produces a kijo that won't fight for its owner in Phase 2.

```
Good caretaking → high morale → willing fighter
Neglect          → low morale  → combat refusal
```

This creates an unbreakable dependency between the two phases. A fighter cannot grind indefinitely without engaging the care loop. A caretaker's work has direct, visible consequences in combat outcomes — not because care affects combat stats, but because it determines whether combat is available at all.

**Morale does not affect Phase 1 care actions.** The kijo does not refuse watering, pruning, fertilizing, or any caretaking action regardless of her morale state. Low morale is purely a Phase 2 consequence — it manifests at the combat gate, not in the garden.

---

## Combat Refusal Thresholds

| Threshold | Behavior |
|---|---|
| Morale ≥ 50 | Kijo fights normally |
| Morale 20–49 | Kijo can still fight; sub-optimal state |
| **Morale < 20** | **Kijo refuses to enter combat — combat is blocked** |
| Re-engagement | Morale must reach **50%** before kijo will fight again |

The refusal check is enforced server-side before any battle is initiated. A kijo at exactly 20 morale is NOT below the threshold — the check is strictly "below 20," so 20.0 is permitted.

Recovery to 50%+ after a refusal state typically requires 5–10 days of attentive care with no combat — or SLP spending (see [Recovery Methods](#morale-recovery-methods) below).

---

## What Raises Morale

These are the triggers that build morale, organized by which phase generates them:

### Phase 1 Caretaking (Builds Morale Over Time)

| Action | Change | Notes |
|---|---|---|
| Optimal care day (moisture 30–65%, health stable) | +2 per day | Passive — just keep the tree healthy |
| Pruning | +8 per prune performed | Represents deliberate, attentive shaping |
| Fertilizer application | +5 (one-time per cooldown) | Shares the 8-day cooldown with the growth effect |
| Rest day (no battles taken) | +3 per day | Phase 1/2 boundary — rest benefits both |
| Soothing Leaf Potion (caretaker's SLP) | Immediate full restoration to 100% | Quick recovery through care; see `DESIGN-SLP-DUAL-POTION.md` |

### Phase 2 Combat

| Event | Change |
|---|---|
| Victory | +10 morale |
| Smooth Love Potion / Ronin SLP (fighter's SLP) | ~20–30% partial restoration; **hard cap: cannot exceed 65%** |

The pruning morale bonus (+8) represents the kijo feeling her caretaker's deliberate attention — every cut is an act of care. This is why a caretaker who prunes regularly produces a kijo that is meaningfully more willing to fight than one who only waters.

The fertilizer morale bonus (+5) shares the same 8-day cooldown clock as the growth effect.

---

## What Drains Morale

### Phase 1 Neglect

| Condition | Change | Notes |
|---|---|---|
| Drought stress (moisture < 20%) | −3 per day | Active neglect, not normal care |
| Overwatering stress (moisture > 80%) | −3 per day | Active neglect |
| Low tree health during battle period (health < 40) | −5 per battle fought | Reinforces caretaker dependency |

### Phase 2 Combat Losses

| Event | Change | Notes |
|---|---|---|
| Consecutive loss | −15 per loss | Stacks: 3 straight losses = −45 morale |

Consecutive losses are deliberately punishing. Three losses in a row drops a healthy kijo below the combat refusal threshold. This prevents indefinite battle grinding and imposes a real cost for sending a weak kijo into repeated combat.

The tree health penalty during battles (−5 per battle when health < 40) is a Phase 1/Phase 2 dependency: fighting with a neglected tree is expensive for the fighter, not just the caretaker.

---

## Morale Recovery Methods

### Method 1: Care Loop (Full Recovery)

Normal care activity over 5–10 game days will restore morale from the refusal zone to above 50:

- Rest days: +3/day × 7 days = +21
- Optimal care days: +2/day × 7 days = +14
- Two prunes during the period: +16
- **Total: ~51 morale from ~7 days of focused caretaking**

Full recovery to 100 is achievable through sustained care over longer periods.

### Method 2: Soothing Leaf Potion — Caretaker's SLP (Full Restoration)

The caretaker's Soothing Leaf Potion restores morale **immediately to 100%** when successfully applied, with no diminishing returns. Sustained care also restores morale to 100%, gradually; a potion is not required for full recovery. The 65% ceiling belongs specifically to Ronin SLP recovery. Soothing Leaf Potion is brewed from caretaking byproducts (bark shavings, dried petals, root clippings, spring dew) — a caretaker who tends their tree naturally generates the ingredients.

See `DESIGN-SLP-DUAL-POTION.md` for full details on ingredients, properties, and economic design.

### Method 3: Smooth Love Potion — Fighter's SLP (Partial Restoration Only)

Fighters can spend real Ronin SLP (the ERC-20 token) for immediate partial morale recovery after the server confirms the burn. This is a band-aid:

| Use (within recovery window) | Morale restored |
|---|---|
| First use | ~20–30% |
| Second use | ~15% |
| Third use | ~8% |
| **Hard cap** | **Cannot raise morale above 65%** |

The 65% cap is not a monetization decision — it ensures fighters cannot eliminate caretakers from the economy. SLP can get a kijo back above the refusal threshold (50) faster, but optimal fighting willingness requires the caretaker's full restoration.

See `DESIGN-SLP-DUAL-POTION.md` for burn mechanics, on-chain interaction, and economic rationale.

---

## Design Intent: Three Purposes

**1. Prevents battle grinding.** Consecutive losses drain morale faster than victories restore it under non-optimal care. There is a natural session cadence imposed by the spirit's willingness to fight.

**2. Forces care loop engagement.** A fighter who doesn't tend their tree — or delegate to a caretaker who does — cannot sustain high battle frequency. Morale makes caretaking economically essential, not optional.

**3. Creates real dependency in the delegation model.** A fighter who delegates to a skilled caretaker gains:
- Regular prune morale boosts (+8 per prune)
- Optimal care day accumulation (+2/day)
- Soothing Leaf Potion access (full restoration to 100%)

A fighter operating solo is permanently limited to 65% morale via SLP. Full willingness requires the caretaker.

---

## Morale and the Kijo's Appearance

The kijo's expression is driven by morale state. This gives visual feedback before a combat refusal occurs:

| State | Expression |
|---|---|
| High morale (> 70) | Fierce, eager, fully present |
| Medium morale (40–70) | Neutral, composed, ready |
| Low morale (20–40) | Reluctant, distant, guarded |
| Below 20 — refuses | Withdrawn; the kijo will not meet the fighter's gaze; turned away from battle |

Expression state is a parameter in the procedural face generation pipeline. The fighter can read their kijo's willingness before a battle attempt fails.

---

## Kijo Awakening and Re-engagement

When a kijo enters the refusal state (morale < 20), she does not lose combat capability permanently. She temporarily withdraws. The awakening status is NOT revoked. Once morale is restored above 50:

- The kijo is immediately available for battle again
- No re-awakening ceremony is required
- Combat stats are unchanged by the morale period

Morale affects willingness, not power. A kijo who has fought, lost, recovered, and returned fights at the same stat level as before. Her spirit was wounded, not diminished.

---

## For Implementers

- Morale is a **server-side float (0.0–100.0)** stored per kijo (per tree). It is **NOT on-chain** — morale is live game state, not a permanent attribute.
- Morale changes are applied server-side on: battle result recorded, care action processed, day tick processed.
- **The refusal check (morale < 20) must be enforced server-side** before any battle is initiated. Client should present the refusal state clearly, including current morale value and suggested recovery actions.
- The 50% threshold for re-engagement after falling below 20% is a re-engagement threshold, not a continuous combat minimum. A kijo can fight at 51%; it's not a comfortable state but it's permitted.
- Morale from prune actions (+8) is credited when the prune action is successfully committed to the care log, not when the shears are purchased.
- The fertilizer morale bonus (+5) shares the same 8-day cooldown clock as the growth effect.
- SLP morale restoration is credited server-side after confirming the on-chain burn transaction. The morale credit must be atomic with the burn confirmation — partial states (burned but not credited, or credited but not burned) are unacceptable.
- Morale is **NOT displayed as a number in the main caretaker care UI** (App.tsx / ThreeCanvas / CareHud). It IS displayed in the Voxel 3D Viewer and to the fighter in the fighter's delegation dashboard. See `DESIGN-CARETAKER-OPACITY.md`.

---

## For Auditors

### Implementation checkpoint (2026-09-22)

The shared rules are now connected to the local server, caretaker, and Godot combat paths:

- `20260917000000_spirit_morale_care.sql` adds per-tree live morale, a persisted refusal latch, a deduplicated event ledger, request receipts, care revisions, and row-locking RPCs for atomic care commits and combat admission.
- `care-action` reconstructs the canonical tree, validates that the requested care action actually took effect, assesses elapsed days once, and commits the care log, consumable spend, morale events, day advance, and response receipt in one transaction.
- `combat-admission` checks the same persisted state and records an idempotent `battle-started` event before live combat. This event is what prevents a battle day from receiving the rest-day bonus.
- `wallet-auth` moves the verified wallet-row binding into server-controlled `app_metadata`; care, tree creation, mint claims, and tree listing no longer authorize from user-editable metadata. Existing sessions must sign in once after deployment.
- `get-tree` returns a qualitative morale envelope for `CareHud`; the main care UI displays no number. `derive-stats` attaches the same live envelope outside the immutable morphology hash.
- Godot validates the envelope, changes eye intensity/head posture, waits for authenticated combat admission for remote trees, and blocks both the intro and control unlock when a spirit refuses. Offline fixtures are explicitly training data.

Verification on 2026-09-22: shared morale tests 13/13, server care-plan tests 7/7, web TypeScript check passed, Edge Function sources passed TypeScript syntax transpilation, and Summer Engine playtests confirmed both willing combat and a withdrawn fighter held at `started=false` with controls disabled. The SQL migration has not been executed against PostgreSQL in this workspace because Docker access and the Supabase CLI are unavailable; it remains a required pre-deployment verification. No function or migration has been deployed.

Potion inventory, Soothing Leaf Potion consumption, Ronin burn confirmation, battle-result morale, and the exact Ronin diminishing-return window remain separate integration work. No local code treats an unverified client claim as a potion burn or battle result.

Second Brain comparison: `wiki/patterns/SageStarCodes/guards-and-checks.md` maps to explicit field validation and reason-bearing admission checks; `wiki/patterns/SageStarCodes/event-handlers.md` maps to thin transport handlers delegating to shared rules and transactional storage. The local implementation now follows those boundaries; PostgreSQL execution remains the unverified deployment gate. See `packages/shared/README.md` for the comparison and verification commands.

### Gameplay invariants

- At exactly 20 morale, a kijo that has not entered refusal **may fight**: 20.0 is not below 20. A kijo already in refusal remains unavailable until morale reaches 50. Check the persisted refusal state as well as the current value.
- **Morale recovering without care actions is a bug** — morale only increases through specific triggers, never passively on its own.
- **Morale exceeding 65% from Smooth Love Potion / Ronin SLP alone** (without Soothing Leaf Potion) is a **bug** — the hard cap must be enforced.
- **A kijo fighting at morale below 20 is a bug** — the refusal check failed server-side.
- **Morale displayed as a number in the main caretaker care UI (App.tsx / ThreeCanvas / CareHud) is a bug** — see `DESIGN-CARETAKER-OPACITY.md`. The Voxel 3D Viewer showing morale is correct and intentional.
- **Morale affecting combat stats (HP, Power, Endurance, Ki) is a bug** — morale affects willingness (whether the kijo fights), not combat power (how well she fights). Any morale-to-stat calculation is incorrect.
- **The kijo refusing a care action (watering, pruning, fertilizing) due to low morale is a bug** — morale does not gate Phase 1 actions. Only combat entry is blocked.
