import Foundation

/// Why a received snapshot was refused. The app shows a message for each; none of them crash.
public enum SnapshotError: Error, Equatable, Sendable {
    case tooLarge
    case unreadable
    case unknownFormat
    case unsupportedVersion(Int)
    case outOfBounds
}

/// Everything received is validated before use (Stability rule 3 in issue #27).
public enum SnapshotValidator {
    public static func validate(_ data: Data, bounds: Bounds) -> Result<RoutinesSnapshot, SnapshotError> {
        guard data.count <= bounds.importLimits.bytes else { return .failure(.tooLarge) }
        // Format and version first, from a minimal header, so a document of another version, with
        // a different shape, reads as "unsupported version" rather than as garbage.
        guard let header = try? JSONDecoder().decode(Header.self, from: data) else {
            return .failure(.unreadable)
        }
        guard header.format == RoutinesSnapshot.format else { return .failure(.unknownFormat) }
        guard header.version == RoutinesSnapshot.version else {
            return .failure(.unsupportedVersion(header.version))
        }
        guard let snapshot = try? JSONDecoder().decode(RoutinesSnapshot.self, from: data) else {
            return .failure(.unreadable)
        }
        return isWithinBounds(snapshot, bounds: bounds) ? .success(snapshot) : .failure(.outOfBounds)
    }

    static func isWithinBounds(_ snapshot: RoutinesSnapshot, bounds: Bounds) -> Bool {
        let limits = bounds.importLimits
        let item = bounds.itemBounds
        guard snapshot.routines.count <= limits.routines else { return false }
        return snapshot.routines.allSatisfy { routine in
            !routine.id.isEmpty
                && routine.items.count <= limits.itemsPerRoutine
                && routine.items.allSatisfy { row in
                    !row.id.isEmpty
                        && !row.exerciseId.isEmpty
                        && item.sets.contains(Double(row.sets.count))
                        && row.sets.allSatisfy { isWithinBounds($0, item: item) }
                        && item.restSeconds.contains(Double(row.restSeconds))
                        && (row.notes?.count ?? 0) <= item.notesLength
                }
        }
    }

    static func isWithinBounds(_ set: RoutineSet, item: Bounds.ItemBounds) -> Bool {
        item.reps.contains(Double(set.reps))
            && item.weightKg.contains(set.weightKg)
            && (set.targetRpe.map(item.rpe.contains) ?? true)
    }

    private struct Header: Decodable {
        let format: String
        let version: Int
    }
}
