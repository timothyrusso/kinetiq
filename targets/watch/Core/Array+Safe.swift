/// Bounds-checked access, the only way `Core/` reads an array element by position.
///
/// Stability rule 5 in issue #27: an out-of-range index is a crash, and a crash in the middle of
/// a workout is exactly what the watch app must never do. SwiftLint's `unsafe_subscript` rule
/// rejects `array[i]` in `Core/`; this returns `nil` instead.
public extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
