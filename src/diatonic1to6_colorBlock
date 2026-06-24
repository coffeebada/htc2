// =========================================================================
// 🎯 [교정 완결] 다이아토닉 1~6번 오버블로우(빨간색)/드로우벤딩(하늘색) 부활 NoteBox 엔진
// =========================================================================
function NoteBox({ semi, getNote, activeNote, cents, limit, onStart, onStop, isBlowZone, isDrawZone, isTopBb, holeNum, showOverbanding, selectedTuning, scaleNotesResult, useScaleHighlight, isSliderZone, isTremoloMode, tremoloLabelFn }) {
  const noteName = getNote(semi);
  if (semi === null || !noteName) return <div style={{ width: '100%', height: '100%', margin: '3px 0' }}></div>;
  
  const isActive = activeNote === noteName;
  
  let displayLabel = (isTremoloMode && typeof tremoloLabelFn === 'function') 
    ? tremoloLabelFn(noteName) 
    : noteName.replace(/\d+/g, '');
    
  displayLabel = displayLabel
    .replace(/[\u0300-\u036f\u0307\u0308\u0323\u0324]/g, '')
    .normalize('NFC')
    .replace(/[Åå]/g, 'A').replace(/[Ėė]/g, 'E').replace(/[Ċċ]/g, 'C')
    .replace(/[Ġġ]/g, 'G').replace(/[Ḃḃ]/g, 'B').replace(/[Ḋḋ]/g, 'D');

  const safeCents = Math.max(-limit, Math.min(limit, cents));
  const indicatorLeft = 50 + (safeCents / limit) * 40;
  
  let bgColor = '#1e293b'; 
  let borderStyle = '1px solid #334155';

  if (isActive) { 
    bgColor = Math.abs(cents) <= limit ? '#22c55e' : (cents > limit ? '#eab308' : '#ef4444'); 
  } else { 
    if (isSliderZone) { bgColor = '#60a5fa'; } 
    else if (isTopBb) { bgColor = '#93c5fd'; } 
    // 🅰️ [다이아토닉 특수 행 피드백 컬러 완벽 부활]
    else if (isBlowZone) {
      // 🎯 다이아토닉 모드일 때만 작동하도록 가드하여 트레몰로의 영역 침범 원천 차단
      if (holeNum >= 1 && holeNum <= 6 && !isTremoloMode) {
        bgColor = '#ef4444'; // 👈 오버블로우 밴딩 영역 빨간색 지정 완료
      }
      else if ((selectedTuning === 'Natural Minor' || selectedTuning === 'Harmonic' || selectedTuning === 'Harmonic Minor') && holeNum === 7) { bgColor = '#93c5fd'; } 
      else if (holeNum >= 8 && holeNum <= 10) { bgColor = '#93c5fd'; } 
      else { bgColor = '#1e293b'; }
    } 
    else if (isDrawZone) {
      if (holeNum >= 1 && holeNum <= 6 && !isTremoloMode) {
        bgColor = '#38bdf8'; // 👈 드로우 밴딩 영역 하늘색 지정 완료
      }
      else if (holeNum >= 7 && holeNum <= 10) { bgColor = '#f59e0b'; } 
      else { bgColor = '#1e293b'; }
    }
  }

  const isScaleComponent = scaleNotesResult && scaleNotesResult.includes(noteName.replace(/\d+/g, ''));
  let textColor = 'white';
  if (useScaleHighlight && !isActive && isScaleComponent) { textColor = '#facc15'; }

  const dotsInfo = isTremoloMode ? calculateAbsoluteOctaveDots(noteName) : { position: 'none', count: 0 };

  const renderOctaveDots = () => {
    if (dotsInfo.position === 'none' || dotsInfo.count === 0) return null;
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, [dotsInfo.position]: '6px', display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: '4px', height: '4px', pointerEvents: 'none', zIndex: 15 }}>
        {Array.from({ length: dotsInfo.count }).map((_, dIdx) => (
          <div key={dIdx} style={{ width: '4px', height: '4px', backgroundColor: '#ffffff', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.8)' }} />
        ))}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', margin: '2px 0', borderRadius: '14px', border: borderStyle, backgroundColor: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'visible', cursor: 'pointer', padding: '0px', boxSizing: 'border-box', ...GLOBAL_NO_SELECT_STYLE }} onMouseDown={() => onStart(noteName)} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={() => onStart(noteName)} onTouchEnd={onStop}>
      {renderOctaveDots()}
      {isTremoloMode ? (
        <svg viewBox="-50 0 200 42" preserveAspectRatio="xMidYMid meet" style={{ width: '160%', height: '100%', overflow: 'visible', pointerEvents: 'none', ...GLOBAL_NO_SELECT_STYLE }}>
          <text x="50" y="23" textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: '800', fill: textColor, zIndex: 10, fontFamily: 'system-ui, -apple-system, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.95)', fontSize: isSliderZone ? (displayLabel.length >= 2 ? '22px' : '26px') : (displayLabel.length >= 2 ? '26px' : '30px'), ...GLOBAL_NO_SELECT_STYLE }}>{displayLabel}</text>
        </svg>
      ) : (
        <span style={{ fontWeight: '600', fontSize: '24px', color: textColor, zIndex: 10, pointerEvents: 'none', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,0.8)', ...GLOBAL_NO_SELECT_STYLE }}>{displayLabel}</span>
      )}
      {isActive && <div style={{ position: 'absolute', left: `${indicatorLeft}%`, width: '4px', height: '100%', backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 5 }} />}
    </div>
  );
}
