export type RecognitionLabel =
  | 'banana'
  | 'apple'
  | 'monster-energy'
  | 'text'
  | 'unknown'

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
  recognizedText?: string
  source?: 'object-detection' | 'text-recognition'
}

export type TextRecognitionResult = {
  result: RecognitionResult | null
  error?: string
}

export type RecognitionStatus = 'idle' | 'loading' | 'ready' | 'error'

export type NutritionLookupQuery = {
  foodName: 'banan' | 'eple'
  basis: '100 g'
}
