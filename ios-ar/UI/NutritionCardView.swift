import SwiftUI

struct NutritionCardView: View {
    let food: FoodItem?
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(food.map { $0.headline } ?? "ROMFORANKRET TEST")
                        .font(.caption.weight(.bold))
                        .tracking(1.1)
                        .foregroundStyle(.cyan)
                    Text(food == nil ? "Testanker" : "Næringsinnhold")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.white)
                }
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(.white.opacity(0.12), in: Circle())
                }
                .accessibilityLabel("Lukk næringsinnhold")
            }

            if let food {
                factsGrid(NutritionCatalog.facts(for: food))
            } else {
                Text("Dette er et ARKit-testanker, ikke en AI-gjenkjent matvare. Etiketten forblir romforankret når dette kortet lukkes.")
                    .font(.body)
                    .foregroundStyle(.white.opacity(0.82))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(22)
        .frame(maxWidth: 420)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.04, green: 0.15, blue: 0.21).opacity(0.96),
                    Color(red: 0.025, green: 0.07, blue: 0.12).opacity(0.96)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 24, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(.cyan.opacity(0.48), lineWidth: 1)
        }
        .shadow(color: .cyan.opacity(0.18), radius: 28)
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black.opacity(0.34))
    }

    private func factsGrid(_ facts: NutritionFacts) -> some View {
        VStack(spacing: 9) {
            factRow("Energi", value: "\(format(facts.energyKcal)) kcal")
            factRow("Protein", value: "\(format(facts.proteinGrams)) g")
            factRow("Karbohydrater", value: "\(format(facts.carbohydrateGrams)) g")
            factRow("Fett", value: "\(format(facts.fatGrams)) g")

            if facts.isApproximate {
                Text("Omtrentlige eksempelverdier per 100 g.")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.65))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
            }
        }
    }

    private func factRow(_ title: String, value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.white.opacity(0.72))
            Spacer()
            Text(value)
                .fontWeight(.semibold)
                .foregroundStyle(.white)
        }
        .font(.subheadline)
        .padding(12)
        .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 11))
    }

    private func format(_ value: Double) -> String {
        value.formatted(.number.locale(Locale(identifier: "nb_NO")).precision(.fractionLength(0...1)))
    }
}
