import { useEffect, useState } from 'react'
import { RecognitionService } from '../services/recognitionService'
import { TextRecognitionService } from '../services/textRecognitionService'
import type {
  RecognitionResult,
  RecognitionStatus,
} from '../types/recognition'

const INFERENCE_INTERVAL_MS = 1000
const REQUIRED_STABLE_PREDICTIONS = 2
const TEXT_RECOGNITION_INTERVAL_MS = 3500

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Matgjenkjenningen kunne ikke startes.'
}

function getPredictionKey(
  prediction: RecognitionResult | null,
): string | null {
  if (!prediction) {
    return null
  }

  return `${prediction.label}:${prediction.recognizedText ?? ''}`
}

export function useFoodRecognition(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
) {
  const [result, setResult] = useState<RecognitionResult | null>(null)
  const [candidate, setCandidate] = useState<RecognitionResult | null>(null)
  const [textResult, setTextResult] = useState<RecognitionResult | null>(null)
  const [textAnalyzing, setTextAnalyzing] = useState(false)
  const [textError, setTextError] = useState<string | null>(null)
  const [status, setStatus] = useState<RecognitionStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setResult(null)
      setCandidate(null)
      setTextResult(null)
      setTextAnalyzing(false)
      setTextError(null)
      setError(null)
      setStatus('idle')
      return
    }

    let active = true
    let candidateLabel: string | null = null
    let candidateCount = 0
    let missedPredictions = 0
    let textRecognitionReady = false
    let textRecognitionInProgress = false
    let lastTextRecognitionAt = 0
    let textRecognitionTask: Promise<void> | null = null

    setResult(null)
    setCandidate(null)
    setTextResult(null)
    setTextAnalyzing(false)
    setTextError(null)
    setError(null)
    setStatus('loading')

    const run = async () => {
      let recognitionService: RecognitionService | null = null
      let textRecognitionService: TextRecognitionService | null = null
      let textRecognitionLoad: Promise<void> | null = null

      try {
        recognitionService = new RecognitionService()
        await recognitionService.load()
        if (!active) {
          return
        }

        setStatus('ready')
        const video = videoRef.current
        if (!video) {
          throw new Error('Kameraforhåndsvisningen er ikke tilgjengelig.')
        }

        textRecognitionService = new TextRecognitionService()
        textRecognitionLoad = textRecognitionService
          .load()
          .then(() => {
            textRecognitionReady = true
          })
          .catch((textRecognitionError: unknown) => {
            if (active) {
              setTextError(getErrorMessage(textRecognitionError))
            }
          })

        while (active) {
          const prediction = await recognitionService.recognizeFrame(video)
          if (!active) {
            break
          }

          if (prediction) {
            missedPredictions = 0
            const predictionKey = getPredictionKey(prediction)
            if (predictionKey === candidateLabel) {
              candidateCount += 1
            } else {
              candidateLabel = predictionKey
              candidateCount = 1
            }

            setCandidate((previous) => {
              if (
                !previous ||
                getPredictionKey(previous) !== predictionKey ||
                !previous.box ||
                !prediction.box
              ) {
                return prediction
              }

              const smoothing = 0.35
              return {
                ...prediction,
                box: {
                  xMin:
                    previous.box.xMin * (1 - smoothing) +
                    prediction.box.xMin * smoothing,
                  yMin:
                    previous.box.yMin * (1 - smoothing) +
                    prediction.box.yMin * smoothing,
                  xMax:
                    previous.box.xMax * (1 - smoothing) +
                    prediction.box.xMax * smoothing,
                  yMax:
                    previous.box.yMax * (1 - smoothing) +
                    prediction.box.yMax * smoothing,
                },
              }
            })

            if (candidateCount >= REQUIRED_STABLE_PREDICTIONS) {
              setResult((previous) => {
                if (
                  !previous ||
                  getPredictionKey(previous) !== predictionKey ||
                  !previous.box ||
                  !prediction.box
                ) {
                  return prediction
                }

                const smoothing = 0.35
                return {
                  ...prediction,
                  box: {
                    xMin:
                      previous.box.xMin * (1 - smoothing) +
                      prediction.box.xMin * smoothing,
                    yMin:
                      previous.box.yMin * (1 - smoothing) +
                      prediction.box.yMin * smoothing,
                    xMax:
                      previous.box.xMax * (1 - smoothing) +
                      prediction.box.xMax * smoothing,
                    yMax:
                      previous.box.yMax * (1 - smoothing) +
                      prediction.box.yMax * smoothing,
                  },
                }
              })
            }
          } else {
            candidateLabel = null
            candidateCount = 0
            missedPredictions += 1
            if (missedPredictions >= REQUIRED_STABLE_PREDICTIONS) {
              setCandidate(null)
              setResult(null)
            }
          }

          if (
            textRecognitionService &&
            textRecognitionReady &&
            prediction?.label !== 'apple' &&
            prediction?.label !== 'banana' &&
            !textRecognitionInProgress &&
            Date.now() - lastTextRecognitionAt >=
              TEXT_RECOGNITION_INTERVAL_MS
          ) {
            textRecognitionInProgress = true
            lastTextRecognitionAt = Date.now()
            setTextAnalyzing(true)
            textRecognitionTask = textRecognitionService
              .recognizeFrame(video)
              .then((textPrediction) => {
                if (active) {
                  setTextResult(textPrediction)
                  setTextError(null)
                }
              })
              .catch((textRecognitionError: unknown) => {
                if (active) {
                  setTextError(getErrorMessage(textRecognitionError))
                }
              })
              .finally(() => {
                textRecognitionInProgress = false
                if (active) {
                  setTextAnalyzing(false)
                }
              })
          }

          await wait(INFERENCE_INTERVAL_MS)
        }
      } catch (recognitionError) {
        if (active) {
          setError(getErrorMessage(recognitionError))
          setStatus('error')
        }
      } finally {
        if (textRecognitionLoad) {
          await textRecognitionLoad
        }
        if (textRecognitionTask) {
          await textRecognitionTask
        }
        if (textRecognitionService) {
          try {
            await textRecognitionService.dispose()
          } catch (textReleaseError) {
            if (active) {
              setTextError(getErrorMessage(textReleaseError))
            }
          }
        }
        if (recognitionService) {
          try {
            await recognitionService.dispose()
          } catch (releaseError) {
            if (active) {
              setError(getErrorMessage(releaseError))
              setStatus('error')
            }
          }
        }
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [enabled, videoRef])

  const shouldDisplayText =
    textResult?.label === 'monster-energy' ||
    (textResult !== null &&
      (!result ||
        result.label === 'unknown' ||
        (result.label === 'object' && !result.foodCategory)))

  return {
    candidate: shouldDisplayText ? null : candidate,
    error,
    result: shouldDisplayText ? textResult : result,
    status,
    textAnalyzing,
    textError,
  }
}
