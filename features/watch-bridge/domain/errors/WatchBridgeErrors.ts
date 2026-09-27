import { WatchUnavailable } from '@/features/watch-bridge/domain/errors/WatchUnavailable';

export { WatchUnavailable };

declare module '@/features/core/error' {
  interface AppErrorRegistry {
    watchBridge: WatchUnavailable;
  }
}
