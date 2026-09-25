/** Database row shapes, mirroring the v-current schema 1:1. */

export type ActivityRow = {
  id: string;
  kind: string;
  title: string;
  started_at: number;
  duration_seconds: number;
  calories_kcal: number;
  notes: string | null;
  seeded: number;
  source_session_id: string | null;
  entries_json: string | null;
  volume_kg: number | null;
  total_sets: number | null;
  created_at: number;
};

export type RoutineRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
  times_completed: number;
  last_performed_at: number | null;
  seeded: number;
};

export type RoutineItemRow = {
  id: string;
  routine_id: string;
  exercise_id: string;
  exercise_name: string;
  position: number;
  sets: number;
  reps: string;
  weight_kg: number;
  rest_seconds: number;
  notes: string | null;
};

export type ExerciseRow = {
  id: string;
  external_id: number | null;
  name: string;
  instructions: string | null;
  category: string | null;
  primary_muscles: string;
  secondary_muscles: string;
  equipment: string;
  image_url: string | null;
  thumbnail_url: string | null;
  source: string;
  captured_at: number;
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

export type SettingsRow = {
  key: string;
  value_json: string;
  updated_at: number;
};
