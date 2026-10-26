import { useEffect, useState } from 'react'
import {
  findFoodMatches,
  type MatvaretabellenFood,
} from '../services/matvaretabellenService'
import type { FoodCategory } from '../types/recognition'

type NutritionLookupProps = {
  category: FoodCategory
}

const DISPLAYED_NUTRIENTS = ['Protein', 'Karbo', 'Fett', 'Fiber']

export function NutritionLookup({ category }: NutritionLookupProps) {
  const [foods, setFoods] = useState<MatvaretabellenFood[]>([])
  const [selectedFoodId, setSelectedFoodId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setFoods([])
    setSelectedFoodId('')

    void findFoodMatches(category)
      .then(({ foods: matches, recommendedFoodId }) => {
        if (active) {
          setFoods(matches)
          setSelectedFoodId(recommendedFoodId ?? '')
          setLoading(false)
        }
      })
      .catch((lookupError: unknown) => {
        if (active) {
          setError(
            lookupError instanceof Error
              ? lookupError.message
              : 'Matvaretabellen kunne ikke lastes.',
          )
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [category])

  if (loading) {
    return (
      <div className="nutrition-lookup" role="status">
        Henter næringsdata fra Matvaretabellen...
      </div>
    )
  }

  if (error) {
    return (
      <div className="nutrition-lookup nutrition-lookup--error" role="status">
        {error}
      </div>
    )
  }

  if (!foods.length) {
    return (
      <div className="nutrition-lookup">
        Fant ingen passende matvareoppføring i Matvaretabellen.
      </div>
    )
  }

  const selectedFood = foods.find((food) => food.id === selectedFoodId)

  return (
    <section className="nutrition-lookup" aria-label="Næringsinnhold">
      <span className="nutrition-lookup__heading">
        NÆRINGSINNHOLD · PER 100 G
      </span>
      <label className="nutrition-lookup__label" htmlFor="nutrition-food">
        Matvaretabellen-oppføring
      </label>
      <select
        id="nutrition-food"
        className="nutrition-lookup__select"
        value={selectedFoodId}
        onChange={(event) => setSelectedFoodId(event.target.value)}
      >
        <option value="">Velg riktig matvare...</option>
        {foods.map((food) => (
          <option key={food.id} value={food.id}>
            {food.name}
          </option>
        ))}
      </select>
      {selectedFood ? (
        <>
          <div className="nutrition-lookup__grid">
            <NutritionValue
              label="Energi"
              quantity={selectedFood.calories}
              unit="kcal"
            />
            {DISPLAYED_NUTRIENTS.map((nutrientId) => {
              const nutrient = selectedFood.nutrients.find(
                (item) => item.id === nutrientId,
              )
              return (
                <NutritionValue
                  key={nutrientId}
                  label={nutrient?.name ?? nutrientId}
                  quantity={nutrient?.quantity ?? null}
                  unit={nutrient?.unit ?? 'g'}
                  decimalPrecision={nutrient?.decimalPrecision}
                />
              )
            })}
          </div>
          <a
            className="nutrition-lookup__source"
            href={selectedFood.uri}
            target="_blank"
            rel="noreferrer"
          >
            Kilde: Matvaretabellen ({selectedFood.id})
          </a>
        </>
      ) : (
        <p className="nutrition-lookup__hint">
          Velg den varianten som passer. Næringsverdier vises først etter valg.
        </p>
      )}
    </section>
  )
}

type NutritionValueProps = {
  label: string
  quantity: number | null
  unit: string
  decimalPrecision?: number
}

function NutritionValue({
  label,
  quantity,
  unit,
  decimalPrecision = 1,
}: NutritionValueProps) {
  return (
    <div className="nutrition-lookup__value">
      <span>{label}</span>
      <strong>
        {quantity === null
          ? 'Ikke oppgitt'
          : `${quantity.toFixed(decimalPrecision)} ${unit}`}
      </strong>
    </div>
  )
}
