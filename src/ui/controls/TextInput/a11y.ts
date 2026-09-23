/**
 * Android names a Compose text field after its own label slot, so nothing is added here; the
 * iOS file carries the one platform that needs it.
 */
export function fieldLabelModifiers(_label: string): never[] {
  return [];
}
