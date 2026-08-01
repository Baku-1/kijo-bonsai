# Patch: Twine + Weight Cap Correction (2026-07-31)

**Files patched:** `docs/DESIGN-TWINE-VS-WIRE.md`, `docs/ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md`  
**Owner confirmation date:** 2026-07-31

A prior patch (OQ-3 resolution) incorrectly stated that twine (±28° max) and weights (4 × 7° = 28° max) are additive, yielding "56° total downward bend." The owner confirmed 2026-07-31 that this was wrong: both methods cap **independently** at 28°, and using twine AND weights on the same branch does not exceed 28° per application. Cascade to Kengai (Cascade style) is achieved by **stacking over time** — bend 28°, let the bend partially set, re-apply for another 28°, repeat until the trunk cascades past the pot edge — not by simultaneous additive force. Both files have been corrected: the "56°" figure and the additive framing have been removed and replaced with the independent-caps rule, and a cascade-by-stacking note has been added to each. Wire remains a separate tool capped at ±45° and is unaffected by this patch.
