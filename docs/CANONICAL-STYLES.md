# Canonical Bonsai Style List — Kijo Bonsai

**Confirmed by Jeremy: 2026-07-28**  
**Status: AUTHORITATIVE — overrides GDD §4.2.1 where they conflict**

---

## The 7 Canonical Styles

| Index | Style | Japanese Name | Primary Stat(s) | Combat Identity |
|---|---|---|---|---|
| 0 | Formal Upright | Chokkan | All (balanced) | No weakness, no specialty — the all-rounder |
| 1 | Informal Upright | Moyogi | Ki | Energy and ability-focused fighter |
| 2 | Slant | Shakan | Power | Pure aggressor |
| 3 | Cascade | Kengai | skillSlots | Most digit voxels from hanging branches → most ability slots |
| 4 | Windswept | Fukinagashi | Defense + Stability | The survivor — resists damage AND knockback |
| 5 | Literati | Bunjin | skillPoints | Glass cannon specialist — many points to invest, low HP |
| 6 | Broom | Hokidachi | HP + Endurance | The wall — raw health and staying power |

**Wisdom and matchPct are self-derived — not style-driven.**
- Wisdom = age in real days (tiers: <100→0, 100-199→1, 200-364→2, 365-499→3, ≥500→4)
- matchPct = how closely the tree was grown toward its seed's ideal style spline

**Total: 7 styles. `seed % 7` for style index selection.**

---

## What Is NOT In Scope

**Sekijoju (Root Over Rock)** — NEVER part of Jeremy's design. Appeared in GDD §4.2.1 erroneously. Root Over Rock is a penjing/landscape display style, not a potted-tree combat archetype. Remove from all documents.

---

## Code Impact

`StatTerrain.ts` — `splineForSeed()` currently uses a placeholder `seed % 8`. Must change to `seed % 7` when the remaining 6 style splines are implemented.

`STYLE_SPLINES` array must have 7 entries (indices 0–6), not 8.

---

## GDD §4.2.1 Error

GDD v0.2 §4.2.1 lists 8 styles including Sekijoju ("Root Over Rock | Extreme Stability + moderate HP — immovable anchor"). This row is INCORRECT and must be removed when the GDD is next updated.

---

## Penjing School Alignment (confirmed by Jeremy, 2026-07-28)

- Yangzhou (flat-bough cloud styling) → Hokidachi / Chokkan
- Sichuan (twisted trunks) → Moyogi / Shakan
- Lingnan (clip-and-grow) → Fukinagashi (jagged natural forms)

These are care-culture flavors that align naturally with style outcomes. Not a separate classification system.
