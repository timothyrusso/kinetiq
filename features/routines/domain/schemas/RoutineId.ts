import { Schema } from 'effect';

/**
 * A routine's id. Routines made on this device are `rtn_<time><counter><random>`; the Schema asks
 * only for a non-empty string, so a routine stored or imported under another spelling still opens.
 */
export const RoutineId = Schema.NonEmptyString.pipe(Schema.brand('RoutineId'));

export type RoutineId = typeof RoutineId.Type;
