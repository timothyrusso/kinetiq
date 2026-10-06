import Foundation

/// `kinetiq.watch-routines` v3, phone to watch (issues #27, #108 and #194). Mirrors
/// `features/watch-bridge/domain/schemas`: every item carries its tracking type and every set the
/// same tag as its own `type`.
public struct RoutinesSnapshot: Codable, Equatable, Sendable {
    public static let format = "kinetiq.watch-routines"
    public static let version = 3

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
    public let trackingType: TrackingType
    /// One row per planned set, in order, each of `trackingType`.
    public let sets: [RoutineSet]
    /// One rest for every set of the exercise.
    public let restSeconds: Int
    public let notes: String?

    public init(
        id: String,
        exerciseId: String,
        exerciseName: String,
        trackingType: TrackingType,
        sets: [RoutineSet],
        restSeconds: Int,
        notes: String?
    ) {
        self.id = id
        self.exerciseId = exerciseId
        self.exerciseName = exerciseName
        self.trackingType = trackingType
        self.sets = sets
        self.restSeconds = restSeconds
        self.notes = notes
    }
}

/// The targets one set of a workout opens with. On the wire a set holds only its own type's
/// values: `reps` and `weightKg`, `reps` alone, or `durationSeconds`. The others decode as nil,
/// and `SnapshotValidator` refuses a set missing one its type needs.
public struct RoutineSet: Codable, Equatable, Sendable {
    public let type: TrackingType
    public let reps: Int?
    public let weightKg: Double?
    public let durationSeconds: Int?
    /// The set's starting RPE on the watch, which the rest screen adjusts (issue #132).
    public let targetRpe: Double?

    public init(type: TrackingType, reps: Int?, weightKg: Double?, durationSeconds: Int?, targetRpe: Double?) {
        self.type = type
        self.reps = reps
        self.weightKg = weightKg
        self.durationSeconds = durationSeconds
        self.targetRpe = targetRpe
    }

    public static func weightReps(reps: Int, weightKg: Double, targetRpe: Double? = nil) -> RoutineSet {
        RoutineSet(type: .weightReps, reps: reps, weightKg: weightKg, durationSeconds: nil, targetRpe: targetRpe)
    }

    public static func repsOnly(reps: Int, targetRpe: Double? = nil) -> RoutineSet {
        RoutineSet(type: .repsOnly, reps: reps, weightKg: nil, durationSeconds: nil, targetRpe: targetRpe)
    }

    public static func duration(seconds: Int, targetRpe: Double? = nil) -> RoutineSet {
        RoutineSet(type: .duration, reps: nil, weightKg: nil, durationSeconds: seconds, targetRpe: targetRpe)
    }
}
