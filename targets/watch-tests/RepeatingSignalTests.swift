import XCTest
@testable import KinetiqWatchCore

/// A sleep the test ends by hand, one interval at a time.
@MainActor
private final class ManualSleep {
    private var pending: [CheckedContinuation<Void, Never>] = []
    private(set) var requested: [Duration] = []

    var sleep: RepeatingSignal.Sleep {
        { [weak self] interval in
            await withCheckedContinuation { continuation in
                Task { @MainActor in
                    guard let self else {
                        continuation.resume()
                        return
                    }
                    self.requested.append(interval)
                    self.pending.append(continuation)
                }
            }
        }
    }

    /// Waits for the pattern to ask for its next interval.
    func waitForSleep(file: StaticString = #filePath, line: UInt = #line) async {
        for _ in 0..<1_000 where pending.isEmpty {
            await Task.yield()
        }
        XCTAssertFalse(pending.isEmpty, "no sleep was requested", file: file, line: line)
    }

    /// Ends the pending interval and lets the pattern run up to its next sleep or its end.
    func advance() async {
        guard !pending.isEmpty else { return }
        pending.removeFirst().resume()
        for _ in 0..<100 {
            await Task.yield()
        }
    }
}

@MainActor
final class RepeatingSignalTests: XCTestCase {
    private var plays = 0
    private var clock = ManualSleep()
    private let origin = ContinuousClock.now
    /// How far the injected clock has moved from `origin`.
    private var elapsed: Duration = .zero

    override func setUp() async throws {
        plays = 0
        clock = ManualSleep()
        elapsed = .zero
    }

    private func signal(count: Int = 3) -> RepeatingSignal {
        RepeatingSignal(
            count: count,
            interval: .milliseconds(700),
            sleep: clock.sleep,
            now: { [unowned self] in self.origin + self.elapsed },
            play: { [weak self] in self?.plays += 1 }
        )
    }

    func testPlaysThreeTimesSevenTenthsOfASecondApart() async {
        let alarm = signal()
        alarm.start()
        XCTAssertEqual(plays, 1)
        XCTAssertTrue(alarm.isPlaying)
        await clock.waitForSleep()
        elapsed = .milliseconds(710)
        await clock.advance()
        XCTAssertEqual(plays, 2)
        await clock.waitForSleep()
        elapsed = .milliseconds(1_420)
        await clock.advance()
        XCTAssertEqual(plays, 3)
        XCTAssertFalse(alarm.isPlaying)
        XCTAssertEqual(clock.requested, [.milliseconds(700), .milliseconds(700)])
    }

    func testCancelAfterTheFirstStopsTheRepeats() async {
        let alarm = signal()
        alarm.start()
        await clock.waitForSleep()
        alarm.cancel()
        XCTAssertFalse(alarm.isPlaying)
        await clock.advance()
        XCTAssertEqual(plays, 1)
    }

    func testCancelBetweenRepeatsStopsTheLast() async {
        let alarm = signal()
        alarm.start()
        await clock.waitForSleep()
        await clock.advance()
        XCTAssertEqual(plays, 2)
        await clock.waitForSleep()
        alarm.cancel()
        await clock.advance()
        XCTAssertEqual(plays, 2)
        XCTAssertFalse(alarm.isPlaying)
    }

    func testStartWhilePlayingStartsOver() async {
        let alarm = signal()
        alarm.start()
        await clock.waitForSleep()
        alarm.start()
        XCTAssertEqual(plays, 2)
        await clock.advance()
        XCTAssertEqual(plays, 2, "the replaced pattern must not play")
        await clock.waitForSleep()
        await clock.advance()
        await clock.waitForSleep()
        await clock.advance()
        XCTAssertEqual(plays, 4)
        XCTAssertFalse(alarm.isPlaying)
    }

    func testARepeatThatWakesLateIsDroppedWithTheRestOfThePattern() async {
        let alarm = signal()
        alarm.start()
        await clock.waitForSleep()
        elapsed = .seconds(180)
        await clock.advance()
        XCTAssertEqual(plays, 1, "a buzz minutes after the rest ended must not play")
        XCTAssertFalse(alarm.isPlaying)
        XCTAssertEqual(clock.requested.count, 1)
    }

    func testARepeatLessThanAnIntervalLateStillPlays() async {
        let alarm = signal()
        alarm.start()
        await clock.waitForSleep()
        elapsed = .milliseconds(1_300)
        await clock.advance()
        XCTAssertEqual(plays, 2)
        await clock.waitForSleep()
        elapsed = .milliseconds(2_200)
        await clock.advance()
        XCTAssertEqual(plays, 2, "the last repeat is more than an interval late")
        XCTAssertFalse(alarm.isPlaying)
    }

    func testCancelWhenIdleIsHarmless() async {
        let alarm = signal()
        alarm.cancel()
        XCTAssertEqual(plays, 0)
        XCTAssertFalse(alarm.isPlaying)
    }

    func testASingleSignalNeedsNoRepeats() async {
        let alarm = signal(count: 1)
        alarm.start()
        XCTAssertEqual(plays, 1)
        XCTAssertFalse(alarm.isPlaying)
        XCTAssertTrue(clock.requested.isEmpty)
    }
}
