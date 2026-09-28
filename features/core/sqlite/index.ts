import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { SqlError, SqliteClient, type SqliteDatabase, trySql, withSqlite } from '@timothyrusso/effect-core';
export { migrations } from '@/features/core/sqlite/data/migrations';
export { makeSchemaStatus } from '@/features/core/sqlite/data/sqliteClientLive';
export { SqliteLive } from '@/features/core/sqlite/di/layer';
export { type SchemaReport, SchemaStatus } from '@/features/core/sqlite/domain/services/SchemaStatus';
export { clearAllUserData } from '@/features/core/sqlite/useCases/clearAllUserData';
export { resetLocalData } from '@/features/core/sqlite/useCases/resetLocalData';
