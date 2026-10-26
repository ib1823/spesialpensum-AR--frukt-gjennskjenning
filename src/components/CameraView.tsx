import { useEffect, useRef, useState, type RefObject } from 'react'
import { ARFoodLabel } from './ARFoodLabel'
import { ARScanEffect } from './ARScanEffect'
import type {
  RecognitionResult,
  RecognitionStatus,
} from '../types/recognition'

type CameraViewProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  isRunning: boolean
  recognition: {
    candidate: RecognitionResult | null
    error: string | null
    result: RecognitionResult | null
    status: RecognitionStatus
    textAnalyzing: boolean
    textError: string | null
  }
}

type OverlayPosition = {
  left: number
  top: number
  placement: 'above' | 'below'
  bounds: {
    left: number
    top: number
    width: number
    height: number
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
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
  const screenLeft = videoRect.left + xMin * renderedWidth - cropX
  const screenRight = videoRect.left + xMax * renderedWidth - cropX
  const screenTop = videoRect.top + box.yMin * renderedHeight - cropY
  const screenBottom = videoRect.top + box.yMax * renderedHeight - cropY
  const boundsLeft = clamp(
    ((screenLeft - containerRect.left) / containerRect.width) * 100,
    0,
    100,
  )
  const boundsRight = clamp(
    ((screenRight - containerRect.left) / containerRect.width) * 100,
    0,
    100,
  )
  const boundsTop = clamp(
    ((screenTop - containerRect.top) / containerRect.height) * 100,
    0,
    100,
  )
  const boundsBottom = clamp(
    ((screenBottom - containerRect.top) / containerRect.height) * 100,
    0,
    100,
  )

  if (boundsRight <= boundsLeft || boundsBottom <= boundsTop) {
    return null
  }

  const placeAbove = boundsTop > 32
  const labelY = placeAbove ? boundsTop : boundsBottom
  const labelWidthPercent =
    (Math.min(280, containerRect.width - 24) / containerRect.width) * 100

  return {
    left: clamp(
      (boundsLeft + boundsRight) / 2,
      labelWidthPercent / 2,
      100 - labelWidthPercent / 2,
    ),
    top: clamp(labelY, 6, 72),
    placement: placeAbove ? 'above' : 'below',
    bounds: {
      left: boundsLeft,
      top: boundsTop,
      width: boundsRight - boundsLeft,
      height: boundsBottom - boundsTop,
    },
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
  const evaluating =
    recognition.textAnalyzing ||
    (Boolean(recognition.candidate) &&
      (!recognition.result ||
        recognition.candidate?.label !== recognition.result.label))

  useEffect(() => {
    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video || !isRunning) {
      setOverlayPosition(null)
      return
    }

    const updatePosition = () => {
      setOverlayPosition(
        getOverlayPosition(
          container,
          video,
          evaluating ? recognition.candidate : recognition.result,
        ),
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
  }, [
    evaluating,
    isRunning,
    recognition.candidate,
    recognition.result,
    videoRef,
  ])

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
        <>
          {recognition.status !== 'error' && (
            <ARScanEffect
              box={
                overlayPosition?.bounds
                  ? {
                      xMin: overlayPosition.bounds.left / 100,
                      yMin: overlayPosition.bounds.top / 100,
                      xMax:
                        (overlayPosition.bounds.left +
                          overlayPosition.bounds.width) /
                        100,
                      yMax:
                        (overlayPosition.bounds.top +
                          overlayPosition.bounds.height) /
                        100,
                    }
                  : null
              }
              state={
                evaluating
                  ? 'analyzing'
                  : recognition.result?.label === 'unknown'
                    ? 'unknown'
                    : recognition.result
                      ? 'recognized'
                      : 'searching'
              }
            />
          )}
          <ARFoodLabel
            error={recognition.error}
            result={recognition.result}
            status={recognition.status}
            evaluating={evaluating}
            candidate={recognition.candidate}
            position={overlayPosition}
            textAnalyzing={recognition.textAnalyzing}
            textError={recognition.textError}
          />
        </>
      )}
    </div>
  )
}
