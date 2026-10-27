import Foundation

enum NutritionCatalog {
    static func facts(for food: FoodItem) -> NutritionFacts {
        switch food {
        case .apple:
            NutritionFacts(
                energyKcal: 52,
                proteinGrams: 0.3,
                carbohydrateGrams: 13.8,
                fatGrams: 0.2,
                isApproximate: true
            )
        case .banana:
            NutritionFacts(
                energyKcal: 89,
                proteinGrams: 1.1,
                carbohydrateGrams: 22.8,
                fatGrams: 0.3,
                isApproximate: true
            )
        }
    }
}
