import XCTest
@testable import KinetiqWatchCore

final class ArraySafeTests: XCTestCase {
    func testReturnsElementInRange() {
        XCTAssertEqual([1, 2, 3][safe: 1], 2)
    }

    func testReturnsNilOutOfRange() {
        XCTAssertNil([1, 2, 3][safe: 3])
        XCTAssertNil([1, 2, 3][safe: -1])
        XCTAssertNil([Int]()[safe: 0])
    }
}
