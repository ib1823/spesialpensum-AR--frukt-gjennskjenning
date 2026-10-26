import type { CSSProperties } from 'react'
import type {
  RecognitionResult,
  RecognitionStatus,
} from '../types/recognition'

type ARFoodLabelProps = {
  candidate: RecognitionResult | null
  error: string | null
  evaluating: boolean
  textAnalyzing: boolean
  textError: string | null
  position: {
    left: number
    top: number
    placement: 'above' | 'below' | 'left' | 'right'
  } | null
  result: RecognitionResult | null
  status: RecognitionStatus
  trackingVisible: boolean
}

const FOOD_NAMES: Record<RecognitionResult['label'], string> = {
  banana: 'banan',
  apple: 'eple',
  'monster-energy': 'Monster Energy',
  text: 'Tekst funnet',
  object: 'Ukjent objekt',
  unknown: 'Ukjent matvare',
}

export function ARFoodLabel({
  candidate,
  error,
  evaluating,
  textAnalyzing,
  textError,
  position,
  result,
  status,
  trackingVisible,
}: ARFoodLabelProps) {
  const labelStyle: CSSProperties | undefined = position
    ? {
        left: `${position.left}%`,
        top: `${position.top}%`,
        bottom: 'auto',
      }
    : undefined
  const isFruit =
    !evaluating &&
    result?.source === 'object-detection' &&
    result.box !== null &&
    (result.label === 'apple' || result.label === 'banana')
  const labelClassName = [
    'ar-food-label',
    position ? `ar-food-label--${position.placement}` : '',
    isFruit ? 'ar-food-label--hologram' : '',
    !trackingVisible && result ? 'ar-food-label--fading' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (status === 'idle') {
    return null
  }

  if (status === 'loading') {
    return (
      <div className="ar-food-label" role="status">
        <div className="ar-food-label__panel">
          <span className="ar-food-label__eyebrow">MATHJELP SCANNER</span>
          <span className="ar-food-label__title">Laster AI-modell...</span>
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing utilgjengelig
            </span>
          )}
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
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing utilgjengelig: {textError}
            </span>
          )}
        </div>
      </div>
    )
  }

  if (evaluating) {
    return (
      <div
        className={labelClassName}
        role="status"
        style={labelStyle}
      >
        <div className="ar-food-label__panel" key="evaluating">
          <span className="ar-food-label__eyebrow">
            {textAnalyzing ? 'LESER EMBALLASJEN' : 'ANALYSERER'}
          </span>
          <span className="ar-food-label__title">
            {textAnalyzing ? 'Leser teksten...' : 'Vurderer varen...'}
          </span>
          {candidate?.confidence !== null &&
            candidate?.confidence !== undefined && (
              <span className="ar-food-label__detail">
                {(candidate.confidence * 100).toFixed(0)}% modellscore
              </span>
            )}
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing utilgjengelig
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
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing utilgjengelig
            </span>
          )}
        </div>
      </div>
    )
  }

  if (result.label === 'text') {
    return (
      <div
        className="ar-food-label"
        role="status"
        aria-live="polite"
      >
        <div className="ar-food-label__panel" key={result.recognizedText}>
          <span className="ar-food-label__eyebrow">TEKST LEST FRA BILDET</span>
          <span className="ar-food-label__title">Tekst funnet</span>
          {result.recognizedText && (
            <span className="ar-food-label__recognized-text">
              {result.recognizedText}
            </span>
          )}
          {result.confidence !== null && (
            <span className="ar-food-label__detail">
              OCR-score {(result.confidence * 100).toFixed(0)}%
            </span>
          )}
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing feilet: {textError}
            </span>
          )}
        </div>
      </div>
    )
  }

  if (result.label === 'object') {
    return (
      <div
        className={labelClassName}
        role="status"
        aria-live="polite"
        style={labelStyle}
      >
        <div className="ar-food-label__panel" key={result.recognizedText}>
          <span className="ar-food-label__eyebrow">OBJEKT GJENKJENT</span>
          <span className="ar-food-label__title">
            {result.recognizedText ?? 'Ukjent objekt'}
          </span>
          {result.confidence !== null && (
            <span className="ar-food-label__detail">
              Objektscore {(result.confidence * 100).toFixed(0)}%
            </span>
          )}
          {textError && (
            <span className="ar-food-label__detail">
              Tekstlesing utilgjengelig
            </span>
          )}
        </div>
      </div>
    )
  }

  const isKnownFood = result.label !== 'unknown'
  const isTextRecognition = result.source === 'text-recognition'

  return (
    <div
      className={labelClassName}
      role="status"
      aria-live="polite"
      style={labelStyle}
    >
      <div className="ar-food-label__panel" key={result.label}>
        <span className="ar-food-label__eyebrow">
          {result.label === 'monster-energy'
            ? 'PRODUKTTEKST GJENKJENT'
            : isKnownFood
              ? 'MATVARE GJENKJENT'
              : 'INGEN SIKKER MATCH'}
        </span>
        {result.label === 'monster-energy' ? (
          <span className="ar-food-label__title">Monster Energy</span>
        ) : isFruit ? (
          <span className="ar-food-label__title">
            {FOOD_NAMES[result.label].toUpperCase()}
          </span>
        ) : isKnownFood ? (
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
        {result.recognizedText && result.label === 'monster-energy' && (
          <span className="ar-food-label__recognized-text">
            {result.recognizedText}
          </span>
        )}
        {result.confidence !== null && (
          <span className="ar-food-label__detail">
            {isTextRecognition ? 'OCR-score' : 'Objektscore'}{' '}
            {(result.confidence * 100).toFixed(0)}%
          </span>
        )}
        {isFruit && (
          <FruitNutritionExample
            label={result.label === 'apple' ? 'apple' : 'banana'}
          />
        )}
        {textError && (
          <span className="ar-food-label__detail">
            Tekstlesing utilgjengelig
          </span>
        )}
      </div>
    </div>
  )
}

function FruitNutritionExample({
  label,
}: {
  label: 'apple' | 'banana'
}) {
  const nutrients =
    label === 'apple'
      ? [
          ['Kalorier', '52 kcal'],
          ['Protein', '0,3 g'],
          ['Karbohydrater', '13,8 g'],
          ['Fett', '0,2 g'],
        ]
      : [
          ['Kalorier', '89 kcal'],
          ['Protein', '1,1 g'],
          ['Karbohydrater', '22,8 g'],
          ['Fett', '0,3 g'],
        ]

  return (
    <div className="ar-food-label__nutrition">
      <span className="ar-food-label__nutrition-heading">
        EKSEMPELVERDIER · PER 100 G
      </span>
      <div className="ar-food-label__nutrition-grid">
        {nutrients.map(([name, value]) => (
          <span className="ar-food-label__nutrition-item" key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </span>
        ))}
      </div>
      <span className="ar-food-label__nutrition-note">
        Veiledende tall, ikke målt verdi for denne frukten.
      </span>
    </div>
  )
}
