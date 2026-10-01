/**
 * One-off import of free-exercise-db (Unlicense, public domain) into `assets/catalog`:
 * `npx tsx scripts/import-fedb.ts <path to a free-exercise-db checkout>`.
 *
 * Reads the checkout at the pinned commit, writes `exercises.json` (English filled, Italian left
 * empty for the translation pass), `version.json`, `index.json`, `pendingPhotos.json` and the WebP
 * frames and thumbnails. Deleted once the dataset is committed: from then on `exercises.json` is
 * edited by hand and nothing is pulled from upstream again.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PINNED_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const DATASET_VERSION = 1;
const OUTPUT = resolve(__dirname, '../assets/catalog');
const FRAME = ['-m', '6', '-q', '50', '-resize', '560', '0', '-metadata', 'none'];
const THUMB = ['-m', '6', '-q', '60', '-resize', '160', '0', '-metadata', 'none'];

interface Source {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

const BODY_AREA: Record<string, string> = {
  abdominals: 'abs',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  chest: 'chest',
  lats: 'back',
  'middle-back': 'back',
  'lower-back': 'back',
  traps: 'back',
  shoulders: 'shoulders',
  neck: 'shoulders',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  calves: 'calves',
};

const EQUIPMENT: Record<string, string> = {
  'body only': 'body-only',
  machine: 'machine',
  other: 'other',
  'foam roll': 'foam-roll',
  kettlebells: 'kettlebell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  barbell: 'barbell',
  bands: 'band',
  'medicine ball': 'medicine-ball',
  'exercise ball': 'exercise-ball',
  'e-z curl bar': 'ez-bar',
};

/** The en and em dash, spelled by code point so this file holds neither. */
const DASHES = new RegExp(`\\s*[${String.fromCharCode(0x2013, 0x2014)}]\\s*`, 'g');

const kebab = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const clean = (text: string) => text.replace(DASHES, ', ').replace(/\s+/g, ' ').trim();

const muscleKey = (muscle: string) => {
  const key = kebab(muscle);
  if (BODY_AREA[key] === undefined) throw new Error(`unknown muscle ${muscle}`);
  return key;
};

const equipmentKey = (equipment: string | null) => {
  if (equipment === null) return 'other';
  const key = EQUIPMENT[equipment];
  if (key === undefined) throw new Error(`unknown equipment ${equipment}`);
  return key;
};

function bodyAreaOf(primary: string[], secondary: string[], trainingType: string): string {
  if (trainingType === 'cardio') return 'cardio';
  const muscle = primary[0] ?? secondary[0];
  if (muscle === undefined) return 'abs';
  const area = BODY_AREA[muscle];
  if (area === undefined) throw new Error(`unknown muscle ${muscle}`);
  return area;
}

function convert(source: string, target: string, args: string[]): void {
  execFileSync('cwebp', ['-quiet', ...args, source, '-o', target]);
}

function main(): void {
  const root = process.argv[2];
  if (root === undefined) throw new Error('usage: tsx scripts/import-fedb.ts <free-exercise-db checkout>');
  const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== PINNED_COMMIT) throw new Error(`checkout is at ${head}, expected ${PINNED_COMMIT}`);

  const sources: Source[] = JSON.parse(readFileSync(resolve(root, 'dist/exercises.json'), 'utf8'));
  const pending: string[] = [];
  let imageBytes = 0;

  const exercises = sources.map(source => {
    const slug = kebab(source.id);
    const id = `ex:${slug}`;
    const primaryMuscles = source.primaryMuscles.map(muscleKey);
    const secondaryMuscles = source.secondaryMuscles.map(muscleKey);
    const folder = `images/${slug}`;
    const images = { start: `${folder}/0.webp`, end: `${folder}/1.webp`, thumb: `${folder}/thumb.webp` };

    const [start, end] = source.images.map(image => resolve(root, 'exercises', image));
    if (start !== undefined && end !== undefined && existsSync(start) && existsSync(end)) {
      mkdirSync(resolve(OUTPUT, folder), { recursive: true });
      convert(start, resolve(OUTPUT, images.start), FRAME);
      convert(end, resolve(OUTPUT, images.end), FRAME);
      convert(start, resolve(OUTPUT, images.thumb), THUMB);
      for (const path of Object.values(images)) imageBytes += statSync(resolve(OUTPUT, path)).size;
    } else {
      pending.push(id);
    }

    return {
      id,
      name: { en: clean(source.name), it: '' },
      instructions: { en: source.instructions.map(clean).filter(step => step.length > 0), it: [] as string[] },
      bodyArea: bodyAreaOf(primaryMuscles, secondaryMuscles, source.category),
      trainingType: source.category,
      level: source.level,
      force: source.force,
      mechanic: source.mechanic,
      primaryMuscles,
      secondaryMuscles,
      equipment: equipmentKey(source.equipment),
      images,
    };
  });

  exercises.sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(exercises.map(exercise => exercise.id)).size !== exercises.length) throw new Error('duplicate ids');

  const lines = exercises.map(exercise => `  ${JSON.stringify(exercise)}`);
  writeFileSync(
    resolve(OUTPUT, 'exercises.json'),
    `{"datasetVersion":${DATASET_VERSION},"exercises":[\n${lines.join(',\n')}\n]}\n`,
  );
  writeFileSync(resolve(OUTPUT, 'version.json'), `${JSON.stringify({ datasetVersion: DATASET_VERSION })}\n`);
  const index = exercises.map(({ id, name, primaryMuscles, equipment }) => [id, name.en, primaryMuscles, equipment]);
  writeFileSync(
    resolve(OUTPUT, 'index.json'),
    `{"fields":["id","name","primaryMuscles","equipment"],"exercises":[\n${index.map(entry => JSON.stringify(entry)).join(',\n')}\n]}\n`,
  );
  writeFileSync(resolve(OUTPUT, 'pendingPhotos.json'), `${JSON.stringify(pending.sort(), null, 2)}\n`);

  console.log(
    [
      `${exercises.length} exercises from free-exercise-db ${head}`,
      `images ${(imageBytes / 1_000_000).toFixed(2)} MB, ${pending.length} pending: ${pending.join(', ')}`,
    ].join('\n'),
  );
}

main();
