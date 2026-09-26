import XCTest
@testable import KinetiqWatchCore

/// The same answers as `src/utils/format.ts` on the phone.
final class UnitsTests: XCTestCase {
    func testRepsTargetMatchesRepsFromRange() {
        XCTAssertEqual(Reps.target("8"), 8)
        XCTAssertEqual(Reps.target("8-12"), 8)
        XCTAssertEqual(Reps.target("5-8"), 5)
        XCTAssertEqual(Reps.target("1+"), 1)
        XCTAssertEqual(Reps.target("AMRAP"), 8)
        XCTAssertEqual(Reps.target("0"), 8)
        XCTAssertEqual(Reps.target("1000"), 8)
        XCTAssertEqual(Reps.target("100"), 100)
        XCTAssertEqual(Reps.target(""), 8)
    }

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
}
