import Foundation

/// A workout in progress on the watch: the state machine behind the workout screen (issue #27).
///
/// A value type with no clock and no disk: every operation takes `now` where it needs one and
/// returns nothing the caller must remember, so the app can write the whole value to disk after
/// each one (Stability rule 1) and a relaunch rebuilds exactly this. Every index is checked;
/// an out-of-range one is a no-op, never a crash.
public struct Workout: Codable, Equatable, Sendable {
    /// Bumped if the file's shape changes; an older `workout.json` is then discarded, never misread.
    public static let fileVersion = 1

    public let version: Int
    /// A UUID minted at Start. It becomes the phone's activity id, which makes a replay harmless.
    public let id: String
    public let routineId: String?
    public let title: String
    public let unitSystem: UnitSystem
    public let startedAt: Date
    public private(set) var entries: [WorkoutEntry]
    /// The exercise page the user is on, so a relaunch opens the same one.
    public private(set) var currentEntry: Int
    public private(set) var restEndsAt: Date?
    public private(set) var restDuration: Int?
    /// Completed sets, most recent last: what Undo walks back.
    public private(set) var completionLog: [SetRef]
    public private(set) var notes: String?

    public struct SetRef: Codable, Equatable, Sendable {
        public let entry: Int
        public let set: Int
    }

    /// Starts a workout from a routine, copying it in: a Sync mid-workout cannot change what is
    /// being trained. The same rule as the phone's `entriesFromItems`: one entry per item,
    /// `max(1, sets)` sets, reps from `repsFromRange`, the item's weight, nothing completed.
    public static func start(routine: Routine, unitSystem: UnitSystem, id: String, now: Date) -> Workout {
        Workout(
            version: fileVersion,
            id: id,
            routineId: routine.id,
            title: routine.name,
            unitSystem: unitSystem,
            startedAt: now,
            entries: routine.items.map { item in
                WorkoutEntry(
                    exerciseId: item.exerciseId,
                    exerciseName: item.exerciseName,
                    restSeconds: item.restSeconds,
                    notes: item.notes,
                    sets: (0..<max(1, item.sets)).map { index in
                        WorkoutSet(
                            index: index, reps: Reps.target(item.reps), weightKg: item.weightKg,
                            completed: false, rpe: nil
                        )
                    }
                )
            },
            currentEntry: 0,
            restEndsAt: nil,
            restDuration: nil,
            completionLog: [],
            notes: nil
        )
    }

    // MARK: Reading

    /// The set the Complete button completes: the first one not yet done.
    public func nextSet(in entry: Int) -> Int? {
        entries[safe: entry]?.sets.firstIndex { !$0.completed }
    }

    public var completedSets: Int {
        entries.reduce(0) { $0 + $1.sets.filter(\.completed).count }
    }

    public var plannedSets: Int {
        entries.reduce(0) { $0 + $1.sets.count }
    }

    public var canUndo: Bool { !completionLog.isEmpty }

    public func isDone(_ entry: Int) -> Bool {
        guard let row = entries[safe: entry] else { return false }
        return row.sets.allSatisfy(\.completed)
    }

    public var allDone: Bool { entries.indices.allSatisfy(isDone) }

    /// The first exercise after `entry` with a set left to do, wrapping round to the start: where
    /// the workout goes once an exercise is finished. Nil when everything is done.
    public func nextUnfinished(after entry: Int) -> Int? {
        let count = entries.count
        guard count > 0 else { return nil }
        return (1...count).map { (entry + $0) % count }.first { !isDone($0) }
    }

    /// Seconds of rest left, rounded up, from the absolute deadline so a relaunch or a lowered
    /// wrist cannot make the timer run slow. Zero when no rest is running.
    public func restRemaining(now: Date) -> Int {
        guard let restEndsAt else { return 0 }
        return max(0, Int((restEndsAt.timeIntervalSince(now)).rounded(.up)))
    }

    // MARK: Editing

    public mutating func setCurrentEntry(_ entry: Int) {
        guard entries.indices.contains(entry) else { return }
        currentEntry = entry
    }

    /// Completes the next set of `entry` and starts its rest. Returns the rest in seconds, or nil
    /// when nothing was completed (every set already done, or no such exercise).
    @discardableResult
    public mutating func completeNextSet(in entry: Int, now: Date) -> Int? {
        guard let setIndex = nextSet(in: entry), var row = entries[safe: entry] else { return nil }
        guard var set = row.sets[safe: setIndex] else { return nil }
        set.completed = true
        row.sets[safe: setIndex] = set
        entries[safe: entry] = row
        completionLog.append(SetRef(entry: entry, set: setIndex))
        let rest = row.restSeconds
        if rest > 0 {
            restEndsAt = now.addingTimeInterval(TimeInterval(rest))
            restDuration = rest
        } else {
            clearRest()
        }
        return rest
    }

    /// Completes one particular set (the one selected on the exercise page) and starts its rest.
    /// Returns the rest in seconds, or nil when the set was already done or does not exist.
    @discardableResult
    public mutating func completeSet(_ set: Int, in entry: Int, now: Date) -> Int? {
        guard var row = entries[safe: entry], var target = row.sets[safe: set], !target.completed else {
            return nil
        }
        target.completed = true
        row.sets[safe: set] = target
        entries[safe: entry] = row
        completionLog.append(SetRef(entry: entry, set: set))
        let rest = row.restSeconds
        // After the last set of the whole workout there is nothing to rest for.
        if rest > 0, !allDone {
            restEndsAt = now.addingTimeInterval(TimeInterval(rest))
            restDuration = rest
        } else {
            clearRest()
        }
        return rest
    }

