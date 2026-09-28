# KIJO — Product Requirements Document

**Version:** 0.2
**Date:** July 19, 2026 (lore updated September 24, 2026)
**Author:** Jeremy Gordon / Kingdom Koders
**Status:** In Production — Phase 1 active (Saigon testnet)
**Parent Document:** KIJO-GDD.md

> **Lore terminology revision — 2026-09-24:** The storefront character is an unnamed fictional member of the formal **Decorative Tree Guild**, commonly called the **Flower Guild**. This preserves the established Flower Guild Rank product label while avoiding use of a living artist's identity and avoiding unsupported claims that the game's exact Guild or grading ladder is historical.

---

## 1. Product Definition

### 1.1 One-Sentence Pitch

Grow a bonsai tree over real time, watch it become a 3D NFT, and awaken the battle spirit living inside it.

### 1.2 What Ships (Phase 1)

A mobile-first web app (PWA) where players tend a procedurally generated bonsai tree that mints as a 3D spatial NFT on the Ronin blockchain. The tree grows in real time, responds to daily care (water, prune, wire, fertilize, rotate), and is tradeable on the Ronin marketplace. Combat does NOT ship in Phase 1 — the care loop must prove standalone retention before combat amplifies it.

**Phase 1 includes:**
- 3D bonsai care system (Three.js web client consuming the verified TS engine)
- Wallet-connected minting: imbued seeds → kijonsai NFTs on Ronin mainnet
- Guest mode: free spirit-less seeds for try-before-you-buy
- Ronin marketplace integration: list, browse, buy/sell kijonsai NFTs
- Premium consumables: shears, wire, fertilizer (purchased with RON or SLP)
- Real-time day cycle (1 game day = 8 real hours)
- Persistence: care log as the authoritative state, reconstructable from seed + log
- Flower Guild Rank displayed on each NFT (match % as quality grade)

**Phase 1 does NOT include:**
- Kijo combat (Phase 2)
- Delegation system (Phase 3)
- SLP burn mechanic (arrives with combat — no morale recovery without battles)
- Tournament or ranked systems
- Multi-tree grove view (stretch goal, not launch-blocking)

### 1.3 Phase 2 — Combat (milestone-gated, not date-gated)

Ships when: care + combat engine tested and verified, AND Phase 1 has met the daily active wallet threshold (see §5.1). Adds: kijo awakening, fighting game combat (Summer Engine / Godot 4), SLP burn for morale recovery, ranked matchmaking, 2v2/3v3 tag teams.

### 1.4 Phase 3 — Delegation & Economy

Ships when: combat is stable with proven daily engagement. Adds: on-chain delegation contracts, caretaker/fighter role split, revenue sharing, reputation system.

---

## 2. Target Users

### 2.1 First 100 Users (Launch Cohort)

**Ronin veterans** — players already in the Ronin ecosystem (ex-Axie, Pixels, current RON/SLP holders) looking for new opportunities. They understand wallet connect, NFT minting, marketplace trading. They don't need crypto onboarding. They need a reason to care about a new project.

**Why they stay:** the kijonsai NFT appreciates in a way no other NFT does — through time and active care, not speculation. A 30-day tree with a "Sapling" Flower Guild Rank is objectively less valuable than a 200-day "Styled" tree, and the only way to get from Sapling to Styled is months of attentive care. Early adopters who start growing day one build an unreplicable head start.

### 2.2 Growth Audience (Post-Launch)

**Casual Web3 gamers** seeking long-term NFT ownership value from care rather than speculation. Profile: 18-35, mobile-primary, plays idle/sim games (Tamagotchi, Neko Atsume, plant apps), interested in crypto but burned by or bored of speculative mints. They want to BUILD value, not BUY it.

**Why they stay:** the daily ritual of checking moisture, deciding whether to prune, watching growth over weeks — this is the engagement pattern of idle sims, not crypto trading. The NFT value is a bonus on top of a game they'd play regardless.

### 2.3 Player Archetypes (Phase 1 → Phase 2 evolution)

