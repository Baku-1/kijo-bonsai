# Open-Source Bonsai Resource Audit
**Date:** 2026-07-31  
**Purpose:** Assess open-source repos for usable data, algorithms, or reference material for Kijo's bonsai care physics pipeline.

---

## 1. bonsite/database

**What it is:** A Brazilian student project — a PostgreSQL Docker setup meant to back a bonsai display website for a professor. Archived September 2024, read-only.

**Schema (complete):**
```sql
CREATE TABLE categories (id SERIAL PRIMARY KEY, name VARCHAR(50));
CREATE TABLE bonsais (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  category_id INT REFERENCES categories(id),
  details JSONB
);
```

Categories seeded: `Frutíferas` (fruiting), `Floríferas` (flowering), `Perenes` (evergreen/perennial), `Caducifólias` (deciduous). One bonsai row exists: "Bonsai de Jabuticaba" with JSONB fields `sun_exposure`, `watering`, `size`, `pruning`, `fertilization`, `delicacy`.

**Kijo fit:**
- Categories map loosely to Kijo's species classes (Perenes ≈ Evergreen, Caducifólias ≈ Hardwood) but Tropical has no equivalent, and there's no species-level data at all — just one example row.
- No care log schema, no soil/humidity/temperature fields, no time-based watering intervals, no seasonal modifiers.
- The JSONB `details` blob has the right instinct (flexible per-species attributes) but zero actual data to seed from.

**License:** Apache-2.0 ✓  
**Verdict: IGNORE.** Schema is a stub. Not worth adapting — Kijo's existing species schema already exceeds this in every dimension.

---

## 2. bonsite/bonsite

**What it is:** The TypeScript front-end for the same project — Next.js 14, Drizzle ORM, NeonDB, Tailwind. An e-commerce/display site for selling or showcasing bonsai ("Produtos" = products). 305 commits, last updated Jan 2025.

**Kijo fit:**
- No care guide logic, no species science, no physics. It's a product catalog.
- Stack (Next.js + Drizzle + NeonDB) overlaps with Kijo's tech choices, but the code itself adds nothing Kijo doesn't already have.

**License:** Apache-2.0 ✓  
**Verdict: IGNORE.** Stack reference only, and a shallow one.

---

## 3. Warwlock/MTree

**What it is:** Open-sourced former Unity Asset Store paid tool for procedural tree generation. MIT licensed. Features: inspector-based procedural generation, `MTreeWind.cs` for vertex-displacement wind animation, auto-LOD, Shader Graph materials. Unity 6 compatible.

**Physics relevance:**
- Wind is **vertex displacement only** — a shader-level visual effect, not a structural model. No per-branch torque, no stress accumulation, no wood stiffness.
- No concept of time-based plasticity or permanent bend from sustained load.
- Branch geometry is good quality (cylindrical cross-sections with taper), but generation is aesthetic, not physically driven.

**Language:** C# / Unity package. Not callable from TypeScript. Would require full port.  
**License:** MIT ✓ (commercial OK)  
**Verdict: REFERENCE ONLY.** The vertex-displacement wind approach is worth studying for Kijo's visual branch sway layer (separate from the physics sim). The branch cross-section taper logic may inform mesh generation. No stress/torque model to borrow.

---

## 4. kueblert/ProceduralTree

**What it is:** Academic Unity/C# implementation of two papers:
- Ball-B-splines for branch skeleton representation (Ao et al. 2009)
- Guiding vector trees (Xu & Mould 2015)

Very small (0 stars, 1 fork), accompanies a blog at chaoskiste.de.

**Physics relevance:**
- Ball-B-splines are a mathematically clean representation of a branch as a chain of overlapping spheres — this *could* inform how Kijo models branch skeleton deformation under torque (a bent branch is just a spline with perturbed control points).
- No stress accumulation, no S = τ/D³ model, no plasticity. The splines are for geometry, not physics.

