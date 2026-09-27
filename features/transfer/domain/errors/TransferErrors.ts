import { ImportTooLarge } from '@/features/transfer/domain/errors/ImportTooLarge';
import { ImportUnreadable } from '@/features/transfer/domain/errors/ImportUnreadable';

export { ImportTooLarge, ImportUnreadable };

declare module '@/features/core/error' {
  interface AppErrorRegistry {
    transfer: ImportTooLarge | ImportUnreadable;
  }
}
