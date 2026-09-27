import { useEffectMutation } from '@/features/core/query';
import { copyAiPrompt } from '@/features/transfer/useCases/copyAiPrompt';

/** Copies the AI prompt to the clipboard. */
export function useCopyAiPrompt() {
  return useEffectMutation({ mutationFn: (prompt: string) => copyAiPrompt(prompt) });
}
