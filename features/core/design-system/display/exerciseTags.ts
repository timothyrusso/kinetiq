/**
 * An exercise's taxonomy as tags: its primary muscles, then its category (its body area) when no
 * muscle already says the same thing.
 *
 * The two overlap (a shoulder press is body area Shoulders with primary muscle Shoulders), and
 * printing both reads as a duplication bug rather than as two facts that coincide. Compared
 * case-insensitively: a stored copy may spell either its own way.
 */
import type { Tag } from '@/features/core/design-system/display/types';

export function exerciseTags(exercise: { primaryMuscles: readonly string[]; category: string | null }): Tag[] {
  const tags: Tag[] = exercise.primaryMuscles.map(muscle => ({ key: `m:${muscle}`, label: muscle }));
  const category = exercise.category;
  if (category && !exercise.primaryMuscles.some(m => m.toLowerCase() === category.toLowerCase())) {
    tags.push({ key: `c:${category}`, label: category, tone: 'accent' });
  }
  return tags;
}

/**
 * The tags an exercise editor shows above the library's About block: the taxonomy, then each
 * piece of equipment.
 */
export function exerciseLibraryTags(exercise: {
  primaryMuscles: readonly string[];
  category: string | null;
  equipment: readonly string[];
}): Tag[] {
  return [...exerciseTags(exercise), ...exercise.equipment.map(gear => ({ key: `e:${gear}`, label: gear }))];
}
