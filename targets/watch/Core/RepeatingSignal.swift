import Foundation

/// A signal played `count` times, `interval` apart, that stops the moment it is cancelled: the
/// rest-end haptic (issue #135), strong enough to be felt with the wrist down. The player and
/// the sleep and the clock are injected, so the pattern is tested without a watch or a clock.
///
/// Each repeat is due at the start plus a whole number of intervals. One that comes more than an
/// interval late (the app was suspended mid-pattern and woke minutes later) no longer belongs to
/// the moment it signalled, so it and every repeat after it are dropped.
@MainActor
public final class RepeatingSignal {
    public typealias Sleep = @Sendable (Duration) async throws -> Void

    private let count: Int
    private let interval: Duration
    private let sleep: Sleep
    private let now: () -> ContinuousClock.Instant
    private let play: () -> Void
    private var repeats: Task<Void, Never>?
    /// Bumped by every start and cancel, so a pattern that was replaced never plays again.
    private var generation = 0

    public init(
        count: Int,
        interval: Duration,
        sleep: @escaping Sleep = { try await Task.sleep(for: $0) },
        now: @escaping () -> ContinuousClock.Instant = { ContinuousClock.now },
        play: @escaping () -> Void
    ) {
        self.count = count
        self.interval = interval
        self.sleep = sleep
        self.now = now
        self.play = play
    }

    /// True while repeats are still due.
    public var isPlaying: Bool { repeats != nil }

    /// Plays the first signal now and the rest on schedule. A pattern already playing starts over.
    public func start() {
        cancel()
        guard count > 0 else { return }
        let started = now()
        play()
        guard count > 1 else { return }
        let current = generation
        repeats = Task { [weak self, interval, sleep, count] in
            for index in 1..<count {
                do {
                    try await sleep(interval)
                } catch {
                    return
                }
                guard let self, !Task.isCancelled, self.generation == current else { return }
                guard self.now() - (started + interval * index) <= interval else {
                    self.repeats = nil
                    return
                }
                self.play()
            }
            guard let self, self.generation == current else { return }
            self.repeats = nil
        }
    }

    /// Stops the repeats still due. Safe to call when nothing is playing.
    public func cancel() {
        generation += 1
        repeats?.cancel()
        repeats = nil
    }
}
