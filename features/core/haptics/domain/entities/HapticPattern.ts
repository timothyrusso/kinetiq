/**
 * The feedback vocabulary: the platform's everyday patterns, then the signature moments. Each
 * member plays one pattern.
 */
export interface HapticVocabulary {
  /** Lightest acknowledgment: a chip selected, a segment of a control chosen. */
  readonly light: () => void;
  /** Default for pressing something that does something. */
  readonly medium: () => void;
  /** Committing something with weight: starting a workout, a long-press lift. */
  readonly heavy: () => void;
  /** Navigating between equal options, e.g. wheel or segmented pickers. */
  readonly selection: () => void;
  /** Something saved, imported or granted. */
  readonly success: () => void;
  /** Something needs attention: a failed save, a confirm about to destroy data. */
  readonly warning: () => void;
  /** Refusing an action: an empty form, a discarded session. */
  readonly error: () => void;
  /** A set ticked: a solid click-and-lock, the feel of a plate seating on the bar. */
  readonly setCompleted: () => void;
  /** One of the last seconds of a rest. Small on purpose: three of these in a row. */
  readonly restTick: () => void;
  /** The rest is over: a rising push, distinct from the ticks before it. */
  readonly restOver: () => void;
  /** A personal record, when its sheet appears. */
  readonly personalRecord: () => void;
  /** A workout finished and saved. */
  readonly workoutFinished: () => void;
  /** The workout that met this week's goal: replaces `workoutFinished` for that one. */
  readonly weeklyGoalReached: () => void;
}

/** One pattern of the vocabulary, by name. */
export type HapticPattern = keyof HapticVocabulary;
