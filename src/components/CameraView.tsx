import { useEffect, useRef, useState, type RefObject } from 'react'
import { ARFoodLabel } from './ARFoodLabel'
import { ARScanEffect } from './ARScanEffect'
import { NutritionLookup } from './NutritionLookup'
import type {
  RecognitionResult,
  RecognitionStatus,
} from '../types/recognition'

type CameraViewProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  isRunning: boolean
  recognition: {
    candidate: RecognitionResult | null
    detections: RecognitionResult[]
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
  placement: 'above' | 'below' | 'left' | 'right'
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

function getFoodName(detection: RecognitionResult): string {
  if (detection.label === 'apple') {
    return 'Eple'
  }
  if (detection.label === 'banana') {
    return 'Banan'
  }

  const names: Record<string, string> = {
    broccoli: 'Brokkoli',
    carrot: 'Gulrot',
    cake: 'Kake',
    donut: 'Smultring',
    'hot-dog': 'Pølse i brød',
    orange: 'Appelsin',
    pizza: 'Pizza',
    sandwich: 'Smørbrød',
  }
  return detection.foodCategory
    ? (names[detection.foodCategory] ?? 'Matvare')
    : 'Matvare'
}

function getIntersectionOverUnion(
  first: OverlayPosition['bounds'],
  second: OverlayPosition['bounds'],
): number {
  const overlapWidth = Math.max(
    0,
    Math.min(first.left + first.width, second.left + second.width) -
      Math.max(first.left, second.left),
  )
  const overlapHeight = Math.max(
    0,
    Math.min(first.top + first.height, second.top + second.height) -
      Math.max(first.top, second.top),
  )
  const intersection = overlapWidth * overlapHeight
  const union =
    first.width * first.height +
    second.width * second.height -
    intersection
  return union > 0 ? intersection / union : 0
}

function findTrackedDetection(
  target: RecognitionResult,
  detections: RecognitionResult[],
  container: HTMLDivElement,
  video: HTMLVideoElement,
): RecognitionResult | null {
  const targetPosition = getOverlayPosition(container, video, target)
  if (!targetPosition) {
    return null
  }

  let bestMatch: RecognitionResult | null = null
  let bestScore = 0

  for (const detection of detections) {
    if (
      !detection.box ||
      detection.label !== target.label ||
      detection.foodCategory !== target.foodCategory ||
      (target.label === 'object' &&
        detection.recognizedText !== target.recognizedText)
    ) {
      continue
    }

    const detectionPosition = getOverlayPosition(container, video, detection)
    if (!detectionPosition) {
      continue
    }

    const overlap = getIntersectionOverUnion(
      targetPosition.bounds,
      detectionPosition.bounds,
    )
    const targetCenterX =
      targetPosition.bounds.left + targetPosition.bounds.width / 2
    const targetCenterY =
      targetPosition.bounds.top + targetPosition.bounds.height / 2
    const detectionCenterX =
      detectionPosition.bounds.left + detectionPosition.bounds.width / 2
    const detectionCenterY =
      detectionPosition.bounds.top + detectionPosition.bounds.height / 2
    const distance = Math.hypot(
      targetCenterX - detectionCenterX,
      targetCenterY - detectionCenterY,
    )
    const targetDiagonal = Math.hypot(
      targetPosition.bounds.width,
      targetPosition.bounds.height,
    )
    const maximumDistance = Math.max(6, targetDiagonal * 0.8)
    const score =
      overlap >= 0.08
        ? overlap
        : distance <= maximumDistance
          ? 0.08 - distance / (maximumDistance * 100)
          : 0

    if (score > bestScore) {
      bestMatch = detection
      bestScore = score
    }
  }

  return bestMatch
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
  if (!containerRect.width || !containerRect.height) {
    return null
  }
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

  const labelWidth = Math.min(300, containerRect.width - 24)
  const labelHeight = Math.min(320, containerRect.height - 24)
  const gap = 14
  const spaces = {
    right: containerRect.width * (1 - boundsRight),
    left: containerRect.width * boundsLeft,
    above: containerRect.height * boundsTop,
    below: containerRect.height * (1 - boundsBottom),
  }
  const fittingPlacement = (
    ['right', 'left', 'above', 'below'] as const
  ).find((placement) => {
    const required =
      placement === 'right' || placement === 'left'
        ? labelWidth + gap
        : labelHeight + gap
    return spaces[placement] >= required
  })
  const placement =
    fittingPlacement ??
    (Object.entries(spaces).sort((first, second) => second[1] - first[1])[0][0] as
      | 'above'
      | 'below'
      | 'left'
      | 'right')
  const labelWidthPercent = (labelWidth / containerRect.width) * 100
  const labelHeightPercent = (labelHeight / containerRect.height) * 100
  const centerX = (boundsLeft + boundsRight) / 2
  const centerY = (boundsTop + boundsBottom) / 2
  const labelLeft =
    placement === 'right'
      ? clamp(boundsRight, 8 / containerRect.width, 100 - labelWidthPercent)
      : placement === 'left'
        ? clamp(boundsLeft, labelWidthPercent, 100 - 8 / containerRect.width)
        : clamp(centerX, labelWidthPercent / 2, 100 - labelWidthPercent / 2)
  const labelTop =
    placement === 'above'
      ? clamp(
          boundsTop,
          labelHeightPercent + 2,
          100 - 8 / containerRect.height,
        )
      : placement === 'below'
        ? clamp(
            boundsBottom,
            8 / containerRect.height,
            98 - labelHeightPercent,
          )
        : clamp(
            centerY,
            labelHeightPercent / 2,
            100 - labelHeightPercent / 2,
          )

  return {
    left: labelLeft,
    top: labelTop,
    placement,
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
  const [trackedResult, setTrackedResult] =
    useState<RecognitionResult | null>(null)
  const [selectedTarget, setSelectedTarget] =
    useState<RecognitionResult | null>(null)
  const [trackingVisible, setTrackingVisible] = useState(true)
  const selectionVersionRef = useRef(0)
  const evaluating =
    !selectedTarget &&
    (recognition.textAnalyzing ||
      (Boolean(recognition.candidate) &&
        (!recognition.result ||
          recognition.candidate?.label !== recognition.result.label ||
          recognition.candidate?.recognizedText !==
            recognition.result.recognizedText)))
  const detectionsRef = useRef<RecognitionResult[]>(recognition.detections)
  detectionsRef.current = recognition.detections
  const selectedTargetRef = useRef<RecognitionResult | null>(selectedTarget)
  selectedTargetRef.current = selectedTarget

  useEffect(() => {
    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video || !isRunning) {
      setOverlayPosition(null)
      setTrackedResult(null)
      setSelectedTarget(null)
      selectedTargetRef.current = null
      selectionVersionRef.current += 1
      setTrackingVisible(true)
      return
    }

    let animationFrame = 0
    let lastFrameAt = 0
    let lastPublishedAt = 0
    let lastDetectionAt = 0
    let currentPosition: OverlayPosition | null = null
    let currentResult: RecognitionResult | null = null
    let visible = true
    let previousSelectionVersion = selectionVersionRef.current
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const animate = (timestamp: number) => {
      const delta = lastFrameAt ? timestamp - lastFrameAt : 16
      lastFrameAt = timestamp
      if (previousSelectionVersion !== selectionVersionRef.current) {
        previousSelectionVersion = selectionVersionRef.current
        currentPosition = null
        currentResult = null
        lastDetectionAt = 0
      }
      const selected = selectedTargetRef.current
      const targetResult = selected
        ? findTrackedDetection(
            selected,
            detectionsRef.current,
            container,
            video,
          )
        : null
      if (targetResult && targetResult !== selected) {
        selectedTargetRef.current = targetResult
        setSelectedTarget(targetResult)
      }
      const markTrackMissing = () => {
        if (!currentResult) {
          return
        }
        const missingFor = timestamp - lastDetectionAt
        if (visible && missingFor > 500) {
          visible = false
          setTrackingVisible(false)
        }
        if (missingFor > 800) {
          currentPosition = null
          currentResult = null
          setTrackedResult(null)
        }
      }

      if (targetResult?.box) {
        const targetPosition = getOverlayPosition(container, video, targetResult)
        if (targetPosition) {
          const sameTrack =
            currentResult?.label === targetResult.label &&
            currentResult?.recognizedText === targetResult.recognizedText
          const smoothing = reduceMotion ? 1 : 1 - Math.exp(-delta / 110)
          currentPosition =
            !sameTrack || !currentPosition
              ? targetPosition
              : {
                  ...targetPosition,
                  left:
                    currentPosition.left +
                    (targetPosition.left - currentPosition.left) * smoothing,
                  top:
                    currentPosition.top +
                    (targetPosition.top - currentPosition.top) * smoothing,
                  bounds: {
                    left:
                      currentPosition.bounds.left +
                      (targetPosition.bounds.left -
                        currentPosition.bounds.left) *
                        smoothing,
                    top:
                      currentPosition.bounds.top +
                      (targetPosition.bounds.top -
                        currentPosition.bounds.top) *
                        smoothing,
                    width:
                      currentPosition.bounds.width +
                      (targetPosition.bounds.width -
                        currentPosition.bounds.width) *
                        smoothing,
                    height:
                      currentPosition.bounds.height +
                      (targetPosition.bounds.height -
                        currentPosition.bounds.height) *
                        smoothing,
                  },
                }
          currentResult = targetResult
          lastDetectionAt = timestamp
          if (!visible) {
            visible = true
            setTrackingVisible(true)
          }
          setTrackedResult((previous) =>
            previous === targetResult ? previous : targetResult,
          )
        } else {
          markTrackMissing()
        }
      } else {
        markTrackMissing()
      }

      if (timestamp - lastPublishedAt >= 32) {
        lastPublishedAt = timestamp
        setOverlayPosition(currentPosition)
      }
      animationFrame = window.requestAnimationFrame(animate)
    }

    const resizeObserver = new ResizeObserver(() => {
      const target = selectedTargetRef.current
      if (target) {
        currentPosition = getOverlayPosition(container, video, target)
      }
    })
    resizeObserver.observe(container)
    animationFrame = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [isRunning, videoRef])

  const displayedResult = selectedTarget ? trackedResult : null
  const selectableDetections = recognition.detections
    .filter(
      (detection) =>
        detection.box &&
        (detection.foodCategory || detection.recognizedText),
    )
    .slice()
    .reverse()
  const selectTarget = (target: RecognitionResult) => {
    selectionVersionRef.current += 1
    selectedTargetRef.current = target
    setSelectedTarget(target)
    setTrackedResult(target)
    setOverlayPosition(
      containerRef.current && videoRef.current
        ? getOverlayPosition(containerRef.current, videoRef.current, target)
        : null,
    )
    setTrackingVisible(true)
  }
  const clearSelectedTarget = () => {
    selectionVersionRef.current += 1
    selectedTargetRef.current = null
    setSelectedTarget(null)
    setTrackedResult(null)
    setOverlayPosition(null)
    setTrackingVisible(true)
  }
  const showNutritionLookup = Boolean(
    selectedTarget &&
      trackedResult?.foodCategory &&
      trackedResult.label !== 'apple' &&
      trackedResult.label !== 'banana' &&
      overlayPosition,
  )

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
          {!selectedTarget && (
            <div className="camera-target-prompt" role="status">
              {selectableDetections.length
                ? 'Trykk på objektet du vil velge'
                : 'Pek kameraet mot et objekt og velg det når rammen vises'}
            </div>
          )}
          {selectedTarget && (
            <button
              className="camera-target-clear"
              type="button"
              onClick={clearSelectedTarget}
            >
              Velg en annen vare
            </button>
          )}
          {!selectedTarget &&
            selectableDetections.map((detection, index) => {
              const position =
                containerRef.current && videoRef.current
                  ? getOverlayPosition(
                      containerRef.current,
                      videoRef.current,
                      detection,
                    )
                  : null
              if (!position) {
                return null
              }
              const itemName =
                detection.label === 'object'
                  ? detection.recognizedText ?? 'Objekt'
                  : getFoodName(detection)
              return (
                <button
                  aria-label={`Velg ${itemName}`}
                  className="camera-target-option"
                  key={`${detection.foodCategory}-${index}`}
                  onClick={() => selectTarget(detection)}
                  style={{
                    left: `${position.bounds.left}%`,
                    top: `${position.bounds.top}%`,
                    width: `${position.bounds.width}%`,
                    height: `${position.bounds.height}%`,
                  }}
                  type="button"
                >
                  <span>{itemName}</span>
                </button>
              )
            })}
          {showNutritionLookup &&
            trackedResult?.foodCategory &&
            overlayPosition && (
              <NutritionLookup
                key={trackedResult.foodCategory}
                category={trackedResult.foodCategory}
                detectedName={
                  trackedResult.label === 'monster-energy'
                    ? 'Monster Energy'
                    : trackedResult.recognizedText ??
                      'Gjenkjent matvare'
                }
                position={overlayPosition}
                trackingVisible={trackingVisible}
              />
            )}
          {recognition.status !== 'error' &&
            (!selectedTarget || trackingVisible) && (
            <ARScanEffect
              box={
                trackingVisible && overlayPosition?.bounds
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
                !trackingVisible && trackedResult
                  ? 'searching'
                  : evaluating
                  ? 'analyzing'
                  : displayedResult?.label === 'unknown'
                    ? 'unknown'
                    : displayedResult
                      ? 'recognized'
                      : 'searching'
              }
            />
          )}
          {selectedTarget && displayedResult && !showNutritionLookup && (
            <ARFoodLabel
              error={recognition.error}
              result={displayedResult}
              status={recognition.status}
              evaluating={evaluating}
              candidate={recognition.candidate}
              position={overlayPosition}
              textAnalyzing={recognition.textAnalyzing}
              textError={recognition.textError}
              trackingVisible={trackingVisible}
            />
          )}
        </>
      )}
    </div>
  )
}
