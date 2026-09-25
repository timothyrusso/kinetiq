import Foundation
import WatchConnectivity

/// What the manager tells JS, while JS is listening.
protocol WatchSessionListener: AnyObject {
  func watchSessionInboxChanged()
  func watchSessionSnapshotRequested(requestId: String)
}

/// The phone's one `WCSession` delegate (issue #27).
///
/// Activated from `WatchBridgeAppDelegateSubscriber` at launch, never lazily from JS: iOS
/// launches the app in the background to deliver watch data, and JS may not be running then.
/// Everything received is on disk (`WatchBridgeStore`) before anyone is told about it, which
/// is why a transfer finishing without error is the whole acknowledgement (Stability rule 8).
///
/// All state is touched on one serial queue; WatchConnectivity calls the delegate on its own.
final class WatchSessionManager: NSObject, WCSessionDelegate {
  static let shared = WatchSessionManager()

  static let workoutFormat = "kinetiq.watch-workout"
  static let routinesFormat = "kinetiq.watch-routines"
  static let formatVersion = 1

  /// How long a watch "send me a fresh snapshot" waits for JS before the stored one answers.
  private static let replyTimeout: TimeInterval = 4

  private let queue = DispatchQueue(label: "app.kinetiq.watch-bridge")
  private let store = WatchBridgeStore()
  private weak var listener: WatchSessionListener?
  private var pendingReplies: [String: ([String: Any]) -> Void] = [:]

  var isSupported: Bool { WCSession.isSupported() }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func setListener(_ listener: WatchSessionListener?) {
    queue.async { self.listener = listener }
  }

  // MARK: Snapshot, phone to watch

  /// Queues `payload` for the watch unless a document with the same `contentKey` is already
  /// there or on its way. `force` sends it regardless (the watch asked). Answers a pending watch
  /// request if `requestId` names one.
  func pushSnapshot(id: String, payload: String, contentKey: String, force: Bool, requestId: String?) {
    guard WatchBridgeStore.isSafeId(id) else { return }
    queue.async {
      let previous = self.store.readLatestSnapshot()
      if let previous, previous.contentKey == contentKey {
        // Unchanged: the watch that already has it must read "up to date", so the id stays.
        if !force, previous.delivered || self.isOutstanding(previous.id) {
          self.reply(to: requestId, id: previous.id)
          return
        }
        self.store.writeLatestSnapshot(
          .init(id: previous.id, payload: previous.payload, contentKey: contentKey, delivered: false)
        )
      } else {
        self.store.writeLatestSnapshot(
          .init(id: id, payload: payload, contentKey: contentKey, delivered: false)
        )
      }
      self.transferLatest()
      self.reply(to: requestId, id: self.store.readLatestSnapshot()?.id ?? id)
    }
  }

  /// Sends the stored snapshot, replacing any older one still in flight. On `queue`.
  private func transferLatest() {
    guard let latest = store.readLatestSnapshot(), canTransfer() else { return }
    let session = WCSession.default
    for transfer in session.outstandingFileTransfers where Self.isSnapshot(transfer.file.metadata) {
      if transfer.file.metadata?["id"] as? String == latest.id { return }
      transfer.cancel()
    }
    guard let url = store.writeTransferFile(id: latest.id, payload: latest.payload) else { return }
    session.transferFile(url, metadata: [
      "kind": "snapshot",
      "format": Self.routinesFormat,
      "version": Self.formatVersion,
      "id": latest.id,
    ])
  }

  private func canTransfer() -> Bool {
    let session = WCSession.default
    return session.activationState == .activated && session.isPaired && session.isWatchAppInstalled
  }

  private func isOutstanding(_ id: String) -> Bool {
    guard WCSession.default.activationState == .activated else { return false }
    return WCSession.default.outstandingFileTransfers.contains {
      Self.isSnapshot($0.file.metadata) && $0.file.metadata?["id"] as? String == id
    }
  }

  private static func isSnapshot(_ metadata: [String: Any]?) -> Bool {
    metadata?["kind"] as? String == "snapshot"
  }

  private func reply(to requestId: String?, id: String) {
    guard let requestId, let handler = pendingReplies.removeValue(forKey: requestId) else { return }
    handler(["id": id])
  }

  // MARK: Inbox, watch to phone

  func listInbox() -> [[String: Any]] {
    queue.sync { store.listInbox().map(\.dictionary) }
  }

  func ackInbox(id: String) {
    queue.sync { store.removeInbox(id: id) }
  }

  func rejectInbox(id: String) {
    queue.sync { store.rejectInbox(id: id) }
  }

  // MARK: WCSessionDelegate

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard activationState == .activated else { return }
    queue.async {
      let outstanding = Set(session.outstandingFileTransfers.map(\.file.fileURL.path))
      self.store.removeTransferFiles(except: outstanding)
      if let latest = self.store.readLatestSnapshot(), !latest.delivered, !self.isOutstanding(latest.id) {
        self.transferLatest()
      }
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  /// Required for switching between paired watches: the old session is gone, start the next.
  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  /// A newly installed watch app, or a different watch, has no snapshot yet.
  func sessionWatchStateDidChange(_ session: WCSession) {
    queue.async {
      guard session.isWatchAppInstalled, var latest = self.store.readLatestSnapshot() else { return }
      latest.delivered = false
      self.store.writeLatestSnapshot(latest)
      self.transferLatest()
    }
  }

  func session(_ session: WCSession, didFinish fileTransfer: WCSessionFileTransfer, error: Error?) {
    let metadata = fileTransfer.file.metadata
    let url = fileTransfer.file.fileURL
    queue.async {
      self.store.removeFile(at: url)
      guard Self.isSnapshot(metadata), error == nil, let id = metadata?["id"] as? String else { return }
      if var latest = self.store.readLatestSnapshot(), latest.id == id {
        latest.delivered = true
        self.store.writeLatestSnapshot(latest)
      }
    }
  }

  /// The watch's Sync button, when the phone is reachable. JS builds a fresh snapshot if it is
  /// running; otherwise, or if it does not answer in time, the stored one is sent again.
  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    guard message["request"] as? String == "snapshot" else {
      replyHandler([:])
      return
    }
    queue.async {
      let requestId = UUID().uuidString
      self.pendingReplies[requestId] = replyHandler
      if let listener = self.listener {
        listener.watchSessionSnapshotRequested(requestId: requestId)
        self.queue.asyncAfter(deadline: .now() + Self.replyTimeout) {
          self.answerFromStore(requestId)
        }
      } else {
        self.answerFromStore(requestId)
      }
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {}

  /// A finished watch workout. On disk before anything else happens.
  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    let rawId = userInfo["id"] as? String ?? ""
    let id = WatchBridgeStore.isSafeId(rawId) ? rawId : UUID().uuidString
    let payload = (userInfo["payload"] as? Data).flatMap { String(data: $0, encoding: .utf8) } ?? ""
    let entry = WatchBridgeStore.InboxEntry(
      id: id,
      format: userInfo["format"] as? String ?? "",
      version: userInfo["version"] as? Int ?? 0,
      payload: payload
    )
    queue.sync {
      _ = store.writeInbox(entry)
    }
    queue.async { self.listener?.watchSessionInboxChanged() }
  }

  /// On `queue`. Does nothing if the request was already answered.
  private func answerFromStore(_ requestId: String) {
    guard pendingReplies[requestId] != nil else { return }
    guard let latest = store.readLatestSnapshot() else {
      reply(to: requestId, id: "")
      return
    }
    transferLatest()
    reply(to: requestId, id: latest.id)
  }
}
