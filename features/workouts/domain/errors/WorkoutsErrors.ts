import { ActivityNotFound } from '@/features/workouts/domain/errors/ActivityNotFound';
import { DuplicateWorkout } from '@/features/workouts/domain/errors/DuplicateWorkout';
import { NoActiveSession } from '@/features/workouts/domain/errors/NoActiveSession';
import { SessionAlreadyActive } from '@/features/workouts/domain/errors/SessionAlreadyActive';
import { SessionPersistFailed } from '@/features/workouts/domain/errors/SessionPersistFailed';

export { ActivityNotFound, DuplicateWorkout, NoActiveSession, SessionAlreadyActive, SessionPersistFailed };

declare module '@/features/core/error' {
  interface AppErrorRegistry {
    workouts: SessionAlreadyActive | NoActiveSession | DuplicateWorkout | SessionPersistFailed | ActivityNotFound;
  }
}
