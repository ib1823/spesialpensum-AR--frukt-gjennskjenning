import type { CSSProperties } from 'react'
import type {
  RecognitionResult,
  RecognitionStatus,
} from '../types/recognition'

type ARFoodLabelProps = {
  candidate: RecognitionResult | null
  error: string | null
  evaluating: boolean
  position: {
    left: number
    top: number
    placement: 'above' | 'below'
  } | null
  result: RecognitionResult | null
  status: RecognitionStatus
}

const FOOD_NAMES = {
  banana: 'banan',
  apple: 'eple',
  unknown: 'Ukjent matvare',
} as const

export function ARFoodLabel({
  candidate,
  error,
  evaluating,
  position,
  result,
  status,
}: ARFoodLabelProps) {
  const labelStyle: CSSProperties | undefined = position
    ? {
        left: `${position.left}%`,
        top: `${position.top}%`,
        bottom: 'auto',
      }
    : undefined

  if (status === 'idle') {
    return null
  }

  if (status === 'loading') {
    return (
      <div className="ar-food-label" role="status">
        <div className="ar-food-label__panel">
          <span className="ar-food-label__eyebrow">MATHJELP SCANNER</span>
          <span className="ar-food-label__title">Laster AI-modell...</span>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="ar-food-label ar-food-label--error" role="status">
        <div className="ar-food-label__panel">
          <span className="ar-food-label__eyebrow">MATHJELP SCANNER</span>
          <span className="ar-food-label__title">AI utilgjengelig</span>
          {error && <span className="ar-food-label__detail">{error}</span>}
        </div>
      </div>
    )
  }

  if (evaluating) {
    return (
      <div
        className={`ar-food-label${position ? ` ar-food-label--${position.placement}` : ''}`}
        role="status"
        style={labelStyle}
      >
        <div className="ar-food-label__panel" key="evaluating">
          <span className="ar-food-label__eyebrow">ANALYSERER</span>
          <span className="ar-food-label__title">Vurderer varen...</span>
          {candidate?.confidence !== null &&
            candidate?.confidence !== undefined && (
              <span className="ar-food-label__detail">
                {(candidate.confidence * 100).toFixed(0)}% modellscore
              </span>
            )}
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="ar-food-label" role="status">
        <div className="ar-food-label__panel" key="searching">
          <span className="ar-food-label__eyebrow">SØKER</span>
          <span className="ar-food-label__title">Leter etter mat...</span>
        </div>
      </div>
    )
  }

  const isKnownFood = result.label !== 'unknown'

  return (
    <div
      className={`ar-food-label${position ? ` ar-food-label--${position.placement}` : ''}`}
      role="status"
      aria-live="polite"
      style={labelStyle}
    >
      <div className="ar-food-label__panel" key={result.label}>
        <span className="ar-food-label__eyebrow">
          {isKnownFood ? 'MATVARE GJENKJENT' : 'INGEN SIKKER MATCH'}
        </span>
        {isKnownFood ? (
          <>
            <span className="ar-food-label__intro">
              Dette er {result.label === 'banana' ? 'en' : 'et'}
            </span>
            <span className="ar-food-label__title">
              {FOOD_NAMES[result.label]}
            </span>
          </>
        ) : (
          <span className="ar-food-label__title">
            {FOOD_NAMES[result.label]}
          </span>
        )}
        {result.confidence !== null && (
          <span className="ar-food-label__detail">
            {(result.confidence * 100).toFixed(0)}% modellscore
          </span>
        )}
      </div>
    </div>
  )
}
