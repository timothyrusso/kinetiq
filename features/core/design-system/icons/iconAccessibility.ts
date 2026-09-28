/**
 * The accessibility props of an icon, labelled or decorative.
 *
 * A decorative icon is hidden from the tree on both platforms, and on iOS also from the label a
 * pressable parent assembles out of its children. An icon font is text, and that text is a
 * private-use glyph: `accessible: false` alone keeps it from being focused but not from being
 * collected, so a row read "Bench Press, , 0/5 sets", the chevron spoken as nothing between two commas.
 */
export function iconAccessibility(label: string | undefined) {
  return label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no' as const };
}
