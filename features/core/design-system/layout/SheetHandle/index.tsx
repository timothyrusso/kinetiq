/**
 * The drag handle at the top of a form sheet. iOS draws its own grabber (`sheetGrabberVisible`
 * in `formSheet`), so there is nothing to draw here; Android's sheet has no grabber option, and
 * gets Material 3's drag handle in `index.android.tsx`.
 */
export function SheetHandle() {
  return null;
}
