import { useEffect, useState } from 'react'
import {
  loadRecognitionModel,
  recognizeFrame,
} from '../services/recognitionService'
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
  const [status, setStatus] = useState<RecognitionStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setResult(null)
      setError(null)
      setStatus('idle')
      return
    }

    let active = true
    let candidateLabel: RecognitionResult['label'] | null = null
    let candidateCount = 0
    let session: Awaited<ReturnType<typeof loadRecognitionModel>> | null = null

    setResult(null)
    setError(null)
    setStatus('loading')

    const run = async () => {
      try {
        session = await loadRecognitionModel()
        if (!active) {
          return
        }

        setStatus('ready')
        const video = videoRef.current
        if (!video) {
          throw new Error('Kameraforhåndsvisningen er ikke tilgjengelig.')
        }

        while (active) {
          const prediction = await recognizeFrame(session, video)
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

            if (candidateCount >= REQUIRED_STABLE_PREDICTIONS) {
              setResult(prediction)
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
        if (session) {
          try {
            await session.release()
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

  return { error, result, status }
}
