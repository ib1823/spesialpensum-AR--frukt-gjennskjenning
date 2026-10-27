import Foundation

enum FoodItem: String, CaseIterable, Identifiable, Hashable, Sendable {
    case apple
    case banana

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .apple: "Eple"
        case .banana: "Banan"
        }
    }

    var headline: String {
        "\(displayName.uppercased()) – per 100 g"
    }
}

struct NutritionFacts {
    let energyKcal: Double
    let proteinGrams: Double
    let carbohydrateGrams: Double
    let fatGrams: Double
    let isApproximate: Bool
}
