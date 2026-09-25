import Foundation

/// The phone side's files, under Application Support/WatchBridge.
///
/// `inbox/` holds every finished watch workout from the moment WatchConnectivity hands it over
/// until JS has committed it (Stability rule 7 in issue #27): one file per payload, written
/// atomically, so a crash or a launch where JS never starts loses nothing. `rejected/` keeps a
/// payload JS could not read, out of the retry loop but never deleted. `snapshot/` holds the
/// latest routine snapshot and the copies WatchConnectivity is transferring.
final class WatchBridgeStore {
  struct InboxEntry {
    let id: String
    let format: String
    let version: Int
    let payload: String

    var dictionary: [String: Any] {
      ["id": id, "format": format, "version": version, "payload": payload]
    }
  }

  struct LatestSnapshot: Codable {
    let id: String
    let payload: String
    /// Identifies the content without its timestamp, so an unchanged document is not resent.
    let contentKey: String
    var delivered: Bool
  }

  private let fileManager = FileManager.default
  private let root: URL?

  init() {
    root = fileManager
      .urls(for: .applicationSupportDirectory, in: .userDomainMask)
      .first?
      .appendingPathComponent("WatchBridge", isDirectory: true)
  }

  // MARK: Inbox

  /// Writes a received payload. The same id twice overwrites, which is what makes a repeated
  /// delivery harmless before the database ever sees it.
  @discardableResult
  func writeInbox(_ entry: InboxEntry) -> Bool {
    guard let url = file(in: "inbox", named: entry.id) else { return false }
    let json: [String: Any] = entry.dictionary
    guard let data = try? JSONSerialization.data(withJSONObject: json) else { return false }
    return (try? data.write(to: url, options: .atomic)) != nil
  }

  /// Every entry, oldest first. A file that no longer parses comes back with an empty format,
  /// so JS rejects it (and it moves to `rejected/`) instead of it blocking the queue forever.
  func listInbox() -> [InboxEntry] {
    guard let dir = directory("inbox") else { return [] }
    let urls = (try? fileManager.contentsOfDirectory(
      at: dir,
      includingPropertiesForKeys: [.creationDateKey],
      options: [.skipsHiddenFiles]
    )) ?? []
    let sorted = urls
      .filter { $0.pathExtension == "json" }
      .sorted { creationDate($0) < creationDate($1) }
    return sorted.map { url in
      let id = url.deletingPathExtension().lastPathComponent
      guard
        let data = try? Data(contentsOf: url),
        let object = try? JSONSerialization.jsonObject(with: data),
        let json = object as? [String: Any]
      else {
        return InboxEntry(id: id, format: "", version: 0, payload: "")
      }
      return InboxEntry(
        id: id,
        format: json["format"] as? String ?? "",
        version: json["version"] as? Int ?? 0,
        payload: json["payload"] as? String ?? ""
      )
    }
  }

  func removeInbox(id: String) {
    guard let url = file(in: "inbox", named: id) else { return }
    try? fileManager.removeItem(at: url)
  }

  func rejectInbox(id: String) {
    guard
      let from = file(in: "inbox", named: id),
      let to = file(in: "rejected", named: id)
    else { return }
    try? fileManager.removeItem(at: to)
    try? fileManager.moveItem(at: from, to: to)
  }

  // MARK: Snapshot

  func readLatestSnapshot() -> LatestSnapshot? {
    guard
      let url = file(in: "snapshot", named: "latest"),
      let data = try? Data(contentsOf: url)
    else { return nil }
    return try? JSONDecoder().decode(LatestSnapshot.self, from: data)
  }

  func writeLatestSnapshot(_ snapshot: LatestSnapshot) {
    guard
      let url = file(in: "snapshot", named: "latest"),
      let data = try? JSONEncoder().encode(snapshot)
    else { return }
    try? data.write(to: url, options: .atomic)
  }

  /// A copy of the snapshot for one `transferFile`, named by its id. WatchConnectivity reads it
  /// while the transfer is outstanding, so it is deleted only when the transfer finishes.
  func writeTransferFile(id: String, payload: String) -> URL? {
    guard let url = file(in: "snapshot", named: "transfer-\(id)") else { return nil }
    return (try? Data(payload.utf8).write(to: url, options: .atomic)) != nil ? url : nil
  }

  func removeFile(at url: URL) {
    guard let root, url.path.hasPrefix(root.path) else { return }
    try? fileManager.removeItem(at: url)
  }

  /// Transfer copies whose transfer is no longer outstanding (the app was killed mid-transfer).
  func removeTransferFiles(except keep: Set<String>) {
    guard let dir = directory("snapshot") else { return }
    let urls = (try? fileManager.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
    for url in urls where url.lastPathComponent.hasPrefix("transfer-") && !keep.contains(url.path) {
      try? fileManager.removeItem(at: url)
    }
  }

  // MARK: Paths

  /// Ids become file names, so anything but a plain token is refused rather than escaped.
  static func isSafeId(_ id: String) -> Bool {
    guard !id.isEmpty, id.count <= 80 else { return false }
    return id.unicodeScalars.allSatisfy { CharacterSet.alphanumerics.contains($0) || $0 == "-" || $0 == "_" }
      && id.unicodeScalars.allSatisfy(\.isASCII)
  }

  private func directory(_ name: String) -> URL? {
    guard let root else { return nil }
    let dir = root.appendingPathComponent(name, isDirectory: true)
    if !fileManager.fileExists(atPath: dir.path) {
      try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
    }
    return dir
  }

  private func file(in folder: String, named name: String) -> URL? {
    guard Self.isSafeId(name) || name.hasPrefix("transfer-"), let dir = directory(folder) else {
      return nil
    }
    return dir.appendingPathComponent(name).appendingPathExtension("json")
  }

  private func creationDate(_ url: URL) -> Date {
    (try? url.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? .distantPast
  }
}
