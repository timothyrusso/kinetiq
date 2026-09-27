/**
 * Regenerates the bundled exercise catalog: `npm run catalog:update`.
 *
 * Downloads the whole wger catalog through the same `downloadWgerCatalog` the app's refresh uses, checks
 * that it looks complete, and writes `assets/catalog/wger.json`. The file is committed and
 * installed into SQLite on first launch, so a fresh install works with no network. Regenerate it
 * by hand before a release: its `generatedAt` starts the 30-day refresh clock on a new install.
 *
 * The output has one exercise per line, sorted by id, so a regeneration diffs as the exercises
 * that actually changed.
 *
 * wger exercise data is licensed CC BY-SA 4.0.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Effect, Schema } from 'effect';

import { AppConfigSchema } from '@/features/core/config/domain/schemas/AppConfigSchema';
import { downloadWgerCatalog } from '@/features/exercises/data/services/downloadWgerCatalog';
import type { CatalogPayload } from '@/features/exercises/domain/schemas/CatalogPayloadSchema';

const OUTPUT = resolve(__dirname, '../assets/catalog/wger.json');
const APP_JSON = resolve(__dirname, '../app.json');
const MIN_EXERCISES = 800;
const RETRIES = 3;

async function fetchJson(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.ok) return response.json();
    // NOTE: wger rate-limits and occasionally 5xxs; anything else is a real error.
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= RETRIES) throw new Error(`${response.status} for ${url}`);
    await new Promise(done => setTimeout(done, 2_000 * attempt));
  }
}

function validate(payload: CatalogPayload): void {
  const problems: string[] = [];
  if (payload.exercises.length < MIN_EXERCISES) {
    problems.push(`only ${payload.exercises.length} exercises (expected at least ${MIN_EXERCISES})`);
  }
  if (payload.categories.length === 0) problems.push('no categories');
  if (payload.equipment.length === 0) problems.push('no equipment');
  if (payload.muscles.length === 0) problems.push('no muscles');
  if (problems.length > 0) throw new Error(`Refusing to write the catalog: ${problems.join(', ')}`);
}

function serialise(payload: CatalogPayload): string {
  const { exercises, ...head } = payload;
  const lines = exercises.map(exercise => `  ${JSON.stringify(exercise)}`);
  const header = JSON.stringify(head).slice(0, -1);
  return `${header},"exercises":[\n${lines.join(',\n')}\n]}\n`;
}

/** The wger root the app downloads from: `extra.wgerBaseUrl` in `app.json`, decoded as the app decodes it. */
function wgerBaseUrl(): string {
  const appJson = Schema.Struct({ expo: Schema.Struct({ extra: AppConfigSchema }) });
  return Schema.decodeUnknownSync(Schema.parseJson(appJson))(readFileSync(APP_JSON, 'utf8')).expo.extra.wgerBaseUrl;
}

async function main(): Promise<void> {
  const payload = await Effect.runPromise(
    downloadWgerCatalog(
      wgerBaseUrl(),
      url => Effect.tryPromise({ try: () => fetchJson(url), catch: cause => cause }),
      (endpoint, cause) => new Error(`${endpoint} is not the shape the catalog reads: ${cause.message}`),
    ),
  );
  validate(payload);
  const text = serialise(payload);
  writeFileSync(OUTPUT, text);

  const italian = payload.exercises.filter(e => e.translations.it !== undefined).length;
  const english = payload.exercises.filter(e => e.translations.en !== undefined).length;
  console.log(
    [
      `wrote ${OUTPUT} (${(text.length / 1024 / 1024).toFixed(2)} MB)`,
      `generatedAt ${new Date(payload.generatedAt).toISOString()}`,
      `${payload.exercises.length} exercises: ${english} in English, ${italian} in Italian`,
      `${payload.categories.length} categories, ${payload.equipment.length} equipment, ${payload.muscles.length} muscles`,
    ].join('\n'),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