**Language:** C# / Unity. Port required.  
**License:** MIT ✓  
**Verdict: REFERENCE ONLY.** The Ball-B-spline paper (Ao 2009) is worth reading for Kijo's branch bend visualization — it gives a clean geometric framework for "how does a bent branch look?" independent of the physics driving the bend.

---

## 5. paternostrox/AdaptableTrees

**What it is:** Unity/C# graduation thesis tool. Uses space colonization algorithm + multi-resolution 3D voxelization (flood fill) to grow trees around obstacles.

**Physics relevance:**
- Voxelization + flood fill for free-space detection is directly applicable to Kijo's pot constraint problem: growing roots/branches that respect pot boundaries and obstacle geometry.
- Space colonization (attractor-point competition) governs branch direction toward light — this is a growth direction model, not a structural stress model.
- No torque, no S = τ/D³, no plasticity.

**Language:** C# / Unity.  
**License:** GPL-3.0 ⚠️ — copyleft. Using the code in a commercial game requires GPL compliance (open-sourcing the game) unless you treat it as algorithm reference only.  
**Verdict: REFERENCE ONLY (algorithm study).** The space colonization + voxelization combination is the right mental model for Kijo's growth-toward-light + obstacle-avoidance system. Read the code as pseudocode; do not link or copy it into Kijo's codebase.

---

## 6. stb-ebe/SpaceColonizationTree

**What it is:** Could not fetch (URL returned empty). Likely a minimal space colonization implementation.

**Physics relevance:** Space colonization (Runions et al. 2007) is the canonical algorithm for branch network topology — attractors represent light/resource, branches grow toward nearest attractor, attractors get consumed. Well-documented in academic literature; the algorithm itself is unencumbered.

