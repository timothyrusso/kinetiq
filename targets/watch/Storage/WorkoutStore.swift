import Foundation

/// The workout in progress, as `workout.json`, rewritten after every edit (Stability rule 1).
public struct WorkoutStore: Sendable {
    static let fileName = "workout.json"

    public enum Loaded: Equatable {
        case none
        case workout(Workout)
        /// A file was there but could not be read (corrupt, or from an older build). It was moved
        /// aside, never deleted, and the app says so.
        case discarded
    }

    private let files: FileStore

    public init(files: FileStore) {
        self.files = files
    }

    public func load() -> Loaded {
        switch files.read(Workout.self, from: Self.fileName) {
        case .missing:
            return .none
        case .value(let workout) where workout.version == Workout.fileVersion:
            return .workout(workout)
        case .value, .unreadable:
            moveAside()
            return .discarded
        }
    }

    @discardableResult
    public func save(_ workout: Workout) -> Bool {
        files.write(workout, to: Self.fileName)
    }

    public func remove() {
        files.remove(Self.fileName)
    }

    private func moveAside() {
        guard let data = files.readData(Self.fileName) else { return }
        let stamp = Int(Date().timeIntervalSince1970)
        if files.writeData(data, to: "unreadable/workout-\(stamp).json") {
            files.remove(Self.fileName)
        }
    }
}
