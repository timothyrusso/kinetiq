/**
 * The field's spoken name, as a SwiftUI modifier.
 *
 * Expo UI's text field has no `accessibilityLabel` prop. SwiftUI would name the field after its
 * placeholder, but a coloured placeholder is drawn as a custom prompt view, and the field then
 * reached VoiceOver with no name at all.
 */
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';

export function fieldLabelModifiers(label: string) {
  return [accessibilityLabel(label)];
}
