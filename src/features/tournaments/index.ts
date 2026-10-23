/**
 * Tournaments module (owner request 2026-10-23, Challonge-style).
 *
 * - engine.ts       pure bracket logic (single/double elimination, round robin, groups → knockout)
 * - service.ts      DB persistence inside transactions (start, report, clear, ranks)
 * - actions.ts      Server Actions (organizers: admin or partner with TOURNAMENT_HOST; players: register)
 * - queries.ts      cached public reads + manage reads
 * - permissions.ts  the only authorization rules for organizers
 */
export const TOURNAMENTS_ENABLED = true as const;
