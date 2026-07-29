# KIJO — Guest Mode & localStorage Persistence: Architect Plan

**Version:** 0.1  
**Date:** 2026-07-22  
**Status:** Ready for implementation  
**PRD refs:** §3.2, §4.1, §4.5  

---

## 0. Pre-read: Existing-code inventory

| File | What it does now | What changes |
|---|---|---|
| `useWallet.ts` | Derives `mode: WalletMode` from `isConnected`. Already types `'guest' \| 'connected'`. | None. Already correct. Add `WalletContext` export so components don't re-import the hook. |
| `App.tsx` | Renders ThreeCanvas + WalletBar + SeedShopModal with no mode routing. | Mode fork added here; guest/wallet tree context threaded down. |
| `care_bridge.ts` | Holds a `BonsaiTree` ref, dispatches water/nextDay/etc., calls `afterAction()` back to the renderer. | A `GuestCareBridge` wrapper adds localStorage flush after each action. `CareBridge` itself is untouched. |
| `SeedShopModal.tsx` | Modal pattern to follow: DOM-listener open, inline tx state machine, CSS vars. | No change. Pattern used for `GuestWarningBanner` and `FeatureGatePrompt`. |
| `@kijo/engine: CareLogReplay` | `reconstruct(seed, species, careLog, totalDays) → BonsaiTree` — the replay backbone. | Used as-is in `useGuestTree`. |
| `@kijo/shared: CareAction / CareLogEntry` | Typed action union, log entry struct. | `GuestTreeState.careLog` is `CareLogEntry[]`, same type — no divergence. |

---

## 1. Pre-existing conflicts to resolve before implementation

### C-1: `WATER_AMOUNT` mismatch -- ✅ RESOLVED (2026-07-26)
`WATER_AMOUNT = 28` is now exported from `packages/shared/src/index.ts`. Both `packages/engine/src/CareLogReplay.ts` and `apps/web/src/bridge/care_bridge.ts` import it instead of hardcoding. Guest localStorage care logs are now reproducible. This was a prerequisite for guest mode implementation -- it is now clear to proceed.

### C-2: `App.tsx` owns no tree
`ThreeCanvas` creates its own tree internally (wired through `main3d.ts` / `main2d.ts`). There is no React context carrying the active `BonsaiTree`. Guest mode requires `App.tsx` to be the tree owner: it creates the tree from `useGuestTree`, supplies it to the canvas renderer and the HUD, and also gives it to `GuestCareBridge`. **Fix:** introduce `TreeContext` (see §3). This is the most invasive structural change.

### C-3: `CareBridge.AUTO_INTERVAL_MS` is a simulation timer, not a real-time clock
The 2200ms auto-timer ticks game days for rapid visual testing, not for production. Real-time guest mode derives `currentDay` from the wall clock (`Date.now() - bornAt`). Auto mode stays available as a dev/debug escape hatch. No change to `CareBridge`; the distinction just needs to be documented so the implementer doesn't confuse the two systems.

### C-4: `CareLogReplay` is synchronous and O(days)
For a guest tree at day 200 this is 200 `growTick()` calls synchronously on the main thread. Profile threshold is approximately day 300+ (< 100ms on mid-range mobile for 300 ticks based on current engine benchmarks). **Mitigation:** cache the reconstructed `BonsaiTree` in a `useRef` inside `useGuestTree`, only re-run replay when `careLog.length` changes (new action added). Never re-replay on every render or every clock tick.

---

## 2. Guest state schema (section A)

