import Foundation

/// `kinetiq.watch-workout` v3, watch to phone (issues #27, #108 and #194). Mirrors
/// `features/watch-bridge/domain/schemas`: `CompletedWorkout` minus everything the phone computes
/// (duration, volume, set count, estimated 1RM, records). Every entry carries its tracking type
/// and every set the same tag as its `type`, with only that type's values. The phone reads v3 only.
///
/// Encoded by hand so an absent value is written as `null` rather than left out, which is the
/// shape the phone's parser documents, and so a set never carries a value its type does not record.
public struct WorkoutDocument: Encodable, Equatable, Sendable {
    public static let format = "kinetiq.watch-workout"
    public static let version = 3

    public let id: String
    public let routineId: String?
    public let title: String
    public let startedAt: String
    public let endedAt: String
    public let entries: [WorkoutEntry]
    public let notes: String?

    enum Keys: String, CodingKey {
        case format, version, id, routineId, title, startedAt, endedAt, entries, notes
        case exerciseId, exerciseName, trackingType, restSeconds, sets
        case type, index, reps, weightKg, durationSeconds, completed, rpe
    }

    public func encode(to encoder: Encoder) throws {
        var root = encoder.container(keyedBy: Keys.self)
        try root.encode(Self.format, forKey: .format)
        try root.encode(Self.version, forKey: .version)
        try root.encode(id, forKey: .id)
        try encodeOptional(routineId, forKey: .routineId, in: &root)
        try root.encode(title, forKey: .title)
        try root.encode(startedAt, forKey: .startedAt)
        try root.encode(endedAt, forKey: .endedAt)
        try encodeOptional(notes, forKey: .notes, in: &root)
        var list = root.nestedUnkeyedContainer(forKey: .entries)
        for entry in entries {
            var row = list.nestedContainer(keyedBy: Keys.self)
            try row.encode(entry.exerciseId, forKey: .exerciseId)
            try row.encode(entry.exerciseName, forKey: .exerciseName)
            try row.encode(entry.trackingType, forKey: .trackingType)
            try row.encode(entry.restSeconds, forKey: .restSeconds)
            try encodeOptional(entry.notes, forKey: .notes, in: &row)
            var sets = row.nestedUnkeyedContainer(forKey: .sets)
            for set in entry.sets {
                var item = sets.nestedContainer(keyedBy: Keys.self)
                try encode(set, as: entry.trackingType, in: &item)
            }
        }
    }

    /// One set with the entry's type as its own, and only the values that type records.
    private func encode(_ set: WorkoutSet, as type: TrackingType, in item: inout KeyedEncodingContainer<Keys>) throws {
        try item.encode(type, forKey: .type)
        try item.encode(set.index, forKey: .index)
        switch type {
        case .weightReps:
            try item.encode(set.reps, forKey: .reps)
            try item.encode(set.weightKg, forKey: .weightKg)
        case .repsOnly:
            try item.encode(set.reps, forKey: .reps)
        case .duration:
            try item.encode(set.durationSeconds, forKey: .durationSeconds)
        }
        try item.encode(set.completed, forKey: .completed)
        try encodeOptional(set.rpe, forKey: .rpe, in: &item)
    }

    private func encodeOptional<Value: Encodable>(
        _ value: Value?,
        forKey key: Keys,
        in container: inout KeyedEncodingContainer<Keys>
    ) throws {
        if let value {
            try container.encode(value, forKey: key)
        } else {
            try container.encodeNil(forKey: key)
        }
    }

    public func json() -> Data? {
        try? JSONEncoder().encode(self)
    }
}

public extension Workout {
    /// The finished workout as the phone receives it. Duration is wall clock, `endedAt - startedAt`.
    func document(endedAt: Date) -> WorkoutDocument {
        WorkoutDocument(
            id: id,
            routineId: routineId,
            title: title,
            startedAt: ISO8601.string(startedAt),
            endedAt: ISO8601.string(max(endedAt, startedAt)),
            entries: entries,
            notes: notes
        )
    }
}

enum ISO8601 {
    static func string(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}
