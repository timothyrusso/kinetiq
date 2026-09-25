import XCTest
@testable import KinetiqWatchCore

final class EnvelopeTests: XCTestCase {
    private func zlib(_ data: Data) throws -> Data {
        try (data as NSData).compressed(using: .zlib) as Data
    }

    private func envelope(_ document: Data, version: Int = 1) throws -> Envelope {
        Envelope(
            format: "kinetiq.watch-routines", version: version, id: "snap-1", encoding: "zlib",
            payload: try zlib(document)
        )
    }

    func testInflatesWhatThePhoneCompresses() throws {
        let document = Fixtures.snapshot()
        XCTAssertEqual(Inflate.zlib(try zlib(document), limit: 1_000_000), document)
    }

    func testRefusesOutputOverTheLimitInsteadOfExpandingWithoutBound() throws {
        let bomb = try zlib(Data(count: 5_000_000))
        XCTAssertLessThan(bomb.count, 10_000)
        XCTAssertNil(Inflate.zlib(bomb, limit: 1_000_000))
    }

    func testRefusesGarbage() {
        XCTAssertNil(Inflate.zlib(Data("not deflate".utf8), limit: 1_000))
        XCTAssertNil(Inflate.zlib(Data(), limit: 1_000))
    }

    func testParsesADictionaryAndSkipsAReplyWithoutPayload() throws {
        let original = try envelope(Fixtures.snapshot())
        XCTAssertEqual(Envelope.parse(original.dictionary), original)
        XCTAssertNil(Envelope.parse(["id": "snap-1"]))
    }

    func testStoreReceivesACompressedEnvelope() throws {
        let store = SnapshotStore(files: Fixtures.temporaryStore())
        let stored = try store.receive(try envelope(Fixtures.snapshot()), bounds: Fixtures.bounds).get()
        XCTAssertEqual(stored.id, "snap-1")
        XCTAssertEqual(store.load()?.snapshot.routines.count, 1)
    }

    func testStoreRejectsAnUnknownVersionOrAnUnknownEncoding() throws {
        let store = SnapshotStore(files: Fixtures.temporaryStore())
        let future = try envelope(Fixtures.snapshot(), version: 2)
        XCTAssertEqual(store.receive(future, bounds: Fixtures.bounds).map(\.id), .failure(.unsupportedVersion(2)))
        let brotli = Envelope(format: "kinetiq.watch-routines", version: 1, id: "x", encoding: "br", payload: Data([1]))
        XCTAssertEqual(store.receive(brotli, bounds: Fixtures.bounds).map(\.id), .failure(.unreadable))
        XCTAssertNil(store.load())
    }
}
