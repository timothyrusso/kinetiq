import Foundation
import SwiftUI

/// The routines the watch shows, and the state of the Sync button.
///
/// The list always comes from `snapshot.json`: a Sync that fails, or a snapshot that does not
/// validate, leaves it as it was (Stability rule 2 in issue #27).
@MainActor
final class RoutineStore: ObservableObject {
    enum SyncStatus: Equatable {
        case idle
        case syncing
        case done(LocalizedStringKey)
        case failed(LocalizedStringKey)
    }

    /// How long Sync waits for the phone to answer. WatchConnectivity can keep a message pending
    /// far longer when the phone drops out mid-request (out of range, switched off).
    private static let replyTimeout: Duration = .seconds(10)
    /// How long Sync waits for the snapshot the phone said it was sending.
    private static let arrivalTimeout: Duration = .seconds(20)

    @Published private(set) var stored: SnapshotStore.Stored?
    @Published private(set) var status: SyncStatus = .idle

    private let connection: PhoneConnection
    private var awaitingId: String?
    private var timeout: Task<Void, Never>?
    /// Identifies the Sync in flight, so a reply that arrives after its timeout is ignored.
    private var request = 0

    init(connection: PhoneConnection = .shared) {
        self.connection = connection
        stored = connection.loadSnapshot()
        connection.onSnapshot = { [weak self] result in
            self?.received(result)
        }
    }

    var routines: [Routine] { stored?.snapshot.routines ?? [] }
    var unitSystem: UnitSystem { stored?.snapshot.unitSystem ?? .metric }

    func sync() {
        guard status != .syncing else { return }
        status = .syncing
        // Whatever arrived while the app was closed is already on disk.
        stored = connection.loadSnapshot()
        // A finished workout that has not reached the phone yet goes again.
        connection.sendOutbox()
        request += 1
        let current = request
        connection.requestSnapshot { [weak self] result in
            guard let self, self.request == current, self.status == .syncing, self.awaitingId == nil else { return }
            self.replied(result)
        }
        schedule(after: Self.replyTimeout) { [weak self] in
            guard let self, self.request == current, self.status == .syncing, self.awaitingId == nil else { return }
            self.request += 1
            self.status = .failed("sync.unreachable")
        }
    }

    private func schedule(after delay: Duration, _ action: @escaping @MainActor () -> Void) {
        timeout?.cancel()
        timeout = Task {
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            action()
        }
    }

    private func replied(_ result: Result<String, PhoneConnection.RequestError>) {
        timeout?.cancel()
        switch result {
        case .failure:
            status = .failed("sync.unreachable")
        case .success(let id) where id.isEmpty:
            status = .failed("sync.noSnapshot")
        case .success(let id) where id == stored?.id:
            // A reply that carried the snapshot has already been stored and reported.
            if status == .syncing {
                status = .done("sync.upToDate")
            }
        case .success(let id):
            awaitingId = id
            schedule(after: Self.arrivalTimeout) { [weak self] in
                self?.arrivalTimedOut()
            }
        }
    }

    private func arrivalTimedOut() {
        guard awaitingId != nil else { return }
        awaitingId = nil
        status = .failed("sync.stillReceiving")
    }

    private func received(_ result: Result<SnapshotStore.Stored, SnapshotError>) {
        switch result {
        case .success(let snapshot):
            let changed = snapshot.id != stored?.id
            stored = snapshot
            if status == .syncing {
                status = .done(changed ? "sync.updated" : "sync.upToDate")
            }
        case .failure(.unsupportedVersion), .failure(.unknownFormat):
            status = .failed("sync.rejected.version")
        case .failure:
            status = .failed("sync.rejected.data")
        }
        awaitingId = nil
        timeout?.cancel()
    }
}
