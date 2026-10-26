import type { FoodCategory } from '../types/recognition'

type ApiNutrient = {
  nutrientId: string
  name: string
  unit: string
  decimalPrecision: number
}

type ApiConstituent = {
  nutrientId: string
  quantity?: number
  unit?: string
}

type ApiFood = {
  foodId: string
  foodName: string
  uri: string
  calories?: { quantity: number; unit: string }
  constituents: ApiConstituent[]
}

export type FoodNutrient = {
  id: string
  name: string
  quantity: number
  unit: string
  decimalPrecision: number
}

export type MatvaretabellenFood = {
  id: string
  name: string
  uri: string
  calories: number | null
  nutrients: FoodNutrient[]
}

type FoodMatchRule = {
  pattern: RegExp
  preferredName?: string
}

type FoodDataResponse = {
  foods: ApiFood[]
}

type NutrientDataResponse = {
  nutrients: ApiNutrient[]
}

const API_BASE_URL = 'https://www.matvaretabellen.no/api/nb'
const MATCH_LIMIT = 12

const MATCH_RULES: Record<FoodCategory, FoodMatchRule> = {
  banana: { pattern: /banan/i, preferredName: 'Banan, rå' },
  apple: {
    pattern: /eple/i,
    preferredName: 'Eple, uspesifisert, rå',
  },
  orange: { pattern: /appelsin/i, preferredName: 'Appelsin, rå' },
  broccoli: { pattern: /^Brokkoli,/i },
  carrot: { pattern: /^Gulrot,/i },
  sandwich: { pattern: /smørbrød|sandwich/i },
  'hot-dog': { pattern: /pølse i brød|hot.?dog/i },
  pizza: { pattern: /^Pizza,/i },
  donut: { pattern: /smultring|donut/i },
  cake: { pattern: /kake/i },
  'energy-drink': { pattern: /^Energidrikk,/i },
}

let foodDataPromise: Promise<{
  foods: ApiFood[]
  nutrients: Map<string, ApiNutrient>
}> | null = null

function isFoodDataResponse(value: unknown): value is FoodDataResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'foods' in value &&
    Array.isArray(value.foods)
  )
}

function isNutrientDataResponse(
  value: unknown,
): value is NutrientDataResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nutrients' in value &&
    Array.isArray(value.nutrients)
  )
}

async function loadFoodData(): Promise<{
  foods: ApiFood[]
  nutrients: Map<string, ApiNutrient>
}> {
  if (!foodDataPromise) {
    foodDataPromise = Promise.all([
      fetch(`${API_BASE_URL}/foods.json`),
      fetch(`${API_BASE_URL}/nutrients.json`),
    ])
      .then(async ([foodsResponse, nutrientsResponse]) => {
        if (!foodsResponse.ok || !nutrientsResponse.ok) {
          throw new Error(
            'Matvaretabellen kunne ikke nås. Kontroller internettilkoblingen.',
          )
        }
        const [foodsData, nutrientsData]: [unknown, unknown] =
          await Promise.all([foodsResponse.json(), nutrientsResponse.json()])
        if (
          !isFoodDataResponse(foodsData) ||
          !isNutrientDataResponse(nutrientsData)
        ) {
          throw new Error('Matvaretabellen returnerte et ukjent dataformat.')
        }

        return {
          foods: foodsData.foods,
          nutrients: new Map(
            nutrientsData.nutrients.map((nutrient) => [
              nutrient.nutrientId,
              nutrient,
            ]),
          ),
        }
      })
      .catch((error: unknown) => {
        foodDataPromise = null
        throw error
      })
  }

  return foodDataPromise
}

function toFoodRecord(
  food: ApiFood,
  nutrientDefinitions: Map<string, ApiNutrient>,
): MatvaretabellenFood {
  const nutrients = food.constituents.flatMap((constituent) => {
    if (
      constituent.quantity === undefined ||
      constituent.unit === undefined
    ) {
      return []
    }
    const definition = nutrientDefinitions.get(constituent.nutrientId)
    if (!definition) {
      return []
    }
    return [{
      id: constituent.nutrientId,
      name: definition.name,
      quantity: constituent.quantity,
      unit: constituent.unit,
      decimalPrecision: definition.decimalPrecision,
    }]
  })

  return {
    id: food.foodId,
    name: food.foodName,
    uri: food.uri,
    calories: food.calories?.quantity ?? null,
    nutrients,
  }
}

export async function findFoodMatches(
  category: FoodCategory,
): Promise<{
  foods: MatvaretabellenFood[]
  recommendedFoodId: string | null
}> {
  const { foods, nutrients } = await loadFoodData()
  const rule = MATCH_RULES[category]
  const matches = foods.filter((food) => rule.pattern.test(food.foodName))
  const preferred = rule.preferredName
    ? matches.find((food) => food.foodName === rule.preferredName)
    : undefined
  const orderedMatches = [
    ...(preferred ? [preferred] : []),
    ...matches.filter((food) => food.foodId !== preferred?.foodId),
  ].slice(0, MATCH_LIMIT)

  const autoMatchCategories: FoodCategory[] = ['banana', 'apple', 'orange']
  return {
    foods: orderedMatches.map((food) => toFoodRecord(food, nutrients)),
    recommendedFoodId:
      preferred && autoMatchCategories.includes(category)
        ? preferred.foodId
        : null,
  }
}