| Archetype | Phase 1 Activity | Phase 2 Activity | Monetization |
|---|---|---|---|
| **Caretaker** | Daily tree care, pruning, marketplace listing | Delegation (care for fighters' trees), Exhibition events | Shears, wire, fertilizer, time subscription |
| **Collector/Trader** | Buy low-rank trees, care for them to raise rank, sell high | Same + kijo trading for combat potential | Seed purchases, marketplace fees |
| **Fighter** | Absent (no combat yet) | Combat, SLP consumption, team building | SLP burn, tournament entry, delegation fees |

**Phase 1 acquisition order:** Caretakers and Collectors first. Fighters arrive when combat launches. This is deliberate — the care economy must be running before combat creates demand on it.

---

## 3. Business Model

### 3.1 Pricing

| Item | Price | Uses | Currency |
|---|---|---|---|
| Imbued Seed (spirit-containing) | $3 | 1 tree (permanent NFT) | RON |
| Free Seed (spirit-less, guest mode) | Free | 1 tree (no NFT, no awakening, no marketplace) | — |
| Pruning Shears | $1–3 | 3–5 cuts | RON |
| Wire | $1–3 | 3–5 bends (must time removal at 6-12mo) | RON |
| Guy-Wire | $2–4 | 3–5 anchor pulls (precision targeting) | RON |
| Raffia Wrap | $0.50–1 | 3–5 protections (prevents wire scarring) | RON |
| Jin Pliers | $1–3 | 3–5 bark strips (deadwood creation) | RON |
| Fertilizer Pack | $0.50–1 | 1–3 applications | RON |
| Extra Tree Slot (beyond 5) | $3 | Permanent | RON |
| Cosmetic Pot | $1–5 | Permanent per tree | RON |
| Landscape Elements (rocks, water, ceramics) | $0.50–2 | Permanent per placement | RON |
| Time Subscription | $5/month | 2x day cycle speed | RON |

**Free tools (no purchase required):** water, rotate, twine (temporary bends ±15-20°), weights (downward pulls via gravity, 35% of wire's max arc).

All prices are USD-equivalent, paid in RON. SLP (the Ronin token) is used exclusively as a combat consumable (Phase 2 — morale recovery burn, approved by Sky Mavis).

### 3.2 Free-to-Play Floor

A player who spends $0 can:
- Create a guest account (no wallet)
- Receive one free spirit-less seed
- Experience the full care loop: water, rotate, twine, grow, watch the tree develop in 3D
- Complete the tutorial phase (see below)
- Receive **1 free shear use** after completing the tutorial
- Play indefinitely at real-time speed (1 game day = 8 hours)

A free player CANNOT:
- Mint an NFT (the tree has no spirit — it's not a kijonsai, it's practice)
- List or trade on the marketplace
- Awaken a kijo (Phase 2)
- Use premium tools beyond the tutorial shear (wire, jin pliers, fertilizer, additional shears require an imbued seed)
- Earn from delegation

**The Tutorial Phase (first 7 game days, 4x speed for all players):**

The tutorial runs during the accelerated first 7 game days. It teaches three things in sequence:

1. **Basic care** (Days 1–2): water your tree, watch it grow, understand moisture and health. Hands-on, learn by doing.

2. **The Three Schools** (Days 3–5): the game introduces the three historical penjing traditions and their technique bonuses:
   - **Bound-and-Cut** — wire + shears together → balanced archetype
   - **Absolute Clip-and-Grow** (Lingnan School) — shears only, never wire → high-crit archetype
   - **Trunk Splitting / Jin** — bark stripping → defensive archetype
   
   The player learns that their care CHOICES will determine their kijo's fighting style. The technique isn't selected from a menu — it emerges from what they do. This is the moment the game reveals its depth.

3. **Your first cut** (Days 6–7): the player receives **1 free shear use**. They've watched their tree grow for 5 game days. They understand the three schools. Now they make their first permanent decision: which branch to cut, knowing it changes everything that grows after. This single cut teaches the weight of pruning more than any tutorial text could.

After the tutorial, the accelerated speed drops to real-time (8 hours/day). The free shear is spent. If they want to cut again, they buy shears. But they now understand exactly what they're buying and why it matters.

**Conversion trigger:** the player has shaped their tree with one meaningful cut, learned the three schools, watched growth respond to their care — and their tree has no spirit. It can't be minted, ranked, or traded. The care loop works; the permanence doesn't. The moment they want their tree to MATTER, they buy an imbued seed and start again with everything they learned. The free loop is the education. The spirit is the graduation.

### 3.3 Revenue Streams (Phase 1)

- Seed sales (primary — every new tree is a purchase)
- Consumable sales (recurring — shears, wire, fertilizer)
- Time subscriptions (recurring — monthly)
- Marketplace fees (5% on secondary sales)
- Cosmetic pots (low-value, high-attachment vanity items)

### 3.4 Revenue Streams (Phase 2 additions)

- SLP burn (combat morale recovery — Kijo doesn't capture this revenue directly; it drives SLP demand which benefits the Ronin ecosystem and strengthens the partnership)
- Tournament entry fees (5% house fee on prize pools)
- Delegation platform fee (if any — TBD)

### 3.5 Marketplace Fee Structure

5% fee on all secondary kijonsai NFT sales via the Ronin marketplace. Standard Ronin marketplace integration — not a custom marketplace.

---

## 4. User Experience Flows

### 4.1 First-Time User (Critical Path)

```
Player finds Kijo (link, ad, Ronin ecosystem discovery)
  → Landing page: pitch + "Plant a Seed" CTA
  → Two options:
     A) Connect Ronin wallet → purchase imbued seed ($3-5 in RON)
        → choose species (Hardwood / Evergreen / Tropical)
        → seed minted as kijonsai NFT on Ronin mainnet
        → care loop begins: tree at Day 0, tutorial prompts
     B) Play as Guest → free spirit-less seed
        → warning: "This seed does not contain a Kijo spirit.
           Your tree will grow but cannot be minted, traded,
           or awakened. Connect a wallet to plant a real seed."
        → same care loop, same mechanics, no NFT, no marketplace
```

**The guest warning is honest, not predatory.** It tells the player exactly what they're getting and not getting. The free loop is fully functional — the limitation is on permanence and value, not on gameplay. A guest who later connects a wallet starts fresh with a new imbued seed (their guest tree doesn't convert — they already understand the mechanics and can make better decisions on their real tree).

### 4.2 Daily Engagement Flow

```
Player opens app (once or twice per real day)
  → sees their tree's current state (3D, orbit view)
  → checks moisture bar — waters if needed
  → checks health — adjusts care if declining
  → optionally: rotates, applies fertilizer, prunes, wires
  → presses "Next Day" or has Auto enabled
  → watches growth tick: new branch extension, possible fork, thickening
  → checks stat preview panel: sees numbers changing
  → checks Flower Guild Rank: still Sapling... working toward Pruned
  → closes app
  → total time: 2–5 minutes for a check-in, up to 10 if pruning/wiring
```

**Game day timing:** 1 game day = 8 real hours (1/3 of a real day). Three game days per real day. Moisture decays ~7 per game day, so in 2-3 game days (16-24 real hours) the tree needs watering. This means the player checks in **once or twice per real day** — enough engagement to build a habit, not so much that it feels like a job.

### 4.3 Pruning Session Flow (Premium Tool)

```
Player decides to prune (tree is getting bushy, or they're
  steering toward their seed's stat terrain)
  → purchases shears if they don't have any ($1-3 for 3-5 uses)
  → enters prune mode (crosshair cursor)
  → orbits tree in 3D, inspecting branches from all angles
  → hovers over a branch — it highlights red
  → considers: "this branch is growing away from where I want stats"
  → clicks to select, clicks again to confirm
  → branch and children vanish, scar appears, remaining tips boost
  → exits prune mode
  → one shear use consumed
  → this was a permanent, irreversible decision that changed the
     tree's future shape, stats, Flower Guild Rank, and kijo morphology
```

### 4.4 Marketplace Flow (Phase 1)

```
Seller:
  Player has a Day 150 Styled (68% match) hardwood kijonsai
  → lists on Ronin marketplace from within the app
  → price set by player (floor price = what similar trees sell for)
  → listing shows: 3D voxel preview, species, age, Flower Guild Rank,
     stat preview, care log summary, seed number
  → buyer can inspect the full care history (every action logged)

Buyer:
  → browses Ronin marketplace for kijonsai NFTs
  → filters by species, age range, Flower Guild Rank, price
  → inspects a listing: rotates the 3D voxel preview, reads stats,
     checks care history (was it neglected? recently recovered?)
  → purchases → NFT transfers → buyer continues caring for the tree
     from its current state (full care log transfers with the NFT)
```

### 4.5 Wallet-to-Guest Boundary

| Feature | Guest | Wallet Connected |
|---|---|---|
| Plant a seed | ✓ (spirit-less) | ✓ (imbued, $3) |
| Water / rotate / next day | ✓ | ✓ |
| Twine (free bends ±15-20°) | ✓ | ✓ |
| Weights (free downward pulls) | ✓ | ✓ |
| Tutorial (3 schools + 1 free shear) | ✓ | ✓ |
| Wire / guy-wire / raffia | ✗ | ✓ (premium consumables) |
| Shears (beyond tutorial shear) | ✗ | ✓ (premium consumables) |
| Jin pliers | ✗ | ✓ (premium consumables) |
| Fertilize | ✗ | ✓ (premium consumables) |
| Landscape elements | ✗ | ✓ (premium) |
| 3D tree growth | ✓ | ✓ |
| NFT minting | ✗ | ✓ |
| Marketplace access | Browse only | Full (buy/sell/list) |
| Stat preview | ✓ (visible, educational) | ✓ |
| Technique classification | ✓ (visible) | ✓ |
| Flower Guild Rank | Shows "Unranked (Guest)" | Real rank |
| Persistence | Local storage only | On-chain care log |
| Kijo awakening (Phase 2) | ✗ | ✓ |
| Time subscription | ✗ | ✓ ($5/mo for 2x) |

---

## 5. Success Metrics

### 5.1 Phase 1 Launch Criteria

Before launch, the following must be true:
- [ ] Care system functional: 3D tree grows, responds to all care actions, persists across sessions
- [ ] Minting works: imbued seed → kijonsai NFT on Ronin mainnet (care_log_hash Merkle root **deferred to Phase 2** — see KIJONSAI-CONTRACT-ARCH.md §1.1)
- [ ] Marketplace integration: kijonsai NFTs listed and tradeable on Ronin marketplace
- [ ] 3D spatial NFT viewable: voxel preview renders on marketplace listing
- [ ] Guest mode works: spirit-less seed, full care loop, no minting
- [ ] Premium consumables purchasable with RON
- [ ] Testnet testing complete with zero critical bugs

### 5.2 Phase 1 Success Signal

**Primary metric:** ≥25 daily active wallets for 14 consecutive days.

This is deliberately low. 25 DAW for 2 weeks means 25 people came back every day to water their trees without combat, without SLP rewards, without speculation hype — just because the care loop retained them. That proves the thesis: the tree itself is the content.

**Supporting metrics:**
- Average tree age across active wallets (growing = retained, stagnant = checking in but not engaging)
- Prune/wire purchase conversion (are people buying precision tools? that means they care about shaping, not just watering)
- Marketplace listing count (are people pricing their trees? that means they see value)
- Guest-to-wallet conversion rate (are free players buying imbued seeds?)
- Average session length (target: 2-5 minutes. Longer = pruning/wiring engagement. Shorter = just watering, which is fine)

### 5.3 Kill Signal

**Pump-and-dump pattern:** a spike of wallet activity (50+ DAW) in the first week followed by a rapid drop to <10 DAW by week 3. This means players came, saw, rejected the core loop, and left. If the care loop doesn't hold attention on its own, combat won't save it — it will just attract a different group who also leaves when they realize the game requires patience.

**What to do if kill signal fires:** diagnose whether the rejection was the care loop itself (too boring, too slow, too confusing) or the value proposition (no clear path to profit, NFT didn't feel valuable, marketplace was dead). The first is a design problem. The second is a marketing/positioning problem. Different responses.

### 5.4 Phase 2 Launch Trigger

Combat ships when ALL of these are true:
- Phase 1 success signal met (25 DAW × 14 days)
- Care + combat engine fully tested and verified (all gates green through combat resolver)
- At least 50 kijonsai NFTs exist at Day 60+ (enough aged trees for meaningful combat)
- Combat testnet testing complete

This is milestone-gated, not date-gated. If Phase 1 takes 6 months to hit 25 DAW, combat waits 6 months. If it hits in 2 weeks, combat ships as soon as it's tested. The market decides the pace, not a roadmap.

---

## 6. Technical Decisions

### 6.1 Platform

- **Phase 1:** Mobile-first Progressive Web App (PWA). No app store. No install friction. Link → play.
- **Phase 2 combat:** Summer Engine (Godot 4) export — web build or native mobile. Separate client from the care app, shared data contract (StatSheet JSON).

### 6.2 Chain

- **Network:** Ronin mainnet (L2 EVM)
- **Testnet:** Saigon testnet during development
- **NFT standard:** ERC-721 for kijonsai
- **Gas:** evaluate Ronin's free transaction model and sponsored transactions. Goal: player never needs to think about gas for basic care actions. Minting and marketplace transactions may require RON.
- **Marketplace:** Ronin marketplace / Mavis Market integration (not a custom marketplace)

### 6.3 SLP Integration (Phase 2)

- **Mechanism:** fighters spend SLP (the existing Ronin ERC-20 token) to partially restore kijo morale after battle losses
- **Burn method:** coordinate with Sky Mavis on approved burn mechanism (transfer to dead address, or approved burn contract). Implementation TBD pending technical guidance from Ronin team.
- **Kijo never mints SLP.** Pure sink. Zero supply-side impact.
- **Approved by Sky Mavis and the Ronin team.**

### 6.4 Day Cycle

- 1 game day = **8 real hours**
- 3 game days per real calendar day
- Moisture decays ~7 per game day → needs watering every 2-3 game days → player checks in **once or twice per real day**
- Time subscription accelerates the cycle (2x = 1 game day per 4 hours, 4x = 1 game day per 2 hours). Subscribers engage more frequently but don't gain power faster — the same care quality is required, just compressed.

### 6.5 Backend

**Supabase** (resolved P1):
- **Postgres** — care log storage, user accounts, tree state
- **Realtime** — live updates (watch someone else's tree grow, marketplace activity)
- **Row Level Security** — per-wallet data access, each player sees only their trees
- **Edge Functions** — day-tick scheduler (triggers growth every 8 hours server-side), seed purchase + NFT mint (`seed-claim`), wallet auth (`wallet-auth`); Merkle root computation and on-chain push **deferred to Phase 2** (see KIJONSAI-CONTRACT-ARCH.md §1.1)
- Care log stored in Postgres; Merkle root of the log **will be** pushed to Ronin periodically (batch, not per-action) — Phase 2
- Migrate to self-hosted Postgres if scale demands it — Supabase exports cleanly

### 6.6 Client Stack

- **Framework:** React (resolved P2)
- **3D:** Three.js (via raw refs or `@react-three/fiber`)
- **Build:** Vite (fast, TS-native, PWA plugin)
- **Wallet:** Ronin Wallet SDK / Tanto Kit (`window.ronin`)
- **Hosting:** Netlify (existing infrastructure from Gordon's Ancestral Farms)
- **PWA:** Vite PWA plugin for offline capability and install-to-homescreen

---

## 7. NFT Specification

### 7.1 On-Chain Data (~160 bytes per NFT)

```
{
  seed:           uint32      // deterministic growth seed
  species:        uint8       // species class + specific species
  born:           uint64      // block timestamp of planting
  care_log_hash:  bytes32     // Merkle root of care log
  has_spirit:     bool        // true = imbued, false = guest (never minted)
}
```

### 7.2 Off-Chain Data (IPFS or server, Merkle-verified)

- Full care log (~12KB at Day 440)
- Voxel preview (generated by indexer, ~30-60KB compressed)
- StatSheet (derived, regenerated on demand)

### 7.3 Marketplace Display

Each kijonsai listing shows:
- Interactive 3D voxel preview (rotatable)
- Species + specific type (e.g., "Hardwood — Oak")
- Age in days
- Flower Guild Rank (Seedling / Sapling / Pruned / Styled / Exhibition / Master Work)
- Stat preview (HP, Power, Endurance, Ki, Skill Slots, Wisdom)
- Care log summary (total actions, prune count, health average)
- Leaf color (with rare colors visually prominent — undocumented, ~3%)
- Owner history

---

## 8. Risks & Mitigations (Product-Specific)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 8-hour day cycle feels too slow for first-time users | Medium | High | Accelerated tutorial (first 7-14 game days at 4x speed even for free users). Shows growth immediately, then settles to real pace. |
| Free seed without spirit feels like a bait | Low | Medium | Warning is upfront and honest. The free loop is genuinely complete — no surprise paywall mid-experience. Guest trees are educational, not crippled. |
| Ronin marketplace integration is technically complex | Medium | High | Use existing Mavis Market APIs. Don't build a custom marketplace. Lean on Ronin team relationship. |
| Early NFT prices are volatile (no price discovery) | High | Low | This is expected and normal. The Flower Guild Rank system provides an objective quality signal independent of speculation. Price follows quality over time. |
| Premium tools (shears/wire) feel pay-to-win | Low | High | Free players still grow viable trees — they just can't sculpt as precisely. The stat terrain rewards coverage (growth volume), not just precision. A big wild tree is still strong. Premium gates precision, not power. |
| Competitors copy the care loop | Low | Medium | Time is the moat. A competitor launching 6 months later has a playerbase with 6-month-old trees. Those trees cannot be replicated. The longer Kijo runs, the stronger the moat. |

---

## 9. Resolved Decisions

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| P1 | Backend | **Supabase** — Postgres for care log, Realtime for live updates, RLS for per-wallet access, Edge Functions for day-tick + Merkle root. Migrate to self-hosted Postgres if/when scale demands. | Already in toolchain, zero ops overhead at 25 DAW, clean export path. |
| P2 | Client framework | **React** + Three.js (via raw refs or `@react-three/fiber`). Vite build. | DOM HUD overlaying Three.js canvas is React's strength. Vanilla would rebuild component state management halfway through. |
| P3 | Care log storage | **Supabase Postgres** with Merkle root on-chain (Ronin). Not IPFS, not Arweave. | Append-heavy workload (action every 8 hours). Postgres stores simply, queries fast for marketplace browsing. Merkle root on Ronin guarantees integrity. Decentralization of the log itself is a Phase 3+ concern. |
| P4 | Gas abstraction | **Sponsored for care actions, user-pays for minting + marketplace.** Confirm Ronin free-transaction eligibility. Daily watering should never trigger a gas prompt. | Care actions are frequent and low-value — gas friction kills daily engagement. Minting and marketplace are infrequent, higher-value — gas is expected. |
| P5 | Seed price | **$3 flat (paid in RON equivalent).** | Impulse-purchase territory. Low re-mint friction drives churn revenue from impatient players. Revenue comes from consumables and marketplace fees over time, not seed price. |
| P6 | Time subscription | **$5/month for 2x speed** (1 game day = 4 hours instead of 8). One tier at launch. | 2x keeps the care ritual casual (2-3 check-ins/day vs 1-2). Higher tiers (4x/8x) reserved for later if demand proves it. Subscription is convenience, not acceleration. |
| P7 | Accelerated tutorial | **First 7 game days at 4x speed, free for all players including guests.** Then drops to real 8-hour cycle. | Prevents "I planted a seed and nothing happened" first-session rejection. 7 game days at 4x ≈ 14 real hours — player sees trunk + first branches by evening of day 1. |
| P8 | SLP burn mechanism | **Defer to Sky Mavis guidance.** Present options: (A) transfer to dead address, (B) approved burn contract. Document the interface as `burnSLP(amount, wallet) → txHash` and let Ronin team choose the mechanism. | They know their token's contract capabilities and how burns should appear in their ecosystem dashboards. |
| P9 | IP ownership | **Player owns their kijonsai NFT and its art.** Kingdom Koders retains ownership of the game, brand, engine, and procedural generation system. Player can use their kijonsai image for personal or commercial use. Kingdom Koders can use any kijonsai image for marketing. Written into Terms of Service, not the smart contract. | Standard NFT IP model (BAYC precedent). One-page legal review needed — templated work, not novel. |
| P10 | Cultural framing | **Respectful dual heritage.** The fictional Decorative Tree Guild seller carries documented Chinese penjing and Japanese bonsai influences; Yama-no-Kami and the shinboku foundation carry the Japanese spiritual frame. Present the Guild and Flower Guild Rank as Kijonsai fiction informed by real culture, and sanity-check the framing with penjing and bonsai communities before marketing launch. | Preserves real cultural lineage without borrowing a living master's identity, inventing a biography for a historical person, or claiming the game's exact Guild system is historical. |

---

## 10. Definition of Done — Phase 1

Phase 1 is shippable when:

- [ ] Web PWA loads on mobile Chrome/Safari, desktop Chrome/Firefox
- [ ] Guest flow: spirit-less seed, full care loop, clear upgrade prompt
- [ ] Wallet flow: Ronin connect, seed purchase in RON, NFT minted on mainnet
- [ ] 3D tree renders and grows correctly for all 3 species
- [ ] Care actions work: water, prune, wire, fertilize, rotate
- [ ] Day cycle: 8 real hours per game day, auto-advance optional
- [ ] Persistence: close and reopen → tree state intact (care log replay)
- [ ] Stat preview: real derived stats from engine (not placeholder)
- [ ] Flower Guild Rank: displayed, calculated from match %
- [ ] Seasonal visuals: leaf color changes across 120-day cycle
- [ ] Marketplace: kijonsai NFTs listable and tradeable on Mavis Market
- [ ] Premium consumables: purchasable with RON, consumable counts tracked
- [ ] Performance: <3s initial load, 60fps 3D rendering on mid-range mobile
- [ ] Testnet: zero critical bugs across 30 days of simulated play
- [ ] Mainnet: successful mint + transfer + marketplace list of at least 1 kijonsai

---

*This PRD is a living document. Update it as open decisions resolve and playtest data arrives.*
