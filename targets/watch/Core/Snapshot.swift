import Foundation

/// `kinetiq.watch-routines` v1, phone to watch (issue #27). Mirrors `src/watch/format.ts`.
public struct RoutinesSnapshot: Codable, Equatable, Sendable {
    public static let format = "kinetiq.watch-routines"
    public static let version = 1

    public let format: String
    public let version: Int
    public let exportedAt: String
    public let unitSystem: UnitSystem
    public let routines: [Routine]

    public init(format: String, version: Int, exportedAt: String, unitSystem: UnitSystem, routines: [Routine]) {
        self.format = format
        self.version = version
        self.exportedAt = exportedAt
        self.unitSystem = unitSystem
        self.routines = routines
    }
}

public enum UnitSystem: String, Codable, Sendable {
    case metric
    case imperial
}

public struct Routine: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let items: [RoutineItem]

    public init(id: String, name: String, items: [RoutineItem]) {
        self.id = id
        self.name = name
        self.items = items
    }
}

public struct RoutineItem: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let exerciseId: String
    public let exerciseName: String
    public let sets: Int
    /// A number or a range, "8" or "8-12". `Reps.target` reads the number a set starts at.
    public let reps: String
    public let weightKg: Double
    public let restSeconds: Int
    public let notes: String?

    public init(
        id: String,
        exerciseId: String,
        exerciseName: String,
        sets: Int,
        reps: String,
        weightKg: Double,
        restSeconds: Int,
        notes: String?
    ) {
        self.id = id
        self.exerciseId = exerciseId
        self.exerciseName = exerciseName
        self.sets = sets
        self.reps = reps
        self.weightKg = weightKg
        self.restSeconds = restSeconds
        self.notes = notes
    }
}
