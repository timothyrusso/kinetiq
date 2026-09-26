import Foundation

/// The last valid routine snapshot, as `snapshot.json`. Replaced only by another valid one, so a
/// bad transfer or a failed Sync keeps the routines the user already had (Stability rule 2).
public struct SnapshotStore: Sendable {
    /// Bumped if the file's shape ever changes; an older file is then ignored, never misread.
    public static let fileVersion = 1
    static let fileName = "snapshot.json"

    public struct Stored: Codable, Equatable, Sendable {
        public let version: Int
        /// The phone's id for this snapshot, which the Sync reply is compared against.
        public let id: String
        public let snapshot: RoutinesSnapshot
    }

    private let files: FileStore

    public init(files: FileStore) {
        self.files = files
    }

    public func load() -> Stored? {
        guard case .value(let stored) = files.read(Stored.self, from: Self.fileName),
              stored.version == Self.fileVersion
        else { return nil }
        return stored
    }

    /// Unwraps, validates and stores a snapshot from the phone. Returns what the app should now show.
    public func receive(_ envelope: Envelope, bounds: Bounds) -> Result<Stored, SnapshotError> {
        guard envelope.format == RoutinesSnapshot.format else { return .failure(.unknownFormat) }
        guard envelope.version == RoutinesSnapshot.version else {
            return .failure(.unsupportedVersion(envelope.version))
        }
        guard let data = envelope.document(limit: bounds.importLimits.bytes) else {
            return .failure(.unreadable)
        }
        return receive(data, id: envelope.id, bounds: bounds)
    }

    /// Validates `data` and stores it if valid. Returns what the app should now show.
    public func receive(_ data: Data, id: String, bounds: Bounds) -> Result<Stored, SnapshotError> {
        switch SnapshotValidator.validate(data, bounds: bounds) {
        case .failure(let error):
            return .failure(error)
        case .success(let snapshot):
            // A transfer that was overtaken by a newer one must not roll the routines back.
            if let current = load(), current.snapshot.exportedAt > snapshot.exportedAt {
                return .success(current)
            }
            let stored = Stored(version: Self.fileVersion, id: id, snapshot: snapshot)
            files.write(stored, to: Self.fileName)
            return .success(stored)
        }
    }
}
