/** How far the week is against its goal, as the headline says it. */
export type GoalHeadline = 'nothing' | 'goalMet' | 'onTrack' | 'starting';

/** The week's headline: nothing yet, the goal met, half way or more, or a start. */
export function goalHeadline(workouts: number, goal: number): GoalHeadline {
  if (workouts === 0) return 'nothing';
  if (workouts >= goal) return 'goalMet';
  if (workouts >= goal / 2) return 'onTrack';
  return 'starting';
}
