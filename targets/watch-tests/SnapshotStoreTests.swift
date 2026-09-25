import XCTest
@testable import KinetiqWatchCore

final class SnapshotStoreTests: XCTestCase {
    func testStoresAValidSnapshotAndReadsItBack() throws {
        let store = SnapshotStore(files: Fixtures.temporaryStore())
        XCTAssertNil(store.load())
        _ = try store.receive(Fixtures.snapshot(), id: "snap-1", bounds: Fixtures.bounds).get()
        XCTAssertEqual(store.load()?.id, "snap-1")
    }

    func testABadSnapshotKeepsThePreviousRoutines() throws {
        let store = SnapshotStore(files: Fixtures.temporaryStore())
        _ = try store.receive(Fixtures.snapshot(), id: "snap-1", bounds: Fixtures.bounds).get()
        let bad = store.receive(Fixtures.snapshot(overrides: ["version": 9]), id: "snap-2", bounds: Fixtures.bounds)
        XCTAssertEqual(bad.map(\.id), .failure(.unsupportedVersion(9)))
        XCTAssertEqual(store.load()?.id, "snap-1")
    }

    func testAnOlderSnapshotArrivingLateDoesNotRollBack() throws {
        let store = SnapshotStore(files: Fixtures.temporaryStore())
        let newer = Fixtures.snapshot(overrides: ["exportedAt": "2026-09-25T12:00:00.000Z"])
        _ = try store.receive(newer, id: "snap-new", bounds: Fixtures.bounds).get()
        _ = store.receive(Fixtures.snapshot(), id: "snap-old", bounds: Fixtures.bounds)
        XCTAssertEqual(store.load()?.id, "snap-new")
    }

    func testACorruptFileOnDiskReadsAsNoSnapshot() {
        let files = Fixtures.temporaryStore()
        files.writeData(Data("{ half a file".utf8), to: "snapshot.json")
        XCTAssertNil(SnapshotStore(files: files).load())
    }
}
