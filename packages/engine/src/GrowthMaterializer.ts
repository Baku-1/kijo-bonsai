/**
 * Growth Materializer — Integer-PPM Evaluation & Boundary Materialization
 *
 * Evaluates growth events at a given timestamp using integer ppm interpolation.
 * Handles segment and day boundary materialization.
 *
 * Spec: ARCH-GROWTH-V3-IMPLEMENTATION-2026-09-25.md §6.2–§6.3.
 *
 * @module @kijo/engine/GrowthMaterializer
 */

import type {
  GrowthEventV1,
} from '@kijo/shared';
import {
  PROGRESS_SCALE,
  DISPLAY_SEGMENT_MS,
  GAME_DAY_MS,
  computeClockState,
  fromQ4,
} from '@kijo/shared';

// ═══════════════════════════════════════════════════════════════════════════
// §6.2 — Integer PPM interpolation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interpolate a q4 value at a given progress (ppm).
 *
 * result = from + floor((to - from) * progressPpm / 1_000_000)
 *
 * All inputs and output are integers (q4 values).
 */
export function interpolateQ4(fromQ4: number, toQ4: number, progressPpm: number): number {
  if (progressPpm <= 0) return fromQ4;
  if (progressPpm >= PROGRESS_SCALE) return toQ4;
  return fromQ4 + Math.floor((toQ4 - fromQ4) * progressPpm / PROGRESS_SCALE);
}

/**
 * Compute event progress in integer ppm at a given absolute timestamp.
 *
 * The event spans [segmentStart + startOffsetMs, segmentStart + endOffsetMs].
 * Progress is clamped to [0, PROGRESS_SCALE].
 */
export function computeEventProgressPpm(
  event: Readonly<GrowthEventV1>,
  segmentStartMs: number,
  nowMs: number,
): number {
  const eventStartMs = segmentStartMs + event.startOffsetMs;
  const eventEndMs = segmentStartMs + event.endOffsetMs;
  const duration = eventEndMs - eventStartMs;

  if (duration <= 0 || nowMs <= eventStartMs) return 0;
  if (nowMs >= eventEndMs) return PROGRESS_SCALE;

  return Math.floor((nowMs - eventStartMs) * PROGRESS_SCALE / duration);
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.2 — Event evaluation at a timestamp
// ═══════════════════════════════════════════════════════════════════════════

/** Evaluated geometry for a single event at a given time. */
export interface EvaluatedEvent {
  readonly eventId: string;
  readonly branchId: number;
  readonly kind: string;
  readonly progressPpm: number;
  /** Interpolated q4 values at this progress. */
  readonly currentQ4: Readonly<Record<string, number>>;
  /** Whether the event has fully materialized (progress = 1_000_000). */
  readonly materialized: boolean;
}

/**
 * Evaluate a single growth event at a given timestamp.
 */
export function evaluateEvent(
  event: Readonly<GrowthEventV1>,
  segmentStartMs: number,
  nowMs: number,
): EvaluatedEvent {
  const progressPpm = computeEventProgressPpm(event, segmentStartMs, nowMs);

  const currentQ4: Record<string, number> = {};
  for (const key of Object.keys(event.fromQ4)) {
    const from = event.fromQ4[key];
    const to = event.toQ4[key];
    if (from !== undefined && to !== undefined) {
      currentQ4[key] = interpolateQ4(from, to, progressPpm);
    }
  }

  return {
    eventId: event.eventId,
    branchId: event.branchId,
    kind: event.kind,
    progressPpm,
    currentQ4,
    materialized: progressPpm >= PROGRESS_SCALE,
  };
}

/**
 * Evaluate all events in a segment at a given timestamp.
 * Returns only events whose segment matches.
 */
export function evaluateSegmentEvents(
  events: readonly Readonly<GrowthEventV1>[],
  segmentIndex: 0 | 1,
  segmentStartMs: number,
  nowMs: number,
): EvaluatedEvent[] {
  return events
    .filter(e => e.segmentIndex === segmentIndex)
    .map(e => evaluateEvent(e, segmentStartMs, nowMs));
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.3 — Boundary materialization
// ═══════════════════════════════════════════════════════════════════════════

export type BoundaryKind = 'segment-0-close' | 'day-close';

export interface BoundaryResult {
  readonly kind: BoundaryKind;
  readonly boundaryMs: number;
  /** Events that were fully materialized at this boundary. */
  readonly materializedEventIds: readonly string[];
  /** Whether this is a day close (advances age/daily systems). */
  readonly advancesDay: boolean;
}

/**
 * Determine which boundaries need processing between `fromMs` and `toMs`
 * for a tree born at `bornAtMs`.
 *
 * Returns boundaries in chronological order.
 * Each boundary is idempotent on (treeId, boundaryMs, engineVersion).
 */
export function findPendingBoundaries(
  bornAtMs: number,
  fromMs: number,
  toMs: number,
): BoundaryResult[] {
  const boundaries: BoundaryResult[] = [];
  if (toMs <= fromMs) return boundaries;

  const fromClock = computeClockState(fromMs, bornAtMs);
  const toClock = computeClockState(toMs, bornAtMs);
  if (!fromClock || !toClock) return boundaries;

  // Walk day by day from fromClock.dayIndex to toClock.dayIndex
  for (let day = fromClock.dayIndex; day <= toClock.dayIndex; day++) {
    const dayStartMs = bornAtMs + day * GAME_DAY_MS;

    // Segment 0 close = dayStart + DISPLAY_SEGMENT_MS
    const seg0CloseMs = dayStartMs + DISPLAY_SEGMENT_MS;
    if (seg0CloseMs > fromMs && seg0CloseMs <= toMs) {
      boundaries.push({
        kind: 'segment-0-close',
        boundaryMs: seg0CloseMs,
        materializedEventIds: [], // Filled by caller after evaluation
        advancesDay: false,
      });
    }

    // Day close = dayStart + GAME_DAY_MS
    const dayCloseMs = dayStartMs + GAME_DAY_MS;
    if (dayCloseMs > fromMs && dayCloseMs <= toMs) {
      boundaries.push({
        kind: 'day-close',
        boundaryMs: dayCloseMs,
        materializedEventIds: [],
        advancesDay: true,
      });
    }
  }

  return boundaries;
}

/**
 * Compute the evaluated q4 values for a branch by applying all its
 * materialized and in-progress events at a given timestamp.
 *
 * Returns a map of property name → current q4 value.
 * This is what the renderer and stat deriver consume.
 */
export function evaluateBranchGeometry(
  branchId: number,
  events: readonly Readonly<GrowthEventV1>[],
  segmentStartMs: number,
  nowMs: number,
): Record<string, number> {
  const branchEvents = events.filter(e => e.branchId === branchId);
  const result: Record<string, number> = {};

  for (const event of branchEvents) {
    const evaluated = evaluateEvent(event, segmentStartMs, nowMs);
    for (const [key, value] of Object.entries(evaluated.currentQ4)) {
      // Later events overwrite earlier ones for the same property
      result[key] = value;
    }
  }

  return result;
}

/**
 * Convert evaluated q4 geometry back to float values for the renderer.
 * This is the only place q4 → float conversion happens (renderer edge, §4.3).
 */
export function q4ToRenderValues(q4Values: Readonly<Record<string, number>>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(q4Values)) {
    result[key] = fromQ4(value);
  }
  return result;
}
