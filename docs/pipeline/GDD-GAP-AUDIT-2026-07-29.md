# GDD Gap Audit — 2026-07-29

**Auditor:** Claude (pipeline pass)
**Source document:** `kijo-bonsai/docs/GDD.md` v0.2 (updated July 23, 2026)
**Audit scope:** Identify all major GDD systems without standalone authoritative docs; write one doc per gap.
**Output directory:** `kijo-bonsai/docs/`

---

## Docs Written in This Pass

All new files are authoritative design docs. Do not modify existing docs listed in "Protected" below.

| File | System | GDD Source | Notes |
|---|---|---|---|
| `DESIGN-SPECIES.md` | Species system — Hardwood/Evergreen/Tropical triangle | GDD §3.1, §4.2.1, §4.3, §10.4 | Growth profiles, seasonal behavior, combat identity, style affinity, appearance |
| `DESIGN-TECHNIQUE-CLASSIFICATION.md` | Technique classification rules | GDD §3.1.1 | Full classifier logic including wire disqualification permanence, twine ≠ wire ruling, overlay vs primary distinction, notification rules |
| `DESIGN-SPECIES-TECHNIQUE-ARCHETYPES.md` | 12-archetype grid (3 species × 4 techniques) | GDD §3.1.1 | All 12 named; GDD-named archetypes (Spike Tank, Armored Glass Cannon) preserved verbatim |
| `DESIGN-FLOWER-GUILD-RANK.md` | Flower Guild Rank, matchPct, ideal form, wire scarring penalty | GDD §4.2.2 | Full rank tier table, wire timing → scar → rank penalty, Raffia Wrap effect, economic and competitive implications |
| `DESIGN-SLP-DUAL-POTION.md` | Two SLP systems sharing a name | GDD §2.3 | Soothing Leaf Potion (server-side, caretaker, full restore) vs Smooth Love Potion (Ronin SLP ERC-20, fighter, 65% cap, diminishing returns, burn on use) |
| `DESIGN-NOTCH-DEFERRED.md` | Notch mechanic — intentionally deferred | GDD §3.2 | Holding doc to prevent accidental early implementation and ensure the mechanic isn't forgotten |
| `DESIGN-SPIRIT-MORALE.md` | Spirit Morale system | GDD §3.5 | Decrease triggers, increase triggers, refusal threshold (20%), re-engagement threshold (50%), SLP interaction, recovery methods |
| `DESIGN-LEAF-COLOR-RARITY.md` | Leaf color rarity easter egg | GDD §10.4 | **INTERNAL ONLY — do not surface to players.** ~3% roll rate, palette by species, undisclosed by design, crown inheritance |
| `DESIGN-COMBAT-SYSTEM-STATUS.md` | Combat system ambiguity — fighting game vs turn-based | GDD §4.3 warning + §4.4 | Status doc: fighting game is leading candidate; neither system is finalized; identifies what can/cannot be built before decision |
| `DESIGN-WISDOM-STAT.md` | Wisdom stat — age-based Fight IQ | GDD §3.2, §4.3, §4.4 | Scaling thresholds for both combat models, what Wisdom does and does not affect, abandoned tree market implication |
| `DESIGN-KIJO-MORPHOLOGY.md` | Kijo morphology — tree-to-body mapping | GDD §5.4, §10.3 | Full mapping table: trunk→torso, depth-1→limbs, depth-2→digits, canopy→crown, scars→body marks, prune stumps→weapons, face/eye generation, 2D silhouette preview scope |

**Total docs written: 11**

---

## Protected Docs (Not Touched)

These docs existed before this audit pass and were not modified:

| File | System |
|---|---|
| `CANONICAL-STYLES.md` | 7 bonsai styles (Sekijoju banned) |
| `DESIGN-CARETAKER-OPACITY.md` | Caretaker UI opacity — no stats/style/matchPct in care interface |
| `DESIGN-TWINE-VS-WIRE.md` | Twine vs wire — free vs premium, timing, scars |
| `ADR-STATSHEET-DEFENSE-STABILITY.md` | Defense + Stability ADR |
| `ARCHITECT-STATSHEET-DEFENSE-STABILITY.md` | StatSheet implementer spec |
| `IMPL-VS-DOCS-COMPARISON.md` | Implementation vs docs gap list |
| `PHASE2-WALLET-ARCH.md` | Phase 2 wallet architecture |
| `ARCH-GUEST-MODE.md` | Guest mode architecture |
| `PHASE1-RONIN-ARCH.md` | Phase 1 Ronin architecture |
| `KIJONSAI-CONTRACT-ARCH.md` | Smart contract architecture |
| `KIJO-PRD.md` | Product requirements document |
| `KIJO-ARCHITECTURE.md` | System architecture |
| `KIJO-ENGINE-API.md` | Engine API reference |
| `KIJO-TECH-SPEC.md` | Technical specification |
| `NFT-METADATA-IMAGE-ARCH.md` | NFT metadata and image architecture |
| `COMBAT-METADATA-AUDIT.md` | Combat metadata audit |
| `AUDIT-SECTION3-TECHNIQUE.md` | Technique audit (found errors in COMBAT-METADATA-REQUIREMENTS.md §3.5) |
| `AUDIT-SECTION3-STATS.md` | Stats audit |
| `COMBAT-METADATA-REQUIREMENTS.md` | Combat metadata requirements |

---

## Gaps Found vs. Gaps Written

### Written in This Pass

