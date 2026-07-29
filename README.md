# Kijo — Monorepo

Dual-loop bonsai/combat game. See `docs/` for the GDD. Build order: bonsai first, combat second.

## Layout
- `packages/shared` — types shared by all packages (TreeState, CareAction, species)
- `packages/engine` — deterministic growth engine: `seed + species + care_log → tree`. Pure, no deps. Phase 0 core.
- `packages/voxelizer` — parametric tree → 256³ sparse voxels (Built, V1-V9 all pass)
- `apps/web` — Vite + React client, care-loop renderer + wallet connect + seed purchase
- `apps/server` — Supabase Edge Functions: seed-claim + wallet-auth deployed; care-log service stub
- `contracts/` — Kijonsai ERC-721, Ronin (Saigon testnet: 0x4447F631F5868bFA03A6e6ae2D2da9f22c787E44)

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