    /// The set's checkbox: ticks an open set (starting its rest, like Complete set) or unticks a
    /// done one so it can be redone.
    public mutating func toggleSet(_ set: Int, in entry: Int, now: Date) {
        guard var row = entries[safe: entry], var target = row.sets[safe: set] else { return }
        if !target.completed {
            completeSet(set, in: entry, now: now)
            return
        }
        target.completed = false
        row.sets[safe: set] = target
        entries[safe: entry] = row
        completionLog.removeAll { $0 == SetRef(entry: entry, set: set) }
        clearRest()
    }

    /// Weight for `set`. On an open set it also carries to the open sets after it, since the
    /// number is usually the same for the rest of the exercise; on a done set (a correction) it
    /// changes that set alone. Clamped to `ITEM_BOUNDS`.
    public mutating func setWeight(_ kilograms: Double, set: Int, in entry: Int, bounds: Bounds) {
        let value = bounds.itemBounds.weightKg.clamp(kilograms.isFinite ? kilograms : 0)
        update(set, in: entry) { $0.weightKg = value }
    }

    /// Reps for `set`, 1 to 100, carried forward the same way as the weight.
    public mutating func setReps(_ reps: Int, set: Int, in entry: Int) {
        let value = min(Self.repsRange.upperBound, max(Self.repsRange.lowerBound, reps))
        update(set, in: entry) { $0.reps = value }
    }

    private mutating func update(_ set: Int, in entry: Int, _ change: (inout WorkoutSet) -> Void) {
        guard var row = entries[safe: entry], let target = row.sets[safe: set] else { return }
        let indices = target.completed
            ? [set]
            : row.sets.indices.filter { $0 >= set && !(row.sets[safe: $0]?.completed ?? true) }
        for index in indices {
            if var item = row.sets[safe: index] {
                change(&item)
                row.sets[safe: index] = item
            }
        }
        entries[safe: entry] = row
    }

    /// Reopens the most recently completed set and stops its rest.
    public mutating func undoLastCompleted() {
        guard let last = completionLog.popLast(),
              var row = entries[safe: last.entry],
              var set = row.sets[safe: last.set]
        else { return }
        set.completed = false
        row.sets[safe: last.set] = set
        entries[safe: last.entry] = row
        currentEntry = last.entry
        clearRest()
    }

    /// Weight for the next set of `entry` and every set after it that is not done yet: the
    /// number is usually the same for the rest of the exercise. Clamped to `ITEM_BOUNDS`.
    public mutating func setWeight(_ kilograms: Double, in entry: Int, bounds: Bounds) {
        let value = bounds.itemBounds.weightKg.clamp(kilograms.isFinite ? kilograms : 0)
        updateRemainingSets(in: entry) { $0.weightKg = value }
    }

    /// Reps for the next set and the ones after it, 1 to 100 like the phone's stepper.
    public mutating func setReps(_ reps: Int, in entry: Int) {
        let value = min(Self.repsRange.upperBound, max(Self.repsRange.lowerBound, reps))
        updateRemainingSets(in: entry) { $0.reps = value }
    }

    /// Rest for this exercise's sets from now on, in the routine editor's 0 to 600 range.
    public mutating func setRest(_ seconds: Int, in entry: Int, bounds: Bounds) {
        guard var row = entries[safe: entry] else { return }
        row.restSeconds = Int(bounds.itemBounds.restSeconds.clamp(Double(seconds)))
        entries[safe: entry] = row
    }

    /// Moves the running rest's end by `seconds` (the rest screen's -15 / +15). A rest pushed to
    /// zero or below ends.
    public mutating func adjustRest(by seconds: Int, now: Date) {
        guard let end = restEndsAt else { return }
        let moved = end.addingTimeInterval(TimeInterval(seconds))
        if moved <= now {
            clearRest()
        } else {
            restEndsAt = moved
        }
    }

    public mutating func clearRest() {
        restEndsAt = nil
        restDuration = nil
    }

    public static let repsRange = 1...100
    /// The phone's rest stepper step.
    public static let restStep = 15

    private mutating func updateRemainingSets(in entry: Int, _ change: (inout WorkoutSet) -> Void) {
        guard var row = entries[safe: entry], let first = nextSet(in: entry) else { return }
        for index in row.sets.indices where index >= first && !(row.sets[safe: index]?.completed ?? true) {
            if var set = row.sets[safe: index] {
                change(&set)
                row.sets[safe: index] = set
            }
        }
        entries[safe: entry] = row
    }
}

public struct WorkoutEntry: Codable, Equatable, Sendable {
    public let exerciseId: String
    public let exerciseName: String
    public var restSeconds: Int
    public let notes: String?
    public var sets: [WorkoutSet]
}

public struct WorkoutSet: Codable, Equatable, Sendable {
    public let index: Int
    public var reps: Int
    public var weightKg: Double
    public var completed: Bool
    public var rpe: Double?
}
