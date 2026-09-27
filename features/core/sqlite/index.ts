import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { SqlError, SqliteClient, type SqliteDatabase, trySql, withSqlite } from '@timothyrusso/effect-core';
export { migrations } from '@/features/core/sqlite/data/migrations';
export { SqliteLive } from '@/features/core/sqlite/di/layer';
export { SchemaStatus } from '@/features/core/sqlite/domain/services/SchemaStatus';
export { clearAllUserData } from '@/features/core/sqlite/useCases/clearAllUserData';
