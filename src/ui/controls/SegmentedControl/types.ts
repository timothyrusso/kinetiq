/**
 * A choice between two to four short options, shown side by side.
 *
 * Text-only by design: both platforms' native segmented controls take a label per segment, and
 * a segment that needs an icon to be understood is a sign the choice wants a picker instead.
 */
export type Segment<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (next: T) => void;
};
