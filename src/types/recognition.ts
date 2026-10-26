export type RecognitionLabel = 'banana' | 'apple' | 'unknown'

export type RecognitionBox = {
  xMin: number
  yMin: number
  xMax: number
  yMax: number
}

export type RecognitionResult = {
  label: RecognitionLabel
  confidence: number | null
  box: RecognitionBox | null
}

export type RecognitionStatus = 'idle' | 'loading' | 'ready' | 'error'

export type NutritionLookupQuery = {
  foodName: 'banan' | 'eple'
  basis: '100 g'
}
