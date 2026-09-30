/**
 * What follows a rest, as its alert words it: the next set of the exercise just rested from, the
 * next exercise with work open once that one is done, or nothing, when the workout is.
 */
export type RestNextUp =
  | { readonly kind: 'set'; readonly set: number; readonly total: number }
  | { readonly kind: 'exercise'; readonly name: string }
  | { readonly kind: 'none' };