**License:** Unknown (couldn't fetch).  
**Verdict: IGNORE as a source.** Use the original Runions 2007 paper directly, or paternostrox/AdaptableTrees as reference for the algorithm.

---

## 7. abiusx/L3D

**What it is:** C++/OpenGL 3D L-System implementation. Supports `.l`, `.l3d` (standard L-Systems), and `.l++` (extended, with leaves). Turtle graphics model. 40 stars. No license file.

**Physics relevance:**
- The gravity "bend" in L3D is just a `&` (pitch down) command in the L-System string — it's a static structural bias baked into the growth grammar, not a dynamic torque model. Leaves bend toward ground in L++ as a post-process, not via stress accumulation.
- The L-System grammar itself (production rules, recursion depth, stochastic rules) is relevant to Kijo's **branch spawn logic**: L-System rules cleanly encode species-specific branching patterns (branching angle, internode length, bifurcation probability).
- No S = τ/D³, no time-based plasticity.

**Language:** C++/OpenGL — not callable from TypeScript.  
**License:** Not specified — assume all-rights-reserved for code; the L-System algorithm is in the public domain.  
**Verdict: REFERENCE ONLY.** The L-System formalism is the right tool for encoding Kijo's species branching grammars. Don't use the C++ code; use the grammar file format as inspiration for Kijo's species definition files. The `.l++` gravity leaf behavior is algorithmically trivial (pitch modifier) and easily reimplemented.

---

## 8. scallyw4g/bonsai

**What it is:** A 1.2k-star C/C++ **general-purpose voxel engine** — GPU terrain generation, deferred shading, SSAO, SDF editing, async job system. Named "bonsai" coincidentally. Nothing to do with bonsai trees or horticulture. License: WTFPL (maximally permissive).

**Kijo fit:** Zero.  
**Verdict: IGNORE.** Name collision only.

---

## 9. andreasbross/ProTree

**What it is:** GitHub user `andreasbross` and their `ProTree` repo returned empty pages — the account either doesn't exist publicly or the repo has been deleted/made private.

**Verdict: IGNORE (unreachable).**

---

## 10. Go Bonsai — Frank Force (killedbyapixel.com)

**What it is:** A 2008 Windows DirectX 9 exe — a 3D bonsai growth simulator. Proprietary, **no source code released**. Features: realistic 3D tree growth sim, seasonal growth cycle, leaves and branches affected by gravity and wind, **complex lighting model with self-shadowing that affects growth**, Japanese Maple growth pattern simulation.

The self-shadowing → growth effect is conceptually the most sophisticated thing here: branches in shadow grow differently from those in full light. Frank has mentioned wanting to "reboot it in a new engine" but nothing has shipped as of this writing. The project is dormant.

**Physics relevance:**
- **Self-shadow → growth rate feedback** is directly relevant to Kijo's phototropism model. Branches in the interior of a dense tree should elongate faster (reaching for light) and weaken structurally. This is a growth *direction and rate* modifier, not structural stress.
- Gravity + wind on branches is described but implementation is unknown (closed source).
- No stress/torque physics confirmable.

**License:** Proprietary / closed source — no code to use.  
**Verdict: REFERENCE ONLY.** The design document (frankforce.com page + comments) is worth one careful read for Kijo's phototropism and seasonal growth design. The gameplay tips ("cut every few years for good trunk taper", "trim strong leaders in summer") are essentially bonsai horticulture encoded as game mechanics and map directly to Kijo's care action design.

---

## Summary Table

| Resource | Type | License | Kijo Value | Verdict |
|---|---|---|---|---|
| bonsite/database | SQL schema | Apache-2.0 | None — empty stub | IGNORE |
| bonsite/bonsite | TS web app | Apache-2.0 | None — product catalog | IGNORE |
| Warwlock/MTree | Unity C# | MIT | Visual wind vertex displacement | REFERENCE ONLY |
| kueblert/ProceduralTree | Unity C# | MIT | Ball-B-spline skeleton geometry | REFERENCE ONLY |
| paternostrox/AdaptableTrees | Unity C# | **GPL-3.0** | Space colonization + voxel obstacle detection | REFERENCE ONLY |
| stb-ebe/SpaceColonizationTree | Unknown | Unknown | Unreachable | IGNORE |
| abiusx/L3D | C++/OpenGL | None | L-System grammar design | REFERENCE ONLY |
| scallyw4g/bonsai | C/C++ | WTFPL | None — wrong domain | IGNORE |
| andreasbross/ProTree | Unknown | Unknown | Unreachable | IGNORE |
| Go Bonsai (Frank Force) | Win32 exe | Proprietary | Phototropism + seasonal design reference | REFERENCE ONLY |

---

## Actionable Takeaways for Kijo

**On species data:** No open-source database is worth seeding from. bonsite has one row. Build Kijo's species table from primary horticultural sources (Bonsai Empire species index, ABS care sheets).

**On growth direction (phototropism + space colonization):** Study paternostrox/AdaptableTrees for the voxel+flood-fill obstacle approach and the space colonization attractor model. Port the algorithm in TypeScript from scratch — do not copy GPL code. The Runions 2007 paper ("Colonization Algorithms for Space-Filling Curves") is the primary source.

**On branch geometry/skeleton:** kueblert/ProceduralTree's Ball-B-spline approach (Ao 2009 paper) is the cleanest representation for bent branch visualization. When Kijo bends a branch from accumulated stress, the resulting shape should be a spline with displaced control points, not a rigid rotation.

**On growth grammar (branching rules):** L-System formalism (abiusx/L3D) is the right abstraction for encoding species-specific branching patterns. Design Kijo's species files as parameterized L-System-like grammars: branching angle, internode length, bifurcation probability, apical dominance strength.

**On visual sway (not structural physics):** MTree's vertex displacement wind (MTreeWind.cs) is worth reading for Kijo's cosmetic wind layer. This is separate from the S = τ/D³ structural model — visual sway on top of the physics-resolved rest pose.

**On structural stress physics (S = τ/D³, plasticity):** None of the surveyed repos implement anything like this. This is Kijo's original contribution. No open-source reference exists to borrow from — design from first principles.

**On seasonal growth + phototropism design:** Frank Force's Go Bonsai design (comments + gameplay tips at frankforce.com/?page_id=1030) encodes bonsai horticulture as game mechanics. Read the gameplay tips section as a design spec — particularly trunk taper via periodic cutback, differential summer/winter pruning, and weak-branch protection.
