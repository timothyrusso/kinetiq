import Foundation

/// The watch's only way to disk: small JSON files under Application Support, written atomically
/// (Stability rule 1 in issue #27). A write either lands whole or not at all, so a kill mid-write
/// leaves the previous file, never half of one.
public struct FileStore: Sendable {
    public let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    /// Application Support/Kinetiq, or the temporary directory if the system gives no container.
    public static func appSupport() -> FileStore {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return FileStore(directory: base.appendingPathComponent("Kinetiq", isDirectory: true))
    }

    public func url(_ name: String) -> URL {
        directory.appendingPathComponent(name)
    }

    @discardableResult
    public func write<Value: Encodable>(_ value: Value, to name: String) -> Bool {
        guard let data = try? JSONEncoder().encode(value) else { return false }
        return writeData(data, to: name)
    }

    @discardableResult
    public func writeData(_ data: Data, to name: String) -> Bool {
        let target = url(name)
        let folder = target.deletingLastPathComponent()
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try data.write(to: target, options: .atomic)
            return true
        } catch {
            return false
        }
    }

    public func read<Value: Decodable>(_ type: Value.Type, from name: String) -> ReadResult<Value> {
        guard let data = readData(name) else { return .missing }
        guard let value = try? JSONDecoder().decode(type, from: data) else { return .unreadable }
        return .value(value)
    }

    public func readData(_ name: String) -> Data? {
        try? Data(contentsOf: url(name))
    }

    public func remove(_ name: String) {
        try? FileManager.default.removeItem(at: url(name))
    }

    /// File names in a sub-folder, sorted, for the outbox.
    public func list(_ folder: String) -> [String] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: url(folder).path)) ?? []
        return names.filter { $0.hasSuffix(".json") }.sorted().map { "\(folder)/\($0)" }
    }
}

public enum ReadResult<Value> {
    case missing
    /// The file exists but is not a document this build can read: corrupt, or an old version.
    case unreadable
    case value(Value)
}
