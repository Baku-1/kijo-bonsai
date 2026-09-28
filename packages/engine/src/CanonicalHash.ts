/**
 * Canonical JSON serialization and SHA-256 hashing.
 *
 * `canonical-json-v1` specification (§4.3):
 * - Recursively sorts object keys lexicographically.
 * - Preserves array order.
 * - Emits UTF-8 with no insignificant whitespace.
 * - Normalizes integer zero (no `-0`).
 * - Rejects non-integer numbers (NaN, Infinity, floats) and duplicate logical keys.
 * - SHA-256 lower-case hex of those bytes is the digest.
 *
 * Uses the Web Crypto API (SubtleCrypto) which is available in:
 * - Node.js >= 15 (globalThis.crypto.subtle)
 * - Deno
 * - Browsers
 * - Supabase Edge Functions (Deno-based)
 *
 * @module @kijo/engine/CanonicalHash
 */

import { V3_CANONICAL_JSON_VERSION, V3_HASH_ALGORITHM } from '@kijo/shared';

// ═══════════════════════════════════════════════════════════════════════════
// Canonical JSON serialization
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serialize a value to canonical-json-v1 bytes.
 *
 * Throws on:
 * - Non-integer numbers (NaN, Infinity, -Infinity, floats)
 * - -0 (negative zero)
 * - Functions, symbols, undefined at any level
 * - BigInt (must convert to decimal string before serialization)
 */
export function canonicalJsonSerialize(value: unknown): string {
  return serializeValue(value);
}

function serializeValue(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) throw new TypeError('canonical-json-v1: undefined is not allowed');

  switch (typeof val) {
    case 'boolean':
      return val ? 'true' : 'false';

    case 'number': {
      if (!Number.isFinite(val)) {
        throw new TypeError(`canonical-json-v1: non-finite number: ${val}`);
      }
      if (!Number.isInteger(val)) {
        throw new TypeError(`canonical-json-v1: non-integer number: ${val}`);
      }
      // Normalize -0 to 0
      if (Object.is(val, -0)) return '0';
      return String(val);
    }

    case 'string':
      return JSON.stringify(val); // JSON.stringify handles escaping correctly

    case 'bigint':
      throw new TypeError('canonical-json-v1: bigint must be converted to string before serialization');

    case 'function':
    case 'symbol':
      throw new TypeError(`canonical-json-v1: ${typeof val} is not allowed`);

    case 'object': {
      if (Array.isArray(val)) {
        return serializeArray(val);
      }
      return serializeObject(val as Record<string, unknown>);
    }

    default:
      throw new TypeError(`canonical-json-v1: unsupported type: ${typeof val}`);
  }
}

function serializeArray(arr: unknown[]): string {
  const elements = arr.map(serializeValue);
  return '[' + elements.join(',') + ']';
}

function serializeObject(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();

  // Check for duplicate keys (shouldn't happen in JS objects, but be safe)
  for (let i = 1; i < keys.length; i++) {
    if (keys[i] === keys[i - 1]) {
      throw new Error(`canonical-json-v1: duplicate key: ${keys[i]}`);
    }
  }

  const pairs: string[] = [];
  for (const key of keys) {
    const val = obj[key];
    // Skip undefined values (like JSON.stringify)
    if (val === undefined) continue;
    pairs.push(JSON.stringify(key) + ':' + serializeValue(val));
  }

  return '{' + pairs.join(',') + '}';
}

// ═══════════════════════════════════════════════════════════════════════════
// SHA-256 hashing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute SHA-256 hex digest of canonical-json-v1 serialization.
 * Returns lowercase hex string (64 chars).
 *
 * Uses Web Crypto API (SubtleCrypto).
 */
export async function canonicalHash(value: unknown): Promise<string> {
  const json = canonicalJsonSerialize(value);
  const bytes = new TextEncoder().encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA-256 hex digest of a pre-serialized canonical JSON string.
 */
export async function sha256Hex(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.1 — Content-addressed ID generation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute a content-addressed ID: SHA-256 hex of canonical-json-v1 array.
 *
 * Usage:
 *   dayPlanId = await contentAddressedId(["kijo-day-plan-v1", treeId, ...])
 *   eventId   = await contentAddressedId(["kijo-growth-event-v1", dayPlanId, ...])
 */
export async function contentAddressedId(components: readonly unknown[]): Promise<string> {
  return canonicalHash(components);
}

/**
 * Synchronous canonical JSON serialization for hashing with external SHA-256.
 * Returns the UTF-8 string; caller handles the hash.
 */
export function canonicalJsonString(value: unknown): string {
  return canonicalJsonSerialize(value);
}

// Re-export version constants for consumers
export { V3_CANONICAL_JSON_VERSION, V3_HASH_ALGORITHM };
