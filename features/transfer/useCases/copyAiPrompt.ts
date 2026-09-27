import { Effect } from 'effect';
import { TransferDevice } from '@/features/transfer/domain/services/TransferDevice';

/** Puts the prompt that describes the routines file on the clipboard, for any AI chat to answer. */
export const copyAiPrompt = (prompt: string) =>
  Effect.flatMap(TransferDevice, device => device.copyToClipboard(prompt));
