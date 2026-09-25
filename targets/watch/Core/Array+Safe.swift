/// Bounds-checked access, the only way `Core/` reads or writes an array element by position.
///
/// Stability rule 5 in issue #27: an out-of-range index is a crash, and a crash in the middle of
/// a workout is exactly what the watch app must never do. SwiftLint's `unsafe_subscript` rule
/// rejects `array[i]` in `Core/`; this returns `nil` instead, and a write out of range (or of
/// `nil`) changes nothing.
public extension Array {
    subscript(safe index: Int) -> Element? {
        get {
            indices.contains(index) ? self[index] : nil
        }
        set {
            guard indices.contains(index), let newValue else { return }
            self[index] = newValue
        }
    }
}
