import Foundation

/// The routine limits, read from `bounds.json`: the same file the phone's editor and importer
/// use (`features/watch-bridge/assets/bounds.json`), shipped in the watch bundle. `check:watch`
/// keeps the copies equal.
public struct Bounds: Decodable, Equatable, Sendable {
    public struct Range: Decodable, Equatable, Sendable {
        public let min: Double
        public let max: Double

        public func contains(_ value: Double) -> Bool {
            value.isFinite && value >= min && value <= max
        }

        public func clamp(_ value: Double) -> Double {
            Swift.min(max, Swift.max(min, value))
        }
    }

    public struct ItemBounds: Decodable, Equatable, Sendable {
        public let sets: Range
        public let reps: Range
        public let weightKg: Range
        public let durationSeconds: Range
        public let rpe: Range
        public let restSeconds: Range
        public let notesLength: Int
    }

    public struct ImportLimits: Decodable, Equatable, Sendable {
        public let routines: Int
        public let itemsPerRoutine: Int
        public let bytes: Int
    }

    public let itemBounds: ItemBounds
    public let importLimits: ImportLimits

    public static func decode(_ data: Data) -> Bounds? {
        try? JSONDecoder().decode(Bounds.self, from: data)
    }

    /// Used only if the bundled file cannot be read, which would be a broken build: the same
    /// numbers, so validation stays on rather than failing open.
    public static let fallback = Bounds(
        itemBounds: ItemBounds(
            sets: Range(min: 1, max: 20),
            reps: Range(min: 1, max: 100),
            weightKg: Range(min: 0, max: 450),
            durationSeconds: Range(min: 5, max: 3600),
            rpe: Range(min: 0, max: 10),
            restSeconds: Range(min: 0, max: 600),
            notesLength: 200
        ),
        importLimits: ImportLimits(routines: 50, itemsPerRoutine: 50, bytes: 1_000_000)
    )
}
