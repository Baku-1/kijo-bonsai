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
| `main3d.ts` | All 8 (→10 after defense/stability) | Developer debug view only |

main2d and main3d exist so developers can verify the stat engine is working. They are not player-facing. They must never become the basis for what the player sees.

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
- Style name / style index (the caretaker should discover what their tree is becoming through play, not a label)

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
