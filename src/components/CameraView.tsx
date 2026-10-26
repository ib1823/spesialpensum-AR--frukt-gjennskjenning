import { useEffect, useRef, useState, type RefObject } from 'react'
import { RecognitionBadge } from './RecognitionBadge'
import type {
  RecognitionResult,
  RecognitionStatus,
} from '../types/recognition'

type CameraViewProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  isRunning: boolean
  recognition: {
    error: string | null
    result: RecognitionResult | null
    status: RecognitionStatus
  }
}

type OverlayPosition = {
  left: number
  top: number
  placement: 'above' | 'below'
}

function getOverlayPosition(
  container: HTMLDivElement,
  video: HTMLVideoElement,
  result: RecognitionResult | null,
): OverlayPosition | null {
  const box = result?.box
  if (!box || !video.videoWidth || !video.videoHeight) {
    return null
  }

  const containerRect = container.getBoundingClientRect()
  const videoRect = video.getBoundingClientRect()
  const scale = Math.max(
    videoRect.width / video.videoWidth,
    videoRect.height / video.videoHeight,
  )
  const renderedWidth = video.videoWidth * scale
  const renderedHeight = video.videoHeight * scale
  const cropX = (renderedWidth - videoRect.width) / 2
  const cropY = (renderedHeight - videoRect.height) / 2
  const transform = window.getComputedStyle(video).transform
  const mirrored =
    transform !== 'none' && new DOMMatrixReadOnly(transform).a < 0
  const xMin = mirrored ? 1 - box.xMax : box.xMin
  const xMax = mirrored ? 1 - box.xMin : box.xMax
  const centerX = (xMin + xMax) / 2
  const labelY = box.yMin > 0.22 ? box.yMin : box.yMax
  const screenX = videoRect.left + centerX * renderedWidth - cropX
  const screenY = videoRect.top + labelY * renderedHeight - cropY

  return {
    left: Math.min(
      94,
      Math.max(6, ((screenX - containerRect.left) / containerRect.width) * 100),
    ),
    top: Math.min(
      94,
      Math.max(6, ((screenY - containerRect.top) / containerRect.height) * 100),
    ),
    placement: box.yMin > 0.22 ? 'above' : 'below',
  }
}

export function CameraView({
  videoRef,
  isRunning,
  recognition,
}: CameraViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [overlayPosition, setOverlayPosition] =
    useState<OverlayPosition | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video || !isRunning) {
      setOverlayPosition(null)
      return
    }

    const updatePosition = () => {
      setOverlayPosition(
        getOverlayPosition(container, video, recognition.result),
      )
    }

    const resizeObserver = new ResizeObserver(updatePosition)
    resizeObserver.observe(container)
    video.addEventListener('loadedmetadata', updatePosition)
    window.addEventListener('resize', updatePosition)
    updatePosition()

    return () => {
      resizeObserver.disconnect()
      video.removeEventListener('loadedmetadata', updatePosition)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isRunning, recognition.result, videoRef])

  return (
    <div
      ref={containerRef}
      className={`camera-view${isRunning ? ' camera-view--active' : ''}`}
      aria-label={isRunning ? 'Live kamerabilde' : 'Kameraforhåndsvisning'}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="Kamerabilde"
      />
      {!isRunning && (
        <div className="camera-placeholder" aria-hidden="true">
          <span className="camera-placeholder__icon">
            <svg viewBox="0 0 48 48" fill="none">
              <path
                d="M8 16.5A3.5 3.5 0 0 1 11.5 13h5l2.4-3h10.2l2.4 3h5a3.5 3.5 0 0 1 3.5 3.5v19a3.5 3.5 0 0 1-3.5 3.5h-25A3.5 3.5 0 0 1 8 35.5v-19Z"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <circle
                cx="24"
                cy="25"
                r="7"
                stroke="currentColor"
                strokeWidth="2.5"
              />
            </svg>
          </span>
          <p>Klar når du er</p>
          <span>Start kameraet for å se omgivelsene dine</span>
        </div>
      )}
      <span className="camera-live-indicator" aria-hidden="true">
        <span />
        LIVE
      </span>
      {isRunning && (
        <RecognitionBadge
          error={recognition.error}
          result={recognition.result}
          status={recognition.status}
          position={overlayPosition}
        />
      )}
    </div>
  )
}
