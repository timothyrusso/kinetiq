import { Context, type Effect } from 'effect';
import type { AppState } from '@/features/bootstrap/domain/entities/AppState';
import type { UnexpectedError } from '@/features/core/error';

/**
 * The device and the app plumbing the launch sets up before the first frame: the network probe
 * and the query client's adapters, the fonts, the header icons, the native chrome, and the
 * app-state events. Every step but the two slow loads succeeds: a device that refuses a
 * cosmetic call is still a usable device.
 */
export class LaunchEnvironment extends Context.Tag('bootstrap/LaunchEnvironment')<
  LaunchEnvironment,
  {
    /** Starts the connectivity probe and feeds it, and `AppState`, to the query client. */
    readonly installQueryPlumbing: Effect.Effect<void>;
    readonly loadFonts: Effect.Effect<void, UnexpectedError>;
    /** Android's native header takes images, not glyph names: they are rendered once, here. */
    readonly prefetchHeaderIcons: Effect.Effect<void, UnexpectedError>;
    /** Paints the root view and the status bar for the resolved theme, never the preference. */
    readonly paintChrome: (mode: 'light' | 'dark') => Effect.Effect<void>;
    /** Whether the device is online, waiting for the probe's first answer when it has none yet. */
    readonly online: Effect.Effect<boolean>;
    /** The catalog on the device changed: every catalog read re-reads. */
    readonly catalogChanged: Effect.Effect<void>;
    /** The app-state now. */
    readonly appState: Effect.Effect<AppState>;
    /** Calls `listener` on every app-state change, for the life of the process; a second call replaces it. */
    readonly onAppStateChange: (listener: (next: AppState) => void) => Effect.Effect<void>;
  }
>() {}
