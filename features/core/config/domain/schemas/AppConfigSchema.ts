import { Schema } from 'effect';

/**
 * What the `extra` block of `app.json` must hold. A missing or invalid field fails the boot.
 * `wgerBaseUrl` is the wger REST API root the exercise catalog downloads from, with its trailing
 * slash.
 */
export const AppConfigSchema = Schema.Struct({
  wgerBaseUrl: Schema.String.pipe(Schema.pattern(/^https:\/\/.+\/$/)),
});

export type AppConfigValues = typeof AppConfigSchema.Type;
