import { Schema } from 'effect';

/**
 * What the `extra` block of `app.json` must hold. A missing or invalid field fails the boot.
 * Nothing yet: the exercise catalog is bundled and the app calls no server, so there is no
 * endpoint to configure. The block itself must still be an object.
 */
export const AppConfigSchema = Schema.Struct({});

export type AppConfigValues = typeof AppConfigSchema.Type;
