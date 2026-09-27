/** Database row shapes, mirroring the v-current schema 1:1. */

export type ActivityRow = {
  id: string;
  kind: string;
  title: string;
  started_at: number;
  duration_seconds: number;
  calories_kcal: number;
  notes: string | null;
  source_session_id: string | null;
  entries_json: string | null;
  volume_kg: number | null;
  total_sets: number | null;
  created_at: number;
};

export type SessionRow = {
  id: string;
  routine_id: string | null;
  routine_name: string;
  started_at: number;
  elapsed_seconds: number;
  status: string;
  entries_json: string;
  active_index: number;
  rest_ends_at: number | null;
  rest_duration: number | null;
  notes: string | null;
  updated_at: number;
};

export type RecordRow = {
  exercise_id: string;
  kind: string;
  exercise_name: string;
  value: number;
  achieved_at: number;
};
