# Growth V3 Dispatch Preflight

Date: 2026-09-25
Scope: Kijo Growth V3 continuous growth, care replay, pruning, display sync, and verification
Workspace: `C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai`

## Access evidence

- Current working directory resolved to the Kijo workspace.
- Git roots confirmed for both the outer Kijo repository and nested `kijo-bonsai` repository.
- Non-mutating write-handle checks succeeded for the canonical V3 specification and `kijo-bonsai/DECISIONS.md` (`WRITE_OPEN_OK`).
- Both repositories contain pre-existing user changes. They are authoritative work in progress and must be preserved. No reset, checkout, commit, push, deploy, or deletion is authorized.

## Required procedure and tooling caveats

- Controlling dispatch procedure: `C:\Users\jerem\.claude\CLAUDE.md`, section 3.
- The named `dispatch-preflight` skill is not installed. Read-only discovery was exhausted; this file is the manual execution record for that procedure.
- No registered `carmack-linus-review` skill is available. That stage will use a fresh reviewer following the repository's engineering-craft standard and an explicit Carmack/Linus review rubric; it must not be represented as a skill invocation.
- A dedicated task-tracker creation tool described in the user-level procedure is not exposed in this environment. Pipeline identities, status, artifacts, and findings will instead be recorded in `docs/pipeline` and reported to the owner.
- Role agents must use fresh contexts and must not self-review. Blocking findings return to the author or implementer, followed by a fresh review pass.

## Exact local sources loaded

Repository and session instructions:

- `C:\Users\jerem\.claude\CLAUDE.md`
- `C:\Users\jerem\.gemini\antigravity\playground\kijo\CLAUDE.md`
- `C:\Users\jerem\.gemini\antigravity\playground\kijo\.summerrules`
- `C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\SESSION-START.md`

Current state and controlling decisions:

- `C:\Users\jerem\.gemini\antigravity\playground\kijo\docs\DECISIONS.md`
- `C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\DECISIONS.md`
- `C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\STATE.md`
- `C:\Users\jerem\.gemini\antigravity\playground\kijo\docs\GDD.md`
- `C:\Users\jerem\.gemini\antigravity\playground\kijo\docs\KIJO-PRD.md`

Architecture and component contracts:

- `C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\docs\pipeline\ARCH-GROWTH-V3-CONTINUOUS-DISPLAY-2026-09-24.md`
- `C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\docs\KIJO-ARCHITECTURE.md`
- `C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\docs\KIJO-TECH-SPEC.md`
- `C:\Users\jerem\.gemini\antigravity\playground\kijo\kijo-bonsai\docs\KIJO-ENGINE-API.md`
- package READMEs for `packages/shared`, `packages/engine`, and `packages/voxelizer`
- root package scripts and complete source/test inventories for the nested repository

Relevant implementation inspected:

- `packages/engine/src/GrowthEngine.ts`
- `packages/shared/src/index.ts`
- engine and voxelizer public exports
- voxelizer branch filling, role assignment, and canopy generation paths
- server paths for care actions, tree retrieval, public tree retrieval, and stat derivation
- web paths for `ThreeCanvas.tsx`, `main3d.ts`, and tree-mesh generation
- existing `_shared/care-plan.mjs` and `test-care-plan.mjs` were inventoried as untracked user work and must be evaluated before reuse

Role instructions loaded:

- `verified-architect/SKILL.md`
- `engineering-craft-standard/SKILL.md` and `references/directives.md`
- architect hook prompt
- later-stage skills already located for disciplined implementation, adversarial audit, playtesting, and verification-before-completion

## External and knowledge sources checked

Primary sources, deliberately bounded to unresolved platform behavior:

- Supabase Realtime database changes: https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
  - Broadcast is the recommended scalable/security-oriented path; Postgres Changes is simpler but less scalable. Private channels require authorization design.
- Supabase Edge Functions database connections: https://supabase.com/docs/guides/functions/connect-to-postgres
  - The server design may use `supabase-js` or a direct Postgres client; atomicity and transaction placement must be made explicit in the architecture.
- MDN `visibilitychange`: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
  - Browser display resynchronization can be keyed to document visibility state changes.
- W3C WebXR Device API: https://www.w3.org/TR/webxr/
  - XR sessions expose visibility state changes; hidden sessions stop animation callbacks and blurred sessions may be throttled.

Second Brain was queried through its MCP interface. The live wiki page `wiki/decisions/kijo-v3-continuous-growth-display.md` is older than the repository decision record, while semantic search contains fragments of newer material. Repository `DECISIONS.md` and the approved V3 specification control until the wiki is reconciled after implementation outcomes are known.

## Current code evidence that constrains the design

- `CareLogEntry` currently records only `{ day, action }`; it cannot represent an authoritative within-day timestamp, deterministic order, revision, or replacement-plan identity.
- `GrowthEngine.growTick` currently grows branch-local extension and iterates newly forked children during the same day. It does not conserve one immutable day-start tree budget.
- Thickening, forks, canopy, seed/support growth, and extension are not yet charged against one explicit physical-unit ledger.
- The voxelizer includes the tube endpoint at `t = 1`; the current non-jin threshold is also `1.0`, so an ordinary branch can receive a SCAR endpoint despite comments claiming that state is unreachable.
- A parent with no living, non-pruned children can currently receive canopy immediately, so pruning the last child may synthesize foliage unless the new contract prevents it.
- The public-viewer path named in stale state documentation is absent from the current source inventory. Display architecture must be based on the actual tree retrieval and web entry points, not that stale claim.
- Existing technical/API documents contain older growth and prune assumptions. Latest V3 decisions and observed source behavior supersede those stale sections.

