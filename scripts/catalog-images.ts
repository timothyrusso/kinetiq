/**
 * Regenerates the bundled photos' `require` map: `npm run catalog:images`. Run it after every
 * edit of `assets/catalog/exercises.json` or `pendingPhotos.json`; the map's test fails until
 * it has been.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CATALOG_IMAGES_OUTPUT, readCatalogImageInputs, renderCatalogImages } from '@/scripts/catalogImages';

const { exercises, pending } = readCatalogImageInputs();
writeFileSync(resolve(__dirname, '..', CATALOG_IMAGES_OUTPUT), renderCatalogImages(exercises, pending));
console.log(`Wrote ${CATALOG_IMAGES_OUTPUT}: ${exercises.length - pending.length} exercises with photos.`);
