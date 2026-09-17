# LINT-THREECANVAS-RAYCASTER-2026-09-01

**Pipeline stage:** Linter
**Date:** 2026-09-01
**Skills governing:** carmack-linus-review, engineering-craft-standard
**Target:** `apps/web/src/components/ThreeCanvas.tsx`
**Predecessor:** AUDIT-THREECANVAS-RAYCASTER-2026-09-01.md (VERIFIED)

---

## GATE (pre-lint)

```
$ npx tsc --noEmit -p apps/web/tsconfig.json
EXIT:0
```

## ESLINT

No `eslint.config.js` found (ESLint v9+ requires new config format). Skipped.

---

## ISSUES FOUND

### 1. Unused `React` namespace import (line 16)

**Before:** `import React, { useEffect, useRef } from 'react';`
**After:** `import { useEffect, useRef } from 'react';`

**Rationale:** `tsconfig.json` has `"jsx": "react-jsx"` + `"jsxImportSource": "react"`,
so the JSX transform is automatic. `React` namespace is never referenced in code
(only in comments). Only `useEffect` and `useRef` are used.

---

## NO ISSUES FOUND IN

| Category | Status |
|----------|--------|
| Dead code / unused variables | Clean |
| `console.log` / debug statements | Clean — all `console.warn` / `console.info` are intentional operational logging with `[kijo-care]` prefix |
| Naming consistency | Clean — camelCase for functions/vars, PascalCase for types/components |
| Type safety (`as any`, implicit any) | Clean — zero `as any` casts; narrow typed casts only (`as HTMLInputElement`, `as THREE.Material`) |
| React best practices | Clean — `[]` deps on mount-only effect, `initialized.current` StrictMode guard |
| Effect cleanup | Clean — `cancelAnimationFrame`, `removeEventListener('pointerdown')`, geometry/material dispose, renderer dispose |
| Event listener cleanup | Clean — `onPointerDown` named and removed; inner DOM listeners die with `innerHTML` replacement |
| Error handling | Clean — consistent `result.ok` check + rejection feedback across all handlers |
| Code organization | Clean — logical section grouping with comment headers |

---

## FIX APPLIED

1. Removed unused `React` namespace from import (line 16).

---

## GATE (post-lint)

```
$ npx tsc --noEmit -p apps/web/tsconfig.json
EXIT:0
```

---

## STATUS: CLEAN WITH FIXES

One unused import removed. No behavioral changes. tsc gate passes.
