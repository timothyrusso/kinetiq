import { RoutineNameTaken } from '@/features/routines/domain/errors/RoutineNameTaken';
import { RoutineNotFound } from '@/features/routines/domain/errors/RoutineNotFound';

export { RoutineNameTaken, RoutineNotFound };

declare module '@/features/core/error' {
  interface AppErrorRegistry {
    routines: RoutineNotFound | RoutineNameTaken;
  }
}
