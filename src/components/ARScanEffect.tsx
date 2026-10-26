import type { RecognitionBox } from '../types/recognition'

type ARScanEffectProps = {
  box: RecognitionBox | null
  state: 'searching' | 'analyzing' | 'recognized' | 'unknown'
}

function getBoxStyle(box: RecognitionBox | null) {
  if (!box) {
    return undefined
  }

  return {
    left: `${box.xMin}%`,
    top: `${box.yMin}%`,
    width: `${box.xMax - box.xMin}%`,
    height: `${box.yMax - box.yMin}%`,
  }
}

export function ARScanEffect({ box, state }: ARScanEffectProps) {
  const hasDetection = box !== null
  const style = getBoxStyle(box)

  return (
    <div
      className={`ar-scan-target${hasDetection ? ' ar-scan-target--detected' : ' ar-scan-target--guide'} ar-scan-target--${state}`}
      aria-hidden="true"
      style={style}
    >
      <span className="ar-scan-target__corner ar-scan-target__corner--tl" />
      <span className="ar-scan-target__corner ar-scan-target__corner--tr" />
      <span className="ar-scan-target__corner ar-scan-target__corner--bl" />
      <span className="ar-scan-target__corner ar-scan-target__corner--br" />
      {(state === 'searching' || state === 'analyzing') && (
        <span className="ar-scan-target__scanline" />
      )}
      {hasDetection && (
        <span className="ar-scan-target__particles">
          <i />
          <i />
          <i />
        </span>
      )}
    </div>
  )
}