```typescript
// apps/web/src/guest/guestTreeSchema.ts

import type { SpeciesClass, CareLogEntry } from '@kijo/shared';

export const GUEST_STORAGE_KEY = 'kijo_guest_tree';
export const TUTORIAL_DAYS = 7;
export const TUTORIAL_REAL_SECONDS_PER_DAY = 2 * 3600;  // 2 real hours
export const NORMAL_REAL_SECONDS_PER_DAY   = 8 * 3600;  // 8 real hours

export interface GuestTreeState {
  seed: number;           // deterministic growth seed (uint32)
  species: SpeciesClass;  // 'hardwood' | 'evergreen' | 'tropical'
  bornAt: string;         // ISO 8601 — wall-clock moment the seed was planted
  careLog: CareLogEntry[];
  tutorialDay: number;    // 0-7; how many tutorial days the player has completed
  tutorialDone: boolean;  // true once tutorialDay >= TUTORIAL_DAYS
  tutorialShearUsed: boolean; // free shear has been consumed
  // freeShearAvailable is NOT stored — computed as: currentDay >= 5 && !tutorialShearUsed
  // PRD §3.2 "Your first cut (Days 6–7)": 0-indexed day 5 = PRD Day 6.
  // Shear unlocks DURING the tutorial, not after it completes.
}

export function createFreshGuestState(species: SpeciesClass, seed?: number): GuestTreeState {
  return {
    seed: seed ?? (Math.random() * 0xFFFFFFFF) >>> 0,
    species,
    bornAt: new Date().toISOString(),
    careLog: [],
    tutorialDay: 0,
    tutorialDone: false,
    tutorialShearUsed: false,
  };
}

/** Load from localStorage, or return null if nothing is saved. */
export function loadGuestState(): GuestTreeState | null {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestTreeState;
  } catch {
    return null;
  }
}

/** Persist the full state. Called after every mutation. */
export function saveGuestState(state: GuestTreeState): void {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state));
}
```

**Invariants:**
- `seed` is set once at creation, never mutated.
- `bornAt` is set once at creation, never mutated.
- `careLog` is append-only; actions are never removed or reordered.
- `tutorialDone` transitions from `false → true` exactly once (when computed `currentDay >= 7`).
- `freeShearAvailable` is **not stored**. It is computed: `currentDay >= 5 && !tutorialShearUsed`. PRD §3.2 "Your first cut (Days 6–7)" maps to 0-indexed day 5 — the shear is available during the tutorial's final window, not after the tutorial ends. `tutorialShearUsed` is the only persisted field; it flips `false → true` on first use and never resets.

---

## 3. Tutorial day-computation (section D)

This is a pure function — no side effects, fully testable.

```typescript
// apps/web/src/guest/computeCurrentDay.ts

import {
  TUTORIAL_DAYS,
  TUTORIAL_REAL_SECONDS_PER_DAY,
  NORMAL_REAL_SECONDS_PER_DAY,
} from './guestTreeSchema.js';

export interface DayComputation {
  currentDay: number;
  tutorialDay: number;   // capped at TUTORIAL_DAYS
  tutorialDone: boolean;
  secondsUntilNextDay: number; // for UI countdown
}

export function computeCurrentDay(bornAtIso: string, nowMs?: number): DayComputation {
  const born = new Date(bornAtIso).getTime();
  const now  = nowMs ?? Date.now();
  const elapsedSeconds = Math.max(0, (now - born) / 1000);

  const tutorialTotalSeconds = TUTORIAL_DAYS * TUTORIAL_REAL_SECONDS_PER_DAY;

  let currentDay: number;
  let secondsUntilNextDay: number;

  if (elapsedSeconds < tutorialTotalSeconds) {
    // Still in tutorial: each game day = TUTORIAL_REAL_SECONDS_PER_DAY
    currentDay = Math.floor(elapsedSeconds / TUTORIAL_REAL_SECONDS_PER_DAY);
    const secondsIntoCurrentDay = elapsedSeconds % TUTORIAL_REAL_SECONDS_PER_DAY;
    secondsUntilNextDay = TUTORIAL_REAL_SECONDS_PER_DAY - secondsIntoCurrentDay;
  } else {
    // Post-tutorial: each game day = NORMAL_REAL_SECONDS_PER_DAY
    const postTutorialSeconds = elapsedSeconds - tutorialTotalSeconds;
    const postTutorialDays = Math.floor(postTutorialSeconds / NORMAL_REAL_SECONDS_PER_DAY);
    currentDay = TUTORIAL_DAYS + postTutorialDays;
    const secondsIntoCurrentDay = postTutorialSeconds % NORMAL_REAL_SECONDS_PER_DAY;
    secondsUntilNextDay = NORMAL_REAL_SECONDS_PER_DAY - secondsIntoCurrentDay;
  }

  const tutorialDay  = Math.min(currentDay, TUTORIAL_DAYS);
  const tutorialDone = currentDay >= TUTORIAL_DAYS;

  return { currentDay, tutorialDay, tutorialDone, secondsUntilNextDay };
}
```

