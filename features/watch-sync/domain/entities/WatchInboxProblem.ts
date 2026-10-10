/**
 * Why a watch workout was not saved as it arrived: `invalid` is unreadable and set aside,
 * `outdated` is from an older watch app and set aside, `version` is from a newer watch app and
 * kept for an update.
 */
export type WatchInboxProblem = 'invalid' | 'outdated' | 'version';
