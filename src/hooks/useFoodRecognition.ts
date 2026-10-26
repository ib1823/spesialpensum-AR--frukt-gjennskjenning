import { useEffect, useState } from 'react'
import { RecognitionService } from '../services/recognitionService'
import type {
  RecognitionResult,
  RecognitionStatus,
} from '../types/recognition'

const INFERENCE_INTERVAL_MS = 1000
const REQUIRED_STABLE_PREDICTIONS = 2

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Matgjenkjenningen kunne ikke startes.'
}

export function useFoodRecognition(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
) {
  const [result, setResult] = useState<RecognitionResult | null>(null)
  const [candidate, setCandidate] = useState<RecognitionResult | null>(null)
  const [status, setStatus] = useState<RecognitionStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setResult(null)
      setCandidate(null)
      setError(null)
      setStatus('idle')
      return
    }

    let active = true
    let candidateLabel: RecognitionResult['label'] | null = null
    let candidateCount = 0

    setResult(null)
    setCandidate(null)
    setError(null)
    setStatus('loading')

    const run = async () => {
      let recognitionService: RecognitionService | null = null

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

        while (active) {
          const prediction = await recognitionService.recognizeFrame(video)
          if (!active) {
            break
          }

          if (prediction) {
            if (prediction.label === candidateLabel) {
              candidateCount += 1
            } else {
              candidateLabel = prediction.label
              candidateCount = 1
            }

            setCandidate((previous) => {
              if (
                previous?.label !== prediction.label ||
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
                  previous?.label !== prediction.label ||
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
          }

          await wait(INFERENCE_INTERVAL_MS)
        }
      } catch (recognitionError) {
        if (active) {
          setError(getErrorMessage(recognitionError))
          setStatus('error')
        }
      } finally {
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

  return { candidate, error, result, status }
}