**Note on re-ticking:** `computeCurrentDay` does NOT mutate the `BonsaiTree`. The tree is reconstructed up to `currentDay` via `CareLogReplay.reconstruct(seed, species, careLog, currentDay)`. The hook refreshes `currentDay` on a 60-second interval; when the value increases, it triggers a re-reconstruct (see §4).

---

## 4. `useGuestTree` hook (section B)

```typescript
// apps/web/src/guest/useGuestTree.ts

import { useState, useEffect, useMemo, useCallback } from 'react';
import { CareLogReplay } from '@kijo/engine';      // static import — no dynamic await
import type { BonsaiTree } from '@kijo/engine';
import type { CareLogEntry, SpeciesClass } from '@kijo/shared';
import {
  GuestTreeState,
  loadGuestState,
  saveGuestState,
  createFreshGuestState,
} from './guestTreeSchema.js';
import { computeCurrentDay } from './computeCurrentDay.js';

export interface UseGuestTreeResult {
  // State
  guestState: GuestTreeState;
  currentDay: number;
  tutorialDone: boolean;
  freeShearAvailable: boolean;  // computed: currentDay >= 5 && !tutorialShearUsed
  secondsUntilNextDay: number;

  // Reconstructed tree — synchronous useMemo, non-null whenever guestState is loaded
  tree: BonsaiTree | null;

  // Actions
  addCareAction: (entry: CareLogEntry) => void;
  useShear: () => boolean;  // returns true if shear was consumed, false if unavailable
  resetGuestTree: (species: SpeciesClass) => void;
}

export function useGuestTree({ enabled = true }: { enabled?: boolean } = {}): UseGuestTreeResult {
  // When disabled (wallet connected), skip all localStorage reads and timers.

  // ── State ───────────────────────────────────────────────────────────────
  const [guestState, setGuestState] = useState<GuestTreeState>(() => {
    if (!enabled) return createFreshGuestState('hardwood');
    return loadGuestState() ?? createFreshGuestState('hardwood');
    // Default species = hardwood; species picker modal overrides via resetGuestTree
  });

  const [currentDay, setCurrentDay] = useState(0);
  const [tutorialDone, setTutorialDone] = useState(false);
  const [secondsUntilNextDay, setSecondsUntilNextDay] = useState(0);

  // ── Tree reconstruction (synchronous useMemo — no null window) ───────────
  // CareLogReplay.reconstruct is synchronous and O(currentDay).
  // useMemo recalculates only when careLog.length or currentDay changes — never
  // on every render. React child effects fire before parent effects, so using
  // useMemo here (not useEffect) guarantees tree is non-null before the first
  // render that needs it.
  const tree = useMemo<BonsaiTree | null>(() => {
    if (!enabled) return null;
    return CareLogReplay.reconstruct(
      guestState.seed,
      guestState.species,
      guestState.careLog,
      currentDay,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, guestState.careLog.length, guestState.seed, guestState.species, currentDay]);

  // ── Computed: free shear availability ────────────────────────────────────
  // PRD §3.2 "Your first cut (Days 6–7)": 0-indexed day 5 = PRD Day 6.
  // The shear is available DURING the tutorial's final window, not after.
  const freeShearAvailable = currentDay >= 5 && !guestState.tutorialShearUsed;

  // ── Day ticker ───────────────────────────────────────────────────────────
  // Recomputes currentDay from wall clock every 60s.
  // When currentDay advances, useMemo re-runs the reconstruction automatically.
  useEffect(() => {
    if (!enabled) return;

    function tick() {
      const { currentDay: newDay, tutorialDay, tutorialDone: done, secondsUntilNextDay: s } =
        computeCurrentDay(guestState.bornAt);

      setCurrentDay(newDay);
      setTutorialDone(done);
      setSecondsUntilNextDay(s);

      // Persist tutorialDay and tutorialDone (idempotent — no freeShearAvailable to write)
      setGuestState(prev => {
        if (prev.tutorialDay === tutorialDay && prev.tutorialDone === done) return prev;
        const next = { ...prev, tutorialDay, tutorialDone: done };
        saveGuestState(next);
        return next;
      });
    }

    tick(); // run immediately on mount / bornAt change
    const id = setInterval(tick, 60_000); // re-check every 60s
    return () => clearInterval(id);
  }, [enabled, guestState.bornAt]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const addCareAction = useCallback((entry: CareLogEntry) => {
    setGuestState(prev => {
      const next = { ...prev, careLog: [...prev.careLog, entry] };
      saveGuestState(next);
      return next;
    });
  }, []);

  const useShear = useCallback((): boolean => {
    if (!freeShearAvailable) return false;
    setGuestState(prev => {
      const next = { ...prev, tutorialShearUsed: true };
      saveGuestState(next);
      return next;
    });
    return true;
  }, [freeShearAvailable]);

  const resetGuestTree = useCallback((species: SpeciesClass) => {
    const fresh = createFreshGuestState(species);
    saveGuestState(fresh);
    setGuestState(fresh);
    setCurrentDay(0);
  }, []);

  return {
    guestState,
    currentDay,
    tutorialDone,
    freeShearAvailable,
    secondsUntilNextDay,
    tree,
    addCareAction,
    useShear,
    resetGuestTree,
  };
}
```

