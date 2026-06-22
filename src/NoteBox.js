import React from 'react';

export default function NoteBox({ semi, getNote, activeNote, cents, limit, onStart, onStop, styles }) {
  const noteName = getNote(semi);

  if (!noteName) {
    return <div style={{ height: 'calc(9.5vw - 8px)', width: 'calc(9.5vw - 8px)', maxWidth: '75px', maxHeight: '75px', margin: '2px 0' }} />;
  }

  const isActive = activeNote === noteName;
  // 숫자를 완벽하게 지워 요청하신 표기(A, Ab, B, Db, E, Eb, D, F, G, Gb, C, B, Bb) 그대로 화면에 고정 출력
  const displayLabel = noteName.replace(/\d+/g, '');

  const safeCents = Math.max(-limit, Math.min(limit, cents));
  const indicatorLeft = 50 + (safeCents / limit) * 40;

  return (
    <div
      style={styles.cell(isActive, cents, limit)}
      onMouseDown={() => onStart(noteName)}
      onMouseUp={onStop}
      onMouseLeave={onStop}
      onTouchStart={(e) => { if (e.cancelable) e.preventDefault(); onStart(noteName); }}
      onTouchEnd={onStop}
    >
      <span style={{ fontWeight: '900', fontSize: 'min(18px, 3vw)', color: isActive ? 'black' : '#94a3b8', zIndex: 10, pointerEvents: 'none' }}>
        {displayLabel}
      </span>
      {isActive && (
        <div style={{ position: 'absolute', left: `${indicatorLeft}%`, width: '3px', height: '100%', backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 5, pointerEvents: 'none' }} />
      )}
    </div>
  );
}
