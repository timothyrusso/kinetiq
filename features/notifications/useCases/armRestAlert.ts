import { Effect } from 'effect';
import { tr } from '@/features/core/translations';
import type { RestNextUp } from '@/features/notifications/domain/entities/RestNextUp';
import { postNotification } from '@/features/notifications/useCases/postNotification';

/** An exercise with sets left is not done, so only its next set is named. */
function restBody(exerciseName: string, next: RestNextUp): string {
  switch (next.kind) {
    case 'set':
      return tr('push.restNextSet', { name: exerciseName, set: next.set, total: next.total });
    case 'exercise':
      return tr('push.restNext', { name: exerciseName, next: next.name });
    case 'none':
      return tr('push.restLast', { name: exerciseName });
  }
}

/**
 * Arms the alert for the end of a rest, and succeeds with its identifier, or `null` when the
 * system does not allow notifications: the rest timer counts on screen either way, so a denial
 * degrades to a quiet rest and is not a failure.
 *
 * `delaySeconds` is the time REMAINING, not the rest's configured length: the trigger counts
 * from now, so re-arming a rest that already ran 40 of its 90 seconds with 90 would push the
 * alert a minute and a half late. The caller keeps the identifier so an early next set can
 * retract exactly this alert.
 */
export const armRestAlert = (exerciseName: string, next: RestNextUp, delaySeconds: number) =>
  postNotification({
    content: { title: tr('push.restComplete'), body: restBody(exerciseName, next) },
    trigger: { kind: 'afterSeconds', seconds: Math.max(1, Math.round(delaySeconds)) },
  }).pipe(Effect.catchTag('NotificationPermissionDenied', () => Effect.succeed(null)));