## Controlling decisions

1. A game day is eight real hours. Presentation has two four-hour intervals, but age, Wisdom, morale, ingredients, and tool timers advance exactly once per game day.
2. Each day starts with one conserved tree-wide physical growth budget derived from immutable day-start topology. Eligible recipients compete concurrently by deterministic weights and deterministic remainder rules. Newborn structures are ineligible until the next day.
3. Every geometric result must be charged in explicit units, including extension, thickness, forks, canopy, seeds, and support growth. No free geometry may appear behind an abstract conservation claim.
4. Mid-interval care first materializes the tree to the authoritative timestamp, then persists deterministic ordering/revision information and replaces only affected future plan events. Unaffected events do not reroll.
5. Online, offline, reconnect, snapshot, and genesis replay must converge under fixed-point or `round4` boundaries.
6. Pruning removes already-materialized voxels, cancels affected future events, never resurrects removed IDs, and gives no same-day budget refund. Overlapping geometry survives when still owned by live structure. Cancelled future allocation and lost live material are distinct receipt quantities.
7. Jin Defense comes only from current live SCAR voxels. Pruning a jinned subtree removes that Defense. An ordinary prune creates a render-only `PRUNE_SCAR` material at the cut; it does not change the branch role to SCAR and grants no Defense. Historical technique provenance is separate from current live stats.
8. Canopies are species-specific. Evergreen and juniper silhouettes are flat and fan-like, not radius-two spheres. Seasons alter presentation only; canonical canopy geometry, Ki, and combat stats do not change.
9. Tree voxels are authoritative combat morphology and stats: intertwined branch bodies, density from actual branches, canopy crown at the head, and no age-only fake mass.
10. Caretaker, public NFT `animation_url`, Looking Glass, and WebXR displays must converge on the same authoritative tree state and sync envelope.
11. Twine and weights remain distinct from wire. Unrelated game behavior must not change.
12. Existing testnet trees may be rebaselined through an accepted version/migration policy, but live data deletion is not authorized.
13. Lore remains Yama-no-Kami divine seeds, shinboku, and an unnamed fictional Decorative Tree Guild/Flower Guild seller. Tanaka and Gu Ahao are excluded.
14. Skill-point budget originates from terrain and is not automatically reduced merely because a depth-two prune removes move slots. ARM/LEG re-sorting and all other stat effects require an explicit stable-role contract rather than an assumption that every stat falls after every prune.

## Architecture questions that must be resolved

1. What is the exact physical unit and fixed-point scale for the daily ledger, and how does each geometric operation debit it without rounding leakage?
2. What authoritative timestamp, event-order, revision, idempotency, and retry schema replaces the current day-only care log?
3. How are immutable plan/event identities generated, and how does a care action splice only affected future events while retaining unaffected identities and values?
4. What prune receipt distinguishes materialized loss, overlapping surviving material, cancelled future allocation, stump presentation, and zero same-day refund?
5. Which roles are stable identities versus derived classifications after topology changes, and how do move slots, terrain-derived skill points, ARM/LEG ordering, Ki, and Defense respond?
6. What is the canonical species canopy grammar, its budget charge, its age/health behavior, and the exact presentation-only season overlay?
7. Where are transactions, optimistic concurrency checks, revision increments, idempotency keys, schema versions, and testnet rebaseline boundaries enforced?
8. What shared display envelope and resync protocol serve caretaker, public NFT, Looking Glass, and WebXR clients across foreground, background, reconnect, and offline catch-up?
9. Which existing trees are compatible, migrated, rebaselined, or rejected, and how is that policy observable without deleting data?
10. What package boundaries, file changes, fixtures, adversarial tests, baseline updates, demo path, and hardware-specific verification labels prove the complete contract?

## Dispatch classification

- Current stage: ARCHITECT.
- Current role: independent systems architect.
- Required role skill: `verified-architect`, supplemented by the engineering-craft standard.
- Forbidden at this stage: production implementation, broad refactors, fixture rerecording, commits, deployment, or approval claims.

## Architect done-when

The Architect must write:

`docs/pipeline/ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md`

It is done only when that artifact:

- resolves every architecture question above with unambiguous invariants and examples;
- maps every owner requirement to concrete packages, files, schemas, functions, migrations, tests, and verification evidence;
- specifies exact fixed-point units, conservation equations, remainder ordering, event IDs, revision semantics, transaction boundaries, retry behavior, prune receipts, stat behavior, and display envelopes;
- includes a migration/rebaseline policy that preserves data and identifies intentionally disposable testnet baselines;
- separates canonical state, derived combat state, historical provenance, and presentation-only state;
- defines red tests for every observed defect or ambiguity before implementation;
- defines observable acceptance criteria for healthy, neglected, species/age variation, interval edges, mid-care, offline/online equivalence, pruning overlap, Jin/prune/season stats, malformed/non-finite input, concurrency/retries, and all viewer modes;
- names runnable validation commands and a gameplay demo using simulated server time, reload, and care actions;
- labels hardware-only Looking Glass/WebXR claims as unverified unless actually observed on that hardware;
- lists no unresolved question that can be answered from the inspected repository or cited primary sources;
- makes no production-code changes.

