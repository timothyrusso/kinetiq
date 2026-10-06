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

    func testAFileFromTheV2ShapeReadsAsNoSnapshot() {
        let files = Fixtures.temporaryStore()
        let routines = "[{\"id\":\"r\",\"name\":\"R\",\"items\":[{\"id\":\"i\",\"exerciseId\":\"e\","
            + "\"exerciseName\":\"E\",\"sets\":[{\"reps\":8,\"weightKg\":60}],\"restSeconds\":90,\"notes\":null}]}]"
        let old = "{\"version\":2,\"id\":\"snap-1\",\"snapshot\":{\"format\":\"kinetiq.watch-routines\",\"version\":2,"
            + "\"exportedAt\":\"2026-09-25T10:00:00.000Z\",\"unitSystem\":\"metric\",\"routines\":\(routines)}}"
        files.writeData(Data(old.utf8), to: "snapshot.json")
        XCTAssertNil(SnapshotStore(files: files).load())
    }

    func testStoresAndReadsBackEveryTrackingType() throws {
        let store = SnapshotStore(files: Fixtures.temporaryStore())
        let items = [Fixtures.item(), Fixtures.repsOnlyItem(), Fixtures.durationItem()]
        _ = try store.receive(Fixtures.snapshot(items: items), id: "snap-1", bounds: Fixtures.bounds).get()
        let stored = try XCTUnwrap(store.load())
        XCTAssertEqual(stored.version, 3)
        XCTAssertEqual(stored.snapshot.routines.first?.items.map(\.trackingType), [.weightReps, .repsOnly, .duration])
        XCTAssertEqual(stored.snapshot.routines.first?.items.last?.sets.first, .duration(seconds: 45))
    }

    func testAFileFromTheV1ShapeReadsAsNoSnapshot() {
        let files = Fixtures.temporaryStore()
        let routines = "[{\"id\":\"r\",\"name\":\"R\",\"items\":[{\"id\":\"i\",\"exerciseId\":\"e\","
            + "\"exerciseName\":\"E\",\"sets\":3,\"reps\":\"8\",\"weightKg\":60,\"restSeconds\":90,\"notes\":null}]}]"
        let old = "{\"version\":1,\"id\":\"snap-1\",\"snapshot\":{\"format\":\"kinetiq.watch-routines\",\"version\":1,"
            + "\"exportedAt\":\"2026-09-25T10:00:00.000Z\",\"unitSystem\":\"metric\",\"routines\":\(routines)}}"
        files.writeData(Data(old.utf8), to: "snapshot.json")
        XCTAssertNil(SnapshotStore(files: files).load())
    }

    func testACorruptFileOnDiskReadsAsNoSnapshot() {
        let files = Fixtures.temporaryStore()
        files.writeData(Data("{ half a file".utf8), to: "snapshot.json")
        XCTAssertNil(SnapshotStore(files: files).load())
    }
}
