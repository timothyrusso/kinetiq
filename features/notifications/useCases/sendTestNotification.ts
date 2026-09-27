import { Effect } from 'effect';
import { tr } from '@/features/core/translations';
import { postNotification } from '@/features/notifications/useCases/postNotification';

/**
 * An immediate alert with honest "this is a test" copy, for the settings screen that offers to
 * prove delivery works. Not the rest alert: its body is about the next exercise, which reads as
 * nonsense in a test. Immediate, so there is nothing to retract. The copy is written when it
 * runs, in the language of that moment.
 */
export const sendTestNotification = Effect.suspend(() =>
  postNotification({ content: { title: tr('push.testTitle'), body: tr('push.testBody') }, trigger: null }),
);
