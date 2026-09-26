import SwiftUI

/// The lime action button with black text: white on the lime accent does not reach a readable
/// contrast. Disabled, it greys out like a system button.
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(isEnabled ? Color.black : Color.secondary)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(
                Capsule().fill(isEnabled ? Color.accentColor : Color.white.opacity(0.15))
            )
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle {
    static var primary: PrimaryButtonStyle { PrimaryButtonStyle() }
}
