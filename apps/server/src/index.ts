/**
 * Kijo game server — Phase 1 stub.
 * Will own: server-authoritative day ticks, care-log append + Merkle root,
 * action validation, matchmaking. The engine is shared with the client so
 * the server replays the same deterministic simulation (GDD §9.2).
 */
import { createTree, tick } from '@kijo/engine';

const demo = tick(createTree(1, 'evergreen'));
console.log(`kijo server stub — engine linked ok (day ${demo.day})`);
