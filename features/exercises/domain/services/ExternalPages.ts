import { Context, type Effect } from 'effect';
import type { UnexpectedError } from '@/features/core/error';

/** Opens a web page outside the app: an exercise's page on wger. */
export class ExternalPages extends Context.Tag('exercises/ExternalPages')<
  ExternalPages,
  {
    /** Hands `url` to the system; a device that refuses it fails with `UnexpectedError`. */
    readonly open: (url: string) => Effect.Effect<void, UnexpectedError>;
  }
>() {}
