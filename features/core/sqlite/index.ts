import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { SqlError, SqliteClient, trySql, withSqlite } from '@timothyrusso/effect-core';
export { openAppDatabase } from '@/features/core/sqlite/data/appDatabase';
export { migrations } from '@/features/core/sqlite/data/migrations';
export { CATALOG_SCHEMA } from '@/features/core/sqlite/data/migrations/v009';
export { SqliteLive } from '@/features/core/sqlite/di/layer';
export { clearAllUserData } from '@/features/core/sqlite/useCases/clearAllUserData';
