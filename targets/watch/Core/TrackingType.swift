import Foundation

/// What an exercise's sets record (issue #169): reps at a weight, reps alone, or a time. The same
/// literals as the phone's `TrackingType`, which every item, entry and set carries on the wire.
public enum TrackingType: String, Codable, Equatable, Sendable {
    case weightReps
    case repsOnly
    case duration
}
