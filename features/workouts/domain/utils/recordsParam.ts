import { Option, Schema } from 'effect';
import { type PersonalRecord, PersonalRecordSchema } from '@/features/workouts/domain/schemas/PersonalRecordSchema';

const RecordsParam = Schema.parseJson(Schema.Array(PersonalRecordSchema));

/**
 * The records a finish hands to the records sheet as its route param. A param that is missing or
 * not a list of records reads as none: the sheet then says nothing rather than something wrong.
 */
export function decodeRecordsParam(raw: string | undefined): readonly PersonalRecord[] {
  return Option.getOrElse(Schema.decodeUnknownOption(RecordsParam)(raw ?? '[]'), () => []);
}
