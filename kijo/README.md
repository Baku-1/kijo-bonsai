# Kijo — Monorepo

Dual-loop bonsai/combat game. See `docs/` for the GDD. Build order: bonsai first, combat second.

## Layout
- `packages/shared` — types shared by all packages (TreeState, CareAction, species)
- `packages/engine` — deterministic growth engine: `seed + species + care_log → tree`. Pure, no deps. Phase 0 core.
- `packages/voxelizer` — parametric tree → 256³ sparse voxels (Phase 0 PoC, stub)
- `apps/web` — Vite client, 2D canvas care-loop renderer
- `apps/server` — game server stub (Phase 1: day ticks, care-log authority)
- `contracts/` — smart contracts (Phase 1+, chain TBD)

## Commands
```
npm install
npm run build      # builds shared → engine → voxelizer → server (order matters)
npm test           # engine determinism suite
npm run typecheck  # all workspaces
npm run dev        # web client (run build first so @kijo/engine dist exists)
```

## Invariant
The engine must be bit-for-bit deterministic: same seed + species + care log ⇒ identical tree. Guarded by `packages/engine/test/`. Never introduce `Math.random`, `Date.now`, or iteration over unordered collections inside the engine.
