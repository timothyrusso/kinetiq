import Foundation
import WatchConnectivity

/// The watch's one `WCSession` delegate, and nothing else (issue #27).
///
/// Finished workouts leave through `transferUserInfo`, which watchOS queues and delivers with the
/// phone locked, out of range or the app closed. An outbox entry is deleted only when its
/// transfer finishes without error; anything still in the outbox is queued again at launch,
/// after Finish and on every Sync tap (Stability rule 8). The phone's inbox makes a repeat
/// delivery harmless.
///
/// Snapshots arrive three ways: the application context (the channel), a Sync reply that
/// carries a small one, and a file for a library too large for either. All three are unwrapped,
/// validated and written to disk on one serial queue, before any view hears of them: the
/// routines survive even if the app is killed the next moment.
final class PhoneConnection: NSObject, WCSessionDelegate {
    enum RequestError: Error {
        case unreachable
    }

    static let shared = PhoneConnection()

    /// Called on the main queue with the outcome of each received snapshot.
    var onSnapshot: ((Result<SnapshotStore.Stored, SnapshotError>) -> Void)?

    private let queue = DispatchQueue(label: "app.kinetiq.watch.connection")
    private let snapshots = SnapshotStore(files: .appSupport())
    private let outbox = Outbox(files: .appSupport())
    let bounds: Bounds = Bundle.main.url(forResource: "bounds", withExtension: "json")
        .flatMap { try? Data(contentsOf: $0) }
        .flatMap(Bounds.decode) ?? .fallback

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    var isReachable: Bool {
        WCSession.isSupported() && WCSession.default.activationState == .activated && WCSession.default.isReachable
    }

    func loadSnapshot() -> SnapshotStore.Stored? {
        queue.sync { snapshots.load() }
    }

    /// Asks the phone for a fresh snapshot. Completes on the main queue with the id of the
    /// snapshot on its way ("" when the phone has none yet), after storing it if the reply
    /// carried it.
    func requestSnapshot(_ completion: @escaping (Result<String, RequestError>) -> Void) {
        guard isReachable else {
            completion(.failure(.unreachable))
            return
        }
        WCSession.default.sendMessage(
            ["request": "snapshot"],
            replyHandler: { reply in
                let id = reply["id"] as? String ?? ""
                self.queue.async {
                    if let envelope = Envelope.parse(reply) {
                        self.store(envelope)
                    }
                    DispatchQueue.main.async { completion(.success(id)) }
                }
            },
            errorHandler: { _ in
                DispatchQueue.main.async { completion(.failure(.unreachable)) }
            }
        )
    }

    /// Queues every finished workout the phone does not have yet.
    func sendOutbox() {
        queue.async { self.transferOutbox() }
    }

    /// On `queue`. Skips an entry whose transfer is already outstanding, so a second call cannot
    /// queue the same workout twice.
    private func transferOutbox() {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
        let session = WCSession.default
        let outstanding = Set(session.outstandingUserInfoTransfers.compactMap { $0.userInfo["id"] as? String })
        for entry in outbox.entries() where !outstanding.contains(entry.id) {
            session.transferUserInfo([
                "format": WorkoutDocument.format,
                "version": WorkoutDocument.version,
                "id": entry.id,
                "payload": entry.json
            ])
        }
    }

    /// On `queue`.
    private func store(_ envelope: Envelope) {
        let result = snapshots.receive(envelope, bounds: bounds)
        DispatchQueue.main.async { self.onSnapshot?(result) }
    }

    // MARK: WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        guard activationState == .activated else { return }
        let context = session.receivedApplicationContext
        queue.async {
            self.transferOutbox()
            guard let envelope = Envelope.parse(context), envelope.id != self.snapshots.load()?.id else { return }
            self.store(envelope)
        }
    }

    /// The acknowledgement: delivered to the phone, whose inbox is on disk before JS runs.
    func session(_ session: WCSession, didFinish userInfoTransfer: WCSessionUserInfoTransfer, error: Error?) {
        guard error == nil, let id = userInfoTransfer.userInfo["id"] as? String else { return }
        queue.async { self.outbox.remove(id: id) }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        queue.async {
            guard let envelope = Envelope.parse(applicationContext) else { return }
            self.store(envelope)
        }
    }

    /// WatchConnectivity deletes the file when this returns, so it is read here, synchronously.
    func session(_ session: WCSession, didReceive file: WCSessionFile) {
        guard file.metadata?["kind"] as? String == "snapshot" else { return }
        var dictionary = file.metadata ?? [:]
        dictionary["payload"] = try? Data(contentsOf: file.fileURL)
        queue.sync {
            guard let envelope = Envelope.parse(dictionary) else {
                DispatchQueue.main.async { self.onSnapshot?(.failure(.unreadable)) }
                return
            }
            self.store(envelope)
        }
    }
}
