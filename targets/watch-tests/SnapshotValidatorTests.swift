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
        XCTAssertEqual(snapshot.routines.first?.items.first?.trackingType, .weightReps)
        XCTAssertEqual(snapshot.routines.first?.items.first?.sets, [
            .weightReps(reps: 10, weightKg: 60),
            .weightReps(reps: 8, weightKg: 65, targetRpe: 8),
            .weightReps(reps: 6, weightKg: 70, targetRpe: 9.5)
        ])
        XCTAssertEqual(snapshot.routines.first?.items.first?.restSeconds, 120)
    }

    func testDecodesARepsOnlyAndATimedItemWithOnlyTheirOwnValues() throws {
        let data = Fixtures.snapshot(items: [Fixtures.repsOnlyItem(), Fixtures.durationItem()])
        let items = try validate(data).get().routines.first?.items
        XCTAssertEqual(items?.map(\.trackingType), [.repsOnly, .duration])
        XCTAssertEqual(items?.first?.sets, [.repsOnly(reps: 10), .repsOnly(reps: 8, targetRpe: 9)])
        XCTAssertEqual(items?.last?.sets, [.duration(seconds: 45), .duration(seconds: 60, targetRpe: 8)])
    }

    func testRejectsASetWhoseTypeIsNotItsItemsOrThatMissesItsTypesValue() {
        for item in [
            Fixtures.item(["sets": [Fixtures.set(), Fixtures.repsOnlySet()]]),
            Fixtures.repsOnlyItem(["sets": [Fixtures.set()]]),
            Fixtures.durationItem(["sets": [Fixtures.repsOnlySet()]]),
            Fixtures.item(["sets": [Fixtures.set(["weightKg": NSNull()])]]),
            Fixtures.repsOnlyItem(["sets": [Fixtures.repsOnlySet(["reps": NSNull()])]]),
            Fixtures.durationItem(["sets": [Fixtures.durationSet(["durationSeconds": NSNull()])]])
        ] {
            XCTAssertEqual(validate(Fixtures.snapshot(items: [item])), .failure(.outOfBounds), "\(item)")
        }
        for item in [
            Fixtures.item(["trackingType": "stretch"]),
            Fixtures.item(["sets": [Fixtures.set(["type": NSNull()])]]),
            Fixtures.item(["trackingType": NSNull()])
        ] {
            XCTAssertEqual(validate(Fixtures.snapshot(items: [item])), .failure(.unreadable), "\(item)")
        }
    }

    func testRejectsAnUnknownVersionBeforeReadingTheShape() {
        let data = Fixtures.snapshot(overrides: ["version": 4, "routines": "a different shape"])
        XCTAssertEqual(validate(data), .failure(.unsupportedVersion(4)))
    }

    func testRejectsAV2SnapshotAsAnotherVersionRatherThanGuessingTypes() {
        let v2Item = Fixtures.item(["sets": [["reps": 8, "weightKg": 60, "targetRpe": NSNull()]]])
        let older = Fixtures.snapshot(items: [v2Item], overrides: ["version": 2])
        XCTAssertEqual(validate(older), .failure(.unsupportedVersion(2)))
        XCTAssertEqual(validate(Fixtures.snapshot(items: [v2Item])), .failure(.unreadable))
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
        for seconds in [4, 3601] {
            let item = Fixtures.durationItem(["sets": [Fixtures.durationSet(["durationSeconds": seconds])]])
            XCTAssertEqual(validate(Fixtures.snapshot(items: [item])), .failure(.outOfBounds), "\(seconds)")
        }
        for reps in [0, 101] {
            let item = Fixtures.repsOnlyItem(["sets": [Fixtures.repsOnlySet(["reps": reps])]])
            XCTAssertEqual(validate(Fixtures.snapshot(items: [item])), .failure(.outOfBounds), "\(reps)")
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
