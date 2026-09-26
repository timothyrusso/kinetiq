import Foundation

/// Finished workouts waiting for the phone, one `outbox/<id>.json` each, written atomically at
/// Finish. An entry leaves only when the phone has it (Stability rule 8).
public struct Outbox: Sendable {
    public struct Entry: Equatable, Sendable {
        public let id: String
        public let json: Data
    }

    private let files: FileStore

    public init(files: FileStore) {
        self.files = files
    }

    @discardableResult
    public func add(_ document: WorkoutDocument) -> Bool {
        guard let json = document.json(), Self.isSafeId(document.id) else { return false }
        return files.writeData(json, to: "outbox/\(document.id).json")
    }

    public func entries() -> [Entry] {
        files.list("outbox").compactMap { name in
            guard let json = files.readData(name) else { return nil }
            let id = (name as NSString).lastPathComponent.replacingOccurrences(of: ".json", with: "")
            return Entry(id: id, json: json)
        }
    }

    public func remove(id: String) {
        guard Self.isSafeId(id) else { return }
        files.remove("outbox/\(id).json")
    }

    /// Ids become file names: a UUID's characters only.
    static func isSafeId(_ id: String) -> Bool {
        !id.isEmpty && id.count <= 80 && id.allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }
    }
}
