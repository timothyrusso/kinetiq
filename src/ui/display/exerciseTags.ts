/**
 * An exercise's taxonomy as tags: its primary muscles, then its category when no muscle
 * already says the same thing.
 *
 * wger's two taxonomies overlap ("Arnold Shoulder Press" is category Shoulders with primary
 * muscle Shoulders), and printing both reads as a duplication bug rather than as two facts that
 * coincide. Compared case-insensitively: the taxonomies are maintained separately.
 */
import type { Tag } from './types';

export function exerciseTags(exercise: {
  primaryMuscles: readonly string[];
  category: string | null;
}): Tag[] {
  const tags: Tag[] = exercise.primaryMuscles.map((muscle) => ({ key: `m:${muscle}`, label: muscle }));
  const category = exercise.category;
  if (category && !exercise.primaryMuscles.some((m) => m.toLowerCase() === category.toLowerCase())) {
    tags.push({ key: `c:${category}`, label: category, tone: 'accent' });
  }
  return tags;
}
