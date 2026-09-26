import Foundation

/// Weight and reps as the phone shows them (`src/utils/format.ts`). Storage is always kilograms.
public enum Units {
    public static let lbPerKg = 2.2046226218

    /// `weightStep` on the phone: 1 kg, or 2.5 lb.
    public static func step(_ system: UnitSystem) -> Double {
        system == .metric ? 1 : 2.5
    }

    /// kg to the number shown in the unit, the value the Crown edits.
    public static func displayValue(kilograms: Double, system: UnitSystem) -> Double {
        system == .metric ? kilograms : kilograms * lbPerKg
    }

    public static func kilograms(fromDisplay value: Double, system: UnitSystem) -> Double {
        system == .metric ? value : value / lbPerKg
    }

    /// `formatWeight` on the phone: one decimal at most in kg, whole pounds in lb.
    public static func format(kilograms: Double, system: UnitSystem) -> String {
        guard kilograms.isFinite, kilograms > 0 else { return system == .metric ? "0 kg" : "0 lb" }
        switch system {
        case .metric:
            return "\(oneDecimal(kilograms)) kg"
        case .imperial:
            return "\(Int((kilograms * lbPerKg).rounded())) lb"
        }
    }

    /// Rounded half up on the decimal digits, as `toLocaleString` does: 1.15 is "1.2", which
    /// `(1.15 * 10).rounded()` gets wrong because 1.15 * 10 is 11.4999... in binary.
    static func oneDecimal(_ value: Double) -> String {
        var exact = Decimal(string: String(value)) ?? Decimal(value)
        var rounded = Decimal()
        NSDecimalRound(&rounded, &exact, 1, .plain)
        return NSDecimalNumber(decimal: rounded).stringValue
    }
}

public enum Reps {
    /// `repsFromRange` on the phone: the first run of digits, accepted in 1 to 100, otherwise 8.
    public static func target(_ reps: String) -> Int {
        let digits = reps.drop { !$0.isASCII || !$0.isNumber }.prefix { $0.isASCII && $0.isNumber }
        guard let value = Int(digits), value > 0, value <= 100 else { return 8 }
        return value
    }
}
