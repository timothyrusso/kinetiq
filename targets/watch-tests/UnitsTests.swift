import XCTest
@testable import KinetiqWatchCore

/// The same answers as `features/core/utils/format.ts` on the phone.
final class UnitsTests: XCTestCase {
    func testFormatMatchesFormatWeight() {
        XCTAssertEqual(Units.format(kilograms: 60, system: .metric), "60 kg")
        XCTAssertEqual(Units.format(kilograms: 62.5, system: .metric), "62.5 kg")
        XCTAssertEqual(Units.format(kilograms: 62.25, system: .metric), "62.3 kg")
        XCTAssertEqual(Units.format(kilograms: 1.15, system: .metric), "1.2 kg")
        XCTAssertEqual(Units.format(kilograms: 100.04, system: .metric), "100 kg")
        XCTAssertEqual(Units.format(kilograms: 0, system: .metric), "0 kg")
        XCTAssertEqual(Units.format(kilograms: 0, system: .imperial), "0 lb")
        XCTAssertEqual(Units.format(kilograms: 60, system: .imperial), "132 lb")
    }

    func testStepMatchesWeightStep() {
        XCTAssertEqual(Units.step(.metric), 1)
        XCTAssertEqual(Units.step(.imperial), 2.5)
    }

    func testCrownStepIsFinerThanThePhoneStepper() {
        XCTAssertEqual(Units.crownStep(.metric), 0.5)
        XCTAssertEqual(Units.crownStep(.imperial), 1)
        XCTAssertEqual(Units.displayText(kilograms: 62.5, system: .metric), "62.5")
    }
}

final class UnitsDisplayTests: XCTestCase {
    func testDisplayRoundTripMatchesWeightDisplayValue() {
        XCTAssertEqual(Units.displayValue(kilograms: 60, system: .imperial), 132)
        XCTAssertEqual(Units.kilograms(fromDisplay: 135, system: .imperial), 61.23)
        XCTAssertEqual(Units.kilograms(fromDisplay: 62.5, system: .metric), 62.5)
        XCTAssertEqual(Units.displayText(kilograms: 62.5, system: .metric), "62.5")
        XCTAssertEqual(Units.displayText(kilograms: 60, system: .imperial), "132")
    }

    func testAdjustRestEndsItWhenPushedPastNow() {
        let now = Date(timeIntervalSince1970: 0)
        let routine = Routine(id: "r", name: "R", items: [
            Fixtures.weightRepsItem("i", "E", sets: Fixtures.sets(2, reps: 5, weightKg: 0), rest: 30)
        ])
        var workout = Workout.start(routine: routine, unitSystem: .metric, id: "w", now: now)
        workout.completeNextSet(in: 0, now: now)
        workout.adjustRest(by: 15, now: now)
        XCTAssertEqual(workout.restRemaining(now: now), 45)
        workout.adjustRest(by: -60, now: now)
        XCTAssertNil(workout.restEndsAt)
    }
}
