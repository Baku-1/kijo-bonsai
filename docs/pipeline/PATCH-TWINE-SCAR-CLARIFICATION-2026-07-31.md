# Patch: Twine/SCAR Clarification — 2026-07-31

**Author:** Disciplined Implementer pass  
**Date:** 2026-07-31  
**Owner confirmation:** Jeremy Gordon, 2026-07-31 (verbatim: "twine and wire are separate, wire counts as using a different technique than twine and weights. Also twine and weights are for those wishing to not spend money, it allows for manipulation of their tree free of charge but at a slower pace and without SKARS")

---

Two doc files were patched with surgical edits to reflect a Jeremy-confirmed design clarification: (1) `DESIGN-TWINE-VS-WIRE.md` — the self-contradicting line 27 ("twine counts as 'binding' — twine + shears = Bound-and-Cut. A player using ONLY twine (no wire) + shears is Bound-and-Cut, NOT Clip-and-Grow") was replaced with the confirmed rule ("twine does NOT count as wire and does NOT increment wireCount; a player using ONLY twine + shears remains Clip-and-Grow eligible"); the Summary table's Classification column for Twine was updated from "Counts as binding (not wire)" to "Does not increment wireCount — Clip-and-Grow eligible"; and a new implementation rule was added to the Implementers section explicitly stating that SCAR voxels (VoxelRole.SCAR) have exactly two sources — wire overstay past the removal window (unintentional) and jin pliers use (intentional) — and that twine and weights NEVER produce SCAR voxels. (2) `ARCHITECT-CAREACTION-TECHNIQUE-2026-07-30.md` — the DOC INCONSISTENCY block's closing sentence ("Owner should resolve the wording in that doc") was updated to record the owner resolution, and Open Question #5 was marked [RESOLVED 2026-07-31] with the confirmed rules stated inline. No other content in either file was changed.
