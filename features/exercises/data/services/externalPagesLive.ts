import { Effect, Layer } from 'effect';
import * as Linking from 'expo-linking';
import { toAppError } from '@/features/core/error';
import { ExternalPages } from '@/features/exercises/domain/services/ExternalPages';

/** `ExternalPages` over the system's URL handler. */
export const ExternalPagesLive = Layer.succeed(ExternalPages, {
  open: url => Effect.tryPromise({ try: () => Linking.openURL(url), catch: cause => toAppError(cause) }),
});
