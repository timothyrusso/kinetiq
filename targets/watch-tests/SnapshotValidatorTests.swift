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

    func testRejectsAnUnknownVersionBeforeReadingTheShape() {
        let data = Fixtures.snapshot(overrides: ["version": 2, "routines": "a different shape"])
        XCTAssertEqual(validate(data), .failure(.unsupportedVersion(2)))
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
            ["sets": 0], ["sets": 21], ["weightKg": -1], ["weightKg": 451],
            ["restSeconds": 601], ["reps": String(repeating: "1", count: 21)],
            ["notes": String(repeating: "n", count: 201)], ["exerciseId": ""]
        ] {
            let data = Fixtures.snapshot(items: [Fixtures.item(overrides)])
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
