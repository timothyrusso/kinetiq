import type { Migration } from '@timothyrusso/effect-core';
import { v001 } from '@/features/core/sqlite/data/migrations/v001';
import { v002 } from '@/features/core/sqlite/data/migrations/v002';
import { v003 } from '@/features/core/sqlite/data/migrations/v003';
import { v004 } from '@/features/core/sqlite/data/migrations/v004';
import { v005 } from '@/features/core/sqlite/data/migrations/v005';
import { v006 } from '@/features/core/sqlite/data/migrations/v006';
import { v007 } from '@/features/core/sqlite/data/migrations/v007';
import { v008 } from '@/features/core/sqlite/data/migrations/v008';
import { v009 } from '@/features/core/sqlite/data/migrations/v009';
import { v010 } from '@/features/core/sqlite/data/migrations/v010';
import { v011 } from '@/features/core/sqlite/data/migrations/v011';

/**
 * The schema, one step per version, keyed by `PRAGMA user_version`. Never edit a released step:
 * add the next version in its own file. Each step runs in its own exclusive transaction, on a
 * connection where foreign keys are off, so a step that touches references checks them itself.
 */
export const migrations: readonly Migration[] = [v001, v002, v003, v004, v005, v006, v007, v008, v009, v010, v011];
