import Foundation

/// `kinetiq.watch-routines` v2, phone to watch (issues #27 and #108). Mirrors `features/watch-bridge/domain/schemas`.
public struct RoutinesSnapshot: Codable, Equatable, Sendable {
    public static let format = "kinetiq.watch-routines"
    public static let version = 2

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
    /// One row per planned set, in order.
    public let sets: [RoutineSet]
    /// One rest for every set of the exercise.
    public let restSeconds: Int
    public let notes: String?

    public init(
        id: String,
        exerciseId: String,
        exerciseName: String,
        sets: [RoutineSet],
        restSeconds: Int,
        notes: String?
    ) {
        self.id = id
        self.exerciseId = exerciseId
        self.exerciseName = exerciseName
        self.sets = sets
        self.restSeconds = restSeconds
        self.notes = notes
    }
}

/// The targets one set of a workout opens with.
public struct RoutineSet: Codable, Equatable, Sendable {
    public let reps: Int
    public let weightKg: Double
    /// The set's starting RPE on the watch, which the rest screen adjusts (issue #132).
    public let targetRpe: Double?

    public init(reps: Int, weightKg: Double, targetRpe: Double?) {
        self.reps = reps
        self.weightKg = weightKg
        self.targetRpe = targetRpe
    }
}