**Key decisions:**
- Tree reconstruction uses `useMemo` (synchronous), not `useEffect`. This eliminates the null-on-first-render window: React child component effects fire before parent effects, but `useMemo` runs during render — so `tree` is non-null when the first child effect runs. No `treeRef`/`treeVersion` pattern needed.
- `CareLogReplay` is imported statically at the top of the file. There is no `await import(...)` inside a hook — that pattern is invalid (hooks can't be `async`) and was a plan defect. The static import is valid because `@kijo/engine` is a first-party package, not a lazy-loaded chunk.
- `freeShearAvailable` is computed from `currentDay` and `tutorialShearUsed` — never stored. The day-ticker no longer needs to write `freeShearAvailable` to localStorage.
- `saveGuestState` is called synchronously inside every setter — no async batching risk.
- `resetGuestTree` wipes localStorage and reconstructs from scratch. Used when guest picks a species.
- The `enabled` param (default `true`) lets `App.tsx` skip all localStorage reads, interval timers, and memo reconstruction when a wallet is connected.

---

## 5. `GuestCareBridge` (extends section B / resolves C-2 + C-3)

The existing `CareBridge` is untouched. `GuestCareBridge` wraps it, adding localStorage persistence after each care action.

```typescript
// apps/web/src/guest/GuestCareBridge.ts

import { CareBridge } from '../bridge/care_bridge.js';
import type { BonsaiTree } from '@kijo/engine';
import type { CareLogEntry } from '@kijo/shared';

type AddCareActionFn = (entry: CareLogEntry) => void;

export class GuestCareBridge extends CareBridge {
  private addCareAction: AddCareActionFn;
  private getDay: () => number;

  constructor(
    tree: BonsaiTree,
    afterAction: () => void,
    addCareAction: AddCareActionFn,
    getDay: () => number,
  ) {
    super(tree, afterAction);
    this.addCareAction = addCareAction;
    this.getDay = getDay;
  }

  override water(): void {
    super.water();
    this.addCareAction({ day: this.getDay(), action: { type: 'water' } });
  }

  override rotate(): void {
    // super.rotate() must be called FIRST — it calls this.tree.rotate() which
    // updates the live visual (marks the tree dirty, triggers refreshView).
    // addCareAction is called AFTER so it captures the post-rotate state.
    //
    // PREREQUISITE: CareBridge.rotate() must be added in the C-3 fix task
    // (separate from guest-mode work):
    //
    //   // In care_bridge.ts — add this method:
    //   rotate(): void {
    //     this.tree.rotate();    // engine applies rotation, sets dirty flag
    //     this.afterAction();    // triggers refreshView → rebuilds mesh
    //   }
    //
    super.rotate();
    this.addCareAction({
      day: this.getDay(),
      action: { type: 'rotate', data: { degrees: (this.tree as any).rotation } },
    });
  }

  // nextDay() is NOT persisted via the bridge in real-time mode.
  // Day advancement is derived from the wall clock in useGuestTree.
  // nextDay() may still be called by the auto-timer for dev/debug.
}
```

**Note:** `CareBridge.water()` already calls `this.tree.water()` which appends to `BonsaiTree`'s internal careLog. In guest mode this internal log is ephemeral (the tree is reconstructed on load). The durable log is `GuestTreeState.careLog` in localStorage. `GuestCareBridge.addCareAction` writes to both. The two sources are consistent as long as the bridge is wired correctly.

---

## 6. `TreeContext` (resolves conflict C-2)

```typescript
// apps/web/src/context/TreeContext.tsx

import React, { createContext, useContext } from 'react';
import type { BonsaiTree } from '@kijo/engine';

interface TreeContextValue {
  tree: BonsaiTree | null;
  currentDay: number;
  /** Call after any external mutation so consumers re-render */
  notifyTreeChanged: () => void;
}

export const TreeContext = createContext<TreeContextValue>({
  tree: null,
  currentDay: 0,
  notifyTreeChanged: () => {},
});

export function useTree() { return useContext(TreeContext); }
```

`App.tsx` is the only provider. `ThreeCanvas`, `WalletBar`, and HUD components consume it.

---

## 7. Mode routing in `App.tsx` (section C)

```typescript
// apps/web/src/App.tsx  (revised)

import React, { useState, useCallback } from 'react';
import { ThreeCanvas }        from './components/ThreeCanvas.js';
import { WalletBar }          from './components/WalletBar.js';
import { SeedShopModal }      from './components/SeedShopModal.js';
import { GuestWarningBanner } from './guest/GuestWarningBanner.js';
import { useWallet }          from './wallet/useWallet.js';
import { useGuestTree }       from './guest/useGuestTree.js';
import { TreeContext }         from './context/TreeContext.js';

export function App() {
  const { isConnected } = useWallet();

  // Only run guest hook when not connected — skips localStorage reads,
  // interval timers, and CareLogReplay reconstruction when unnecessary.
  const guest = useGuestTree({ enabled: !isConnected });

  const [treeVersion, setTreeVersion] = useState(0);
  const notifyTreeChanged = useCallback(() => setTreeVersion(v => v + 1), []);

  // Wallet mode: tree comes from Supabase-backed flow (existing, not yet implemented)
  // Guest mode: tree comes from useGuestTree / localStorage
  const activeTree = isConnected
    ? null  // TODO: walletTree from Supabase hook (Phase 1 wallet impl)
    : guest.tree;

  const currentDay = isConnected
    ? 0     // TODO: walletTree.getAge()
    : guest.currentDay;

  return (
    <TreeContext.Provider value={{ tree: activeTree, currentDay, notifyTreeChanged }}>
      {/* Guest warning banner — shown only in guest mode */}
      {!isConnected && <GuestWarningBanner />}

      {/* ThreeCanvas only renders once tree is non-null.
          In guest mode, useMemo guarantees tree is non-null on the first
          render (synchronous reconstruction), so this guard is a safety
          net, not a flicker risk. */}
      {activeTree && <ThreeCanvas />}

      {/* WalletBar portals into #hud-top */}
      <WalletBar />

      {/* Seed purchase modal — wallet mode only */}
      {isConnected && <SeedShopModal />}

      {/* Navigation links */}
      <nav id="page-links">
        <a href="/index3d.html">voxel view</a>
        <a href="/index2d.html">2d debug</a>
      </nav>
    </TreeContext.Provider>
  );
}
```

**Wallet → guest transition (§4.1 "no conversion" rule):**

```typescript
// In App.tsx, detect isConnected flipping true and show toast
const prevConnected = useRef(false);
useEffect(() => {
  if (isConnected && !prevConnected.current) {
    showToast(
      'Welcome! Your guest tree is saved locally. ' +
      'Plant an imbued seed to start your real journey.'
    );
    // DO NOT wipe localStorage — guest tree stays for reference
  }
  prevConnected.current = isConnected;
}, [isConnected]);
```

---

## 8. `GuestWarningBanner` component (section E)

Pattern: follows `SeedShopModal.tsx` — inline styles using CSS vars, dismissible state.

```typescript
// apps/web/src/guest/GuestWarningBanner.tsx

import React, { useState } from 'react';
import { useWallet } from '../wallet/useWallet.js';

export function GuestWarningBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { connectWallet } = useWallet();

  if (dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: 'var(--panel)', borderBottom: '1px solid var(--edge)',
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        gap: 12, zIndex: 200, fontSize: 13,
      }}
    >
      <span style={{ flex: 1 }}>
        🌱 <strong>Spirit-less seed.</strong> Your tree will grow but cannot be minted,
        traded, or awakened. Connect a wallet to plant a real seed.
      </span>
      <button className="primary" onClick={connectWallet}>Connect Wallet</button>
      <button onClick={() => setDismissed(true)}>✕</button>
    </div>
  );
}
```

**Placement:** rendered at the top of `App.tsx`, above `ThreeCanvas`. It overlays the canvas via `position: fixed`. Dismissed state is component-local (not persisted) — it reappears on next session until the user connects a wallet.

---

## 9. `FeatureGate` component (section F)

Wraps any premium tool button and intercepts the click in guest mode.

```typescript
// apps/web/src/guest/FeatureGate.tsx

import React, { useState } from 'react';
import { useWallet } from '../wallet/useWallet.js';

interface FeatureGateProps {
  children: React.ReactNode;
  feature: string; // human-readable name for the tooltip, e.g. "Wire"
  // If onShear is provided, this gate manages the free shear instead of blocking
  shearMode?: {
    available: boolean;
    onUse: () => boolean; // returns true = consumed, false = not available
  };
}

export function FeatureGate({ children, feature, shearMode }: FeatureGateProps) {
  const { isConnected } = useWallet();
  const [showPrompt, setShowPrompt] = useState(false);

  // Wallet users pass through unconditionally
  if (isConnected) return <>{children}</>;

  // Shear mode: gate is open if shear is available, blocked otherwise
  if (shearMode) {
    if (shearMode.available) {
      // Wrap children to consume the shear on click
      return (
        <div onClick={(e) => { e.stopPropagation(); shearMode.onUse(); }}>
          {children}
        </div>
      );
    }
    // Shear already used — fall through to normal block
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        style={{ opacity: 0.45, cursor: 'not-allowed' }}
        onClick={(e) => { e.stopPropagation(); setShowPrompt(true); }}
      >
        {children}
      </div>

      {showPrompt && (
        <div
          style={{
            position: 'absolute', bottom: '110%', left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--panel)', border: '1px solid var(--edge)',
            borderRadius: 8, padding: '10px 14px', minWidth: 200,
            zIndex: 300, fontSize: 13, textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 8px' }}>
            <strong>{feature}</strong> requires an imbued seed.
          </p>
          <button className="primary" onClick={() => setShowPrompt(false)}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
```

**Usage in the HUD (existing `hud.ts` DOM elements will need React ports, or the gate is injected via `portal` into existing DOM nodes):**

```tsx
<FeatureGate feature="Pruning Shears" shearMode={{ available: freeShearAvailable, onUse: useShear }}>
  <button id="btn-prune">✂ Prune</button>
</FeatureGate>

<FeatureGate feature="Wire">
  <button id="btn-wire">〰 Wire</button>
</FeatureGate>

<FeatureGate feature="Fertilize">
  <button id="btn-fertilize">🌿 Fertilize</button>
</FeatureGate>
```

---

## 10. Species picker (gap in PRD §4.1)

PRD says "species is random or chosen" for guest. The implementation should show a species selection step before planting the guest seed — same moment as the wallet flow's "choose species" step. Recommended: a `GuestSpeciesModal` that opens on first load when `!loadGuestState()`.

```typescript
// apps/web/src/guest/GuestSpeciesModal.tsx
// Opens if no guest state exists. Calls resetGuestTree(species) on confirm.
// Three options: Hardwood / Evergreen / Tropical — with brief stat preview.
// Pattern: identical to SeedShopModal structure.
```

This modal is a prerequisite for guest onboarding and should be in the first implementation sprint.

---

## 11. File list (section G)

### New files

```
apps/web/src/guest/
  guestTreeSchema.ts       — GuestTreeState interface, create/load/save helpers, constants
  computeCurrentDay.ts     — Pure function: bornAt → { currentDay, tutorialDay, ... }
  useGuestTree.ts          — React hook: loads state, reconstructs tree, exposes actions
  GuestCareBridge.ts       — Wraps CareBridge, flushes to localStorage after each action
  GuestWarningBanner.tsx   — Fixed-position "spirit-less seed" notice + Connect CTA
  GuestSpeciesModal.tsx    — First-load species picker for guest seeds
  FeatureGate.tsx          — Wraps premium tool buttons; blocks + shows prompt in guest mode

apps/web/src/context/
  TreeContext.tsx           — React context: { tree, currentDay, notifyTreeChanged }

apps/web/src/components/
  Toast.tsx                 — Simple toast component for wallet-connect transition message
  TechniqueDisplay.tsx      — Reads TechniqueClassifier.classify(tree.careLog) and displays
                              the emerging style ("Bound-and-Cut", "Clip-and-Grow", "Jin",
                              "Water-and-Land", or "Emerging..." for early trees). Shown in
                              the care HUD alongside stat preview. PRD §4.5: visible for
                              both guest and wallet-connected trees.
  GuildRankDisplay.tsx      — Takes isGuest: boolean. Guest trees show "Unranked (Guest)"
                              (fixed string). Wallet trees show real rank computed from
                              StatDeriver.derive().matchPct.
```

### Modified files

| File | Change |
|---|---|
| `apps/web/src/App.tsx` | Add mode routing, `TreeContext.Provider`, `GuestWarningBanner`, wallet-connect toast, `useGuestTree` wiring |
| `apps/web/src/bridge/care_bridge.ts` | Add `rotate()` method (currently missing; prerequisite C-3 task); expose `override`-friendly virtual methods |
| `apps/web/src/components/ThreeCanvas.tsx` | Accept `tree` prop from parent (`App.tsx`), no longer creates its own tree internally |
| `packages/engine/src/CareLogReplay.ts` | Fix water amount: import `WATER_AMOUNT` constant instead of hardcoding `30` |
| `packages/shared/src/index.ts` | Export `WATER_AMOUNT = 28` constant |

### No change needed

```
apps/web/src/wallet/useWallet.ts    — already correct (mode derived from isConnected)
apps/web/src/wallet/useSeedPurchase.ts
apps/web/src/components/SeedShopModal.tsx
apps/web/src/components/WalletBar.tsx
packages/engine/src/BonsaiTree.ts
packages/engine/src/GrowthEngine.ts
packages/engine/src/PruneEngine.ts
packages/engine/src/WireEngine.ts
```

---

## 12. Implementation order

> **PREREQUISITE (separate task before this one):** Fix WATER_AMOUNT mismatch — export `WATER_AMOUNT = 28` from `packages/shared`, import it in `packages/engine/src/CareLogReplay.ts` (replace hardcoded `30`). Run engine tests to confirm. Only dispatch guest mode implementation AFTER engine tests pass.

> **PREREQUISITE (separate task before this one):** Add `CareBridge.rotate()` in `care_bridge.ts` — calls `this.tree.rotate()` then `this.afterAction()`. This is the C-3 fix task. `GuestCareBridge.rotate()` calls `super.rotate()` first, so the base method must exist before `GuestCareBridge` compiles.

1. **Fix C-1 first (see PREREQUISITE above):** export `WATER_AMOUNT` from `@kijo/shared`, update `CareBridge` and `CareLogReplay`. Run existing engine tests — they must pass before anything guest-mode is built on top.

2. **`TreeContext`** — thin, no logic. Makes ThreeCanvas context-aware. Unblocks everything downstream.

3. **`guestTreeSchema.ts` + `computeCurrentDay.ts`** — pure, testable. Write unit tests for `computeCurrentDay` covering: mid-tutorial, tutorial boundary (day 7 exactly), post-tutorial, very long elapsed times.

4. **`useGuestTree`** — depends on schema + computeCurrentDay. Integration test: plant seed, add water action, reload page, confirm tree reconstructs to same state.

5. **`App.tsx` mode routing** — wire `useGuestTree` into `TreeContext`, add guest banner, add wallet-connect toast.

6. **`GuestSpeciesModal`** — first-load gate. Without this, guests get a random hardwood silently.

7. **`GuestCareBridge`** — wire to `useGuestTree.addCareAction`. Confirm localStorage updates on water/rotate. Confirm `super.rotate()` is called before `addCareAction` (C-3 prerequisite must be complete).

8. **`FeatureGate`** — wrap wire/fertilize/jin buttons. Confirm shear path: `freeShearAvailable` is now computed (`currentDay >= 5 && !tutorialShearUsed`), so shear gate opens on day 5, not after `tutorialDone`.

9. **`TechniqueDisplay`** — reads `TechniqueClassifier.classify(tree.careLog)`, displays emerging style. Wire into care HUD. Both guest and wallet trees show this (PRD §4.5).

10. **`GuildRankDisplay`** — pass `isGuest` prop. Guest: "Unranked (Guest)" fixed string. Wallet: derive from `StatDeriver.derive().matchPct`.

11. **`GuestWarningBanner`** — cosmetic; last.

---

## 13. Open questions for product sign-off

| # | Question | Default if not answered |
|---|---|---|
| OQ-1 | Does the `GuestWarningBanner` persist its dismissed state across sessions (via localStorage) or re-appear every session? | Re-appears every session (current design) |
| OQ-2 | When the guest reconnects a wallet, should the guest `localStorage` key be cleared after some TTL (e.g., 30 days), or kept indefinitely? | Kept indefinitely (PRD §4.1: "guest tree stays in localStorage as reference") |
| OQ-3 | Can a guest choose to restart their guest tree (pick a new species)? Or is the first seed permanent for that browser? | Permanent; no restart without manual localStorage clear |

**Resolved (not open):**
- **Shear timing** — PRD §3.2 is unambiguous: "Your first cut (Days 6–7)". The free shear unlocks at `currentDay >= 5` (0-indexed). No "meaningful interaction" qualifier exists in §3.2 — the plan's OQ-4 was based on a misread. Removed.
- **Flower Guild Rank** — PRD §4.5 is explicit: guest shows "Unranked (Guest)". Implemented via `GuildRankDisplay` component with `isGuest: boolean` prop. Wallet-connected trees compute real rank from `StatDeriver.derive().matchPct`. Removed as an open question.
