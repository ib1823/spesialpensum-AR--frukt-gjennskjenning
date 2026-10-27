import SwiftUI

struct TrackingStatusView: View {
    let message: String
    let modelMessage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Label(message, systemImage: "viewfinder")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
            Text(modelMessage)
                .font(.caption)
                .foregroundStyle(modelMessage.hasPrefix("AI-modell mangler") ? .yellow : .white.opacity(0.75))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.black.opacity(0.68), in: RoundedRectangle(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .stroke(.white.opacity(0.16), lineWidth: 1)
        }
        .padding(.horizontal, 16)
    }
}
