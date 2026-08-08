/**
 * Kijo game server -- Phase 1 stub.
 * Will own: server-authoritative day ticks, care-log append + Merkle root,
 * action validation, matchmaking. The engine is shared with the client so
 * the server replays the same deterministic simulation (GDD s9.2).
 *
 * NOTE: createTree()/tick() were retired 2026-08-07 (dual-engine cleanup).
 * When this stub is wired up, use GrowthEngine.growTick() via CareLogReplay.
 */
console.log('kijo server stub -- ready');