All 6 required gaps from the audit brief were written. Additionally, 5 discovered gaps were written:

- **DESIGN-SPIRIT-MORALE.md** — The morale system is a core retention mechanic that spans both care and combat loops. No standalone doc existed. The GDD §3.5 prose was the only source.
- **DESIGN-LEAF-COLOR-RARITY.md** — The easter egg rarity system is explicitly undisclosed in player-facing materials but needs an internal doc so implementers know the roll rate, palette, and prohibition on surfacing it.
- **DESIGN-COMBAT-SYSTEM-STATUS.md** — The GDD has two mutually conflicting combat system designs with an explicit "under review" note. Without a status doc, implementers could build either or both and waste effort. This is the highest-ambiguity item in the GDD.
- **DESIGN-WISDOM-STAT.md** — Wisdom is documented across multiple GDD sections but never as a standalone authoritative spec. It affects both combat models differently and needed a single canonical reference.
- **DESIGN-KIJO-MORPHOLOGY.md** — The tree-to-body mapping is one of the most detailed systems in the GDD (§5.4 + §10.3) and is Phase 2 critical path. KIJO-TECH-SPEC.md references the morphology but the authoritative design intent belongs in a design doc, not a tech spec.

---

## Remaining Gaps (Not Written in This Pass — Require Further Investigation)

The following systems have some coverage in existing docs but may need standalone design docs. They were not written in this pass because existing docs (KIJO-TECH-SPEC.md, KIJO-ENGINE-API.md, DESIGN-TWINE-VS-WIRE.md) may already cover them adequately. Investigate before writing:

| System | Existing Coverage | Recommended Action |
|---|---|---|
| **Advanced Wire Techniques** (Guy-Wire, Dual-Branch Tie, Raffia Wrap) | Partially in DESIGN-TWINE-VS-WIRE.md (Twine vs Wire doc); GDD §3.2 | Read DESIGN-TWINE-VS-WIRE.md — if Guy-Wire and Dual-Branch Tie are not there, write DESIGN-ADVANCED-WIRE-TOOLS.md |
| **Jin Pliers tool** | Mentioned in DESIGN-TECHNIQUE-CLASSIFICATION.md (this pass); GDD §3.2 | May warrant DESIGN-JIN-PLIERS.md if the tool needs specific implementation spec beyond what the technique doc covers |
| **Season/Day Cycle** | GDD §3.2 passive systems; likely in KIJO-TECH-SPEC.md | Read KIJO-TECH-SPEC.md season section. If not there, write DESIGN-DAY-CYCLE-SEASONS.md |
| **Delegation Contract system** | KIJONSAI-CONTRACT-ARCH.md, GDD §5 | Contract doc likely covers on-chain terms; check if the design intent (caretaker dependency, prune authority) is captured |
| **Exhibition Events** (future) | Noted in DESIGN-FLOWER-GUILD-RANK.md as future feature | No implementation doc needed until scoping begins; logged here for tracking |
| **Structural Aesthetics rules** | GDD §3.2, referenced KIJO-TECH-SPEC.md §4.6 | Check KIJO-TECH-SPEC.md §4.6 for coverage |
| **Day Cycle speed (subscription)** | GDD §7 monetization table | Covered in KIJO-PRD.md or PHASE1-RONIN-ARCH.md likely; verify |

---

## Known Errors Found in Existing Non-Protected Docs

These errors were identified during this audit pass through cross-referencing. They are in `COMBAT-METADATA-REQUIREMENTS.md §3.5` and are documented in the existing `AUDIT-SECTION3-TECHNIQUE.md` (which was written before this pass).

The errors have not been fixed in `COMBAT-METADATA-REQUIREMENTS.md §3.5` as of this audit. The authoritative design is now in `DESIGN-TECHNIQUE-CLASSIFICATION.md`. Recommended action: use this new doc to rewrite §3.5 in COMBAT-METADATA-REQUIREMENTS.md.

| Error | Correct Value | Source |
|---|---|---|
| Bound-and-Cut combat archetype listed as "Control/grapple" | "Balanced" — all-rounder, no exploitable weakness | GDD §3.1.1 |
| Clip-and-Grow combat archetype listed as "Precision pruner" | "High-Crit" — devastating critical hits | GDD §3.1.1 |
| Jin combat archetype listed as "Deadwood specialist" | "Defensive" — absorbs punishment, outlasts | GDD §3.1.1 |
| Water-and-Land combat archetype listed as "Root-based fighter" | "None" — care-loop only, display only | GDD §3.1.1 (known prior error, still uncorrected) |
| Jin and Water-and-Land not labeled as OVERLAY techniques | Both are overlays, not primaries | GDD §3.1.1, ENGINE-API, TECH-SPEC §7.4 |
| Default technique listed as Clip-and-Grow | Default is Bound-and-Cut | GDD §3.1.1, ENGINE-API, TECH-SPEC §7.4 |

---

## Audit Methodology

1. Read GDD.md v0.2 in full (1123 lines)
2. Inventoried all existing docs in `kijo-bonsai/docs/` (20 files + 1 pipeline file)
3. Read `AUDIT-SECTION3-TECHNIQUE.md` to understand prior audit findings
4. Identified gaps by matching GDD sections to existing doc coverage
5. Wrote 11 new docs in strict documentation-only pass (no code files touched)
6. Wrote this summary file

---

*Audit completed: 2026-07-29. All new docs in kijo-bonsai/docs/.*
