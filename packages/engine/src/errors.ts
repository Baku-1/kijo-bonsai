/**
 * CareLogReplayError — thrown when care log replay encounters invalid inputs or
 * unresolvable state. Separated from CareLogReplay.ts so that BonsaiTree.ts
 * and engine method stubs can import it without creating a circular dependency
 * (CareLogReplay.ts imports BonsaiTree.ts; BonsaiTree.ts cannot import
 * CareLogReplay.ts without a cycle).
 *
 * CareLogReplay.ts imports and re-exports this class to preserve the existing
 * public API surface (CareLogReplay.CareLogReplayError consumers are unaffected).
 */
export class CareLogReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CareLogReplayError';
  }
}
