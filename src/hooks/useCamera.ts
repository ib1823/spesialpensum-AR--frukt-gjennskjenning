import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCameraErrorMessage,
  requestCameraStream,
  stopCameraStream,
} from '../services/cameraService'

type CameraStatus = 'idle' | 'starting' | 'running' | 'error'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const requestIdRef = useRef(0)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    requestIdRef.current += 1
    const stream = streamRef.current
    streamRef.current = null

    if (stream) {
      stopCameraStream(stream)
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setError(null)
    setStatus('idle')
  }, [])

  const startCamera = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setError(null)
    setStatus('starting')

    try {
      const stream = await requestCameraStream()

      if (requestId !== requestIdRef.current) {
        stopCameraStream(stream)
        return
      }

      const video = videoRef.current
      if (!video) {
        stopCameraStream(stream)
        throw new Error('Kameraforhåndsvisningen er ikke tilgjengelig.')
      }

      streamRef.current = stream
      video.srcObject = stream
      await video.play()

      if (requestId === requestIdRef.current) {
        setStatus('running')
      } else {
        stopCameraStream(stream)
      }
    } catch (cameraError) {
      if (requestId === requestIdRef.current) {
        const stream = streamRef.current
        streamRef.current = null
        if (stream) {
          stopCameraStream(stream)
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null
        }
        setError(getCameraErrorMessage(cameraError))
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      requestIdRef.current += 1
      if (streamRef.current) {
        stopCameraStream(streamRef.current)
      }
    }
  }, [])

  return {
    error,
    isRunning: status === 'running',
    isStarting: status === 'starting',
    startCamera,
    status,
    stopCamera,
    videoRef,
  }
}
