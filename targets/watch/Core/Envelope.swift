import Compression
import Foundation

/// What crosses WatchConnectivity: `{ format, version, id, encoding, payload }`, with the JSON
/// document in `payload` (issue #27). Property lists cannot carry `null`, so the document never
/// travels as a dictionary. The phone compresses the snapshot (`encoding: "zlib"`).
public struct Envelope: Equatable, Sendable {
    public let format: String
    public let version: Int
    public let id: String
    public let encoding: String?
    public let payload: Data

    public init(format: String, version: Int, id: String, encoding: String?, payload: Data) {
        self.format = format
        self.version = version
        self.id = id
        self.encoding = encoding
        self.payload = payload
    }

    /// Nil when the dictionary carries no payload (a Sync reply with only an id).
    public static func parse(_ dictionary: [String: Any]) -> Envelope? {
        guard let payload = dictionary["payload"] as? Data else { return nil }
        return Envelope(
            format: dictionary["format"] as? String ?? "",
            version: dictionary["version"] as? Int ?? 0,
            id: dictionary["id"] as? String ?? "",
            encoding: dictionary["encoding"] as? String,
            payload: payload
        )
    }

    public var dictionary: [String: Any] {
        var out: [String: Any] = ["format": format, "version": version, "id": id, "payload": payload]
        if let encoding { out["encoding"] = encoding }
        return out
    }

    /// The document's bytes, or nil if they cannot be decoded within `limit`.
    public func document(limit: Int) -> Data? {
        switch encoding {
        case nil:
            return payload.count <= limit ? payload : nil
        case "zlib":
            return Inflate.zlib(payload, limit: limit)
        default:
            return nil
        }
    }
}

public enum Inflate {
    /// Raw DEFLATE (what `NSData.compressed(using: .zlib)` writes) into a buffer of `limit + 1`
    /// bytes: output that fills it is over the limit and refused, so a hostile or corrupt payload
    /// cannot expand without bound.
    public static func zlib(_ data: Data, limit: Int) -> Data? {
        guard !data.isEmpty, limit > 0 else { return nil }
        let capacity = limit + 1
        var output = Data(count: capacity)
        let written = output.withUnsafeMutableBytes { (out: UnsafeMutableRawBufferPointer) -> Int in
            data.withUnsafeBytes { (input: UnsafeRawBufferPointer) -> Int in
                guard
                    let dst = out.bindMemory(to: UInt8.self).baseAddress,
                    let src = input.bindMemory(to: UInt8.self).baseAddress
                else { return 0 }
                return compression_decode_buffer(dst, capacity, src, data.count, nil, COMPRESSION_ZLIB)
            }
        }
        guard written > 0, written <= limit else { return nil }
        return output.prefix(written)
    }
}
