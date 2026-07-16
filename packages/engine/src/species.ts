import type { SpeciesClass } from '@kijo/shared';

export interface SpeciesParams {
  growthRate: number;    // base extension per tick
  forkChance: number;    // base fork probability per tip per tick
  forkAngle: number;     // degrees; hardwoods wide, tropicals tight (GDD §3.3)
  thickenRate: number;   // trunk/inner thickening per tick
  moistureDecay: number; // per day
}

export const SPECIES: Record<SpeciesClass, SpeciesParams> = {
  hardwood:  { growthRate: 0.6, forkChance: 0.10, forkAngle: 45, thickenRate: 0.08, moistureDecay: 4 },
  evergreen: { growthRate: 0.8, forkChance: 0.12, forkAngle: 30, thickenRate: 0.05, moistureDecay: 5 },
  tropical:  { growthRate: 1.2, forkChance: 0.16, forkAngle: 20, thickenRate: 0.03, moistureDecay: 7 }
};
