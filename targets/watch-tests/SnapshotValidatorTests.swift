import XCTest
@testable import KinetiqWatchCore

final class SnapshotValidatorTests: XCTestCase {
    private func validate(_ data: Data) -> Result<RoutinesSnapshot, SnapshotError> {
        SnapshotValidator.validate(data, bounds: Fixtures.bounds)
    }

    func testReadsTheBundledBoundsFile() {
        XCTAssertEqual(Fixtures.bounds, Bounds.fallback)
    }

    func testAcceptsAValidSnapshotWithNullNotes() throws {
        let snapshot = try validate(Fixtures.snapshot()).get()
        XCTAssertEqual(snapshot.routines.first?.items.first?.exerciseName, "Bench Press")
        XCTAssertNil(snapshot.routines.first?.items.first?.notes)
        XCTAssertEqual(snapshot.unitSystem, .metric)
    }

    func testDecodesEverySetFromItsOwnRow() throws {
        let snapshot = try validate(Fixtures.snapshot()).get()
        XCTAssertEqual(snapshot.routines.first?.items.first?.sets, [
            RoutineSet(reps: 10, weightKg: 60, targetRpe: nil),
            RoutineSet(reps: 8, weightKg: 65, targetRpe: 8),
            RoutineSet(reps: 6, weightKg: 70, targetRpe: 9.5)
        ])
        XCTAssertEqual(snapshot.routines.first?.items.first?.restSeconds, 120)
    }

    func testRejectsAnUnknownVersionBeforeReadingTheShape() {
        let data = Fixtures.snapshot(overrides: ["version": 3, "routines": "a different shape"])
        XCTAssertEqual(validate(data), .failure(.unsupportedVersion(3)))
    }

    func testRejectsAV1SnapshotAsAnotherVersionRatherThanDroppingSets() {
        let v1Item = Fixtures.item(["sets": 4, "reps": "8-10", "weightKg": 60])
        let data = Fixtures.snapshot(items: [v1Item], overrides: ["version": 1])
        XCTAssertEqual(validate(data), .failure(.unsupportedVersion(1)))
        XCTAssertEqual(validate(Fixtures.snapshot(items: [v1Item])), .failure(.unreadable))
    }

    func testRejectsAnotherFormat() {
        XCTAssertEqual(validate(Fixtures.snapshot(overrides: ["format": "kinetiq.routines"])), .failure(.unknownFormat))
    }

    func testRejectsGarbage() {
        XCTAssertEqual(validate(Data("not json".utf8)), .failure(.unreadable))
        XCTAssertEqual(validate(Data()), .failure(.unreadable))
        XCTAssertEqual(validate(Fixtures.snapshot(overrides: ["unitSystem": "stones"])), .failure(.unreadable))
    }

    func testRejectsOutOfBoundsValues() {
        for overrides: [String: Any] in [
            ["sets": [[String: Any]]()], ["sets": Array(repeating: Fixtures.set(), count: 21)],
            ["restSeconds": 601], ["notes": String(repeating: "n", count: 201)], ["exerciseId": ""]
        ] {
            let data = Fixtures.snapshot(items: [Fixtures.item(overrides)])
            XCTAssertEqual(validate(data), .failure(.outOfBounds), "\(overrides)")
        }
        for overrides: [String: Any] in [
            ["reps": 0], ["reps": 101], ["weightKg": -1], ["weightKg": 451], ["targetRpe": -1], ["targetRpe": 10.5]
        ] {
            let sets = [Fixtures.set(), Fixtures.set(overrides)]
            let data = Fixtures.snapshot(items: [Fixtures.item(["sets": sets])])
            XCTAssertEqual(validate(data), .failure(.outOfBounds), "\(overrides)")
        }
    }

    func testRejectsTooManyRoutinesOrItems() {
        XCTAssertEqual(validate(Fixtures.snapshot(routines: 51)), .failure(.outOfBounds))
        let items = (0..<51).map { Fixtures.item(["id": "rit_\($0)"]) }
        XCTAssertEqual(validate(Fixtures.snapshot(items: items)), .failure(.outOfBounds))
    }

    func testRejectsAPayloadOverTheSizeLimit() {
        XCTAssertEqual(validate(Data(count: 1_000_001)), .failure(.tooLarge))
    }
}
