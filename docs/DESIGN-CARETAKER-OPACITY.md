# Design Decision: Caretaker View is Intentionally Stat-Opaque

**Confirmed by Jeremy: 2026-07-28**  
**Status: AUTHORITATIVE — must not be "fixed" by any implementer or auditor**

---

## The Rule

**The primary caretaker UI (App.tsx / ThreeCanvas / CareHud) does NOT display StatSheet stats, style archetype, or matchPct. This is intentional design. It is NOT a bug.**

---

## Why

The entire value system of Kijo Bonsai rests on three things:

1. **Time** — the tree ages in real days. A 500-day tree has lived for 500 real days.
2. **Mastery** — the caretaker learns over time what their tree needs, what their style demands, how to grow toward the ideal. They cannot shortcut this with a dashboard.
3. **Mystery** — the caretaker does not know their exact stats. They guess. They observe. They learn. This is what makes the NFT valuable.

If the caretaker can see their HP, Power, matchPct, and style name in real time, they will optimize. Optimization kills the mastery loop. A player who maximizes via dashboard is not a master — they are a parser. The game is not for parsers.

The mystery IS the game.

---

## What This Means for Each View

| View | Stats shown | Purpose |
|---|---|---|
| `App.tsx` / `ThreeCanvas` / `CareHud` | **None** — intentional | Player-facing caretaker UI |
| `main2d.ts` | All 8 (→10 after defense/stability) | Developer debug view only |
| `main3d.ts` | HP, Power, Ki, Endurance, morale, voxel counts, style hints (not style name/index) | Voxel 3D Viewer — caretaker-accessible |

main2d.ts exists so developers can verify the stat engine is working. It is not player-facing and must never become the basis for what the player sees. main3d.ts is different — see the **Two Caretaker Views** section below.

---

## What Is and Is NOT Allowed in the Caretaker View

**Allowed — observable signals:**
- Tree health (general — "healthy", "stressed", "wilting")
- Moisture level
- Age in days / seasons
- Number of living branches (observable morphology)
- Visual form of the tree (the player sees it grow)

**NOT allowed — hidden from caretaker view:**
- HP, Power, Endurance, Ki, SkillSlots, SkillPoints as numeric values
- Defense, Stability
- Wisdom tier (they may infer it from age, but not see a number)
- matchPct (the most important hidden stat — reveals how well they grew their tree)
- Morale (numeric value — hidden from the main care UI; the caretaker may sense their tree's spirit through qualitative visual cues, but does not see a number here). **Note:** morale IS shown in the Voxel 3D Viewer (main3d.ts) — this is intentional. The voxel viewer shows morale because it tells the caretaker how prepared their kijo is for Phase 2 combat. This is a meaningful feedback signal, not a hidden stat: the caretaker should know whether the tree they are tending will fight when called upon. Hiding the number from the main care UI preserves the mastery loop; surfacing it in the voxel viewer completes the Phase 1 → Phase 2 feedback bridge.
- Style name / style index (the caretaker should discover what their tree is becoming through play, not a label)

---

## Two Caretaker Views

The caretaker experience has two distinct views, both accessible to all caretakers.

### Main Caretaker UI (App.tsx / ThreeCanvas / CareHud)
- **Shows:** tree health (qualitative), moisture, age, visual form
- **Does NOT show:** HP, Power, Endurance, Ki, SkillSlots, SkillPoints, Defense, Stability, Wisdom (numeric), matchPct, morale (numeric value), style name, style index

### Voxel 3D Viewer (main3d.ts) — Caretaker-Accessible, Always Available

This is the kijo preview viewer. It is **NOT** a developer-only view — it is part of the caretaker experience and is available to all caretakers at all times.

- **Shows:** all kijo stats (HP, Power, Ki, Endurance, etc.), morale, voxel counts (which determine stats), style hints
- **Does NOT show:** style name, style index — bonsai trees are never grown in perfection; the caretaker sees shape and character, not a classification label

The style name and style index remain hidden even in the Voxel 3D Viewer. The caretaker can observe their tree's form and read its nature from the voxels, but the style label is withheld. This is intentional.

---

## For Auditors

An adversarial audit of App.tsx that flags "no stat display" as a critical defect is WRONG. The auditor has mistaken an intentional design constraint for an implementation gap.

Before flagging a missing UI element as a defect, auditors must check this document and `CANONICAL-STYLES.md` for design intent.

---

## For Implementers

Do not add a stat table to App.tsx, ThreeCanvas, or CareHud. Do not display style name in the player-facing UI. Do not display matchPct. Do not display wisdom as a number.

If a future architect spec proposes adding these, push back: the design decision is Jeremy's and it is load-bearing.

---

## The Value Proposition in One Sentence

Time is what makes the NFT valuable. A tree that is 500 days old and was grown by someone who learned — without a dashboard — how to coax it toward its style is worth more than a tree grown by someone who watched numbers.
