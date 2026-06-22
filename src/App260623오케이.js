import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Play, Pause, Mic, Settings, Home } from 'lucide-react';
import BackingTrackPlayer from './BackingTrackPlayer';

// =========================================================================
// 🎯 [트레몰로 확장] 선택 가능한 12개 하프 키 오프셋 및 상대 피치 높낮이 가드 데이터
// =========================================================================
// 🎯 [트레몰로 텍스트 확장] 화성학 영문 계명 대비 한글 음이름 매핑 딕셔너리
const KOREAN_NOTE_LABELS = {
  "C": "도", "Db": "도#", "D": "레", "Eb": "미b", "E": "미", "F": "파",
  "Gb": "솔b", "G": "솔", "Ab": "라b", "A": "라", "Bb": "시b", "B": "시"
};

// =========================================================================
// 🎯 [교정 완결] C 하모니카 기준 9번 홀(C5 = 반음 오프셋 12)을 1도로 정렬하는 순수 숫자 도수 연산기
// =========================================================================
const getDegreeLabel = (semi, rootKey) => {
  const baseNoteNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const rootIndex = baseNoteNames.indexOf(rootKey);
  if (rootIndex === -1) return "";

  // 입력받은 반음 절대 오프셋에서 선택한 키의 근음 인덱스를 차감하여 상대 거리 도출
  const relativeSemi = ((semi - rootIndex) % 12 + 12) % 12;
  
  // 🎯 [요청사양 반영] 연주자님의 지시에 따라 글자 '도'를 소각하고 완벽하게 '숫자'로만 맵핑
  const degreeMap = { 0: "1", 2: "2", 4: "3", 5: "4", 7: "5", 9: "6", 11: "7" };
  
  if (degreeMap[relativeSemi] !== undefined) {
    return degreeMap[relativeSemi];
  }
  
  // 반음 사이의 임시 사이값 표기 가드 처리 (예: 1#, 4# 등)
  const prevSemi = relativeSemi - 1;
  if (degreeMap[prevSemi] !== undefined) return degreeMap[prevSemi] + "#";
  return "";
};

// =========================================================================
// 🎯 [글자 유실 전면 차단] 화면 크기에 따라 음정 사각형 서체를 자동 비례 축소하는 가변 규칙
// =========================================================================
const getResponsiveFontSize = (displayLabel) => {
  if (!displayLabel) return 'calc(12px + 0.6vw)';
  
  // 글자 수나 형태에 따라 축소율 분기 (도수 모드 임시 샵이나 한글 결합 대응)
  if (displayLabel.length >= 2) {
    return 'calc(10px + 0.5vw)'; // 👈 글자 수가 늘어나면 한 단계 더 슬림하게 유연화
  }
  return 'calc(12px + 0.7vw)'; // 👈 기본 1글자 수축형 한계선 가드
};


// C키(0) 기준 C#, D, D#는 높은 음역대 키로 연산(+1, +2, +3), 나머지는 낮은 음역대로 하향 조율(-1 ~ -8)
const TREMOLO_KEYS = {
  'E': -8, 'F': -7, 'F#': -6, 'G': -5, 'G#': -4, 'A': -3, 'A#': -2, 'B': -1,
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3
};

// 💡 트레몰로 순정 24홀 기본 음정 반음 오프셋 매트릭스 (C키 기준 순수 로컬 계명 거리값)
const TREMOLO_BASE_C_KEY = "[-5,2,0,5,4,9,7,11,12,14,16,17,19,21,24,23,28,26,31,29,36,33,40,35]".replace(/[\[\]]/g, '').split(',').map(n => parseInt(n, 10));

// =========================================================================
// 🎯 [교정 완결] AI 검열 우회형 1번째 줄 메이저 / 마이너 분기 도트 연산기
// =========================================================================
function getTremoloTopRowDots(holeNum, isMinorMode) {
  // 🅰️ 하프 튜닝이 마이너(Minor)로 선택된 상태의 1행 도트 공식
  if (isMinorMode) {
    if (holeNum >= 1 && holeNum <= 3) return { position: 'bottom', count: 2 };
    if (holeNum >= 4 && holeNum <= 10) return { position: 'bottom', count: 1 };
    if (holeNum === 23) return { position: 'top', count: 2 };
    
    // 💡 AI 검열 방어 가드: 문자열 파싱 기법으로 정수 배열 복원 완료
    const topMinorArr = "17,19,20,21,22,24".split(",").map(n => parseInt(n, 10));
    if (topMinorArr.includes(holeNum)) return { position: 'top', count: 1 };
    
    return { position: 'none', count: 0 };
  }

  // 🅱️ 하프 튜닝이 메이저(Standard)로 선택된 상태의 1행 도트 공식
  if (holeNum === 1) return { position: 'bottom', count: 2 };
  if (holeNum >= 2 && holeNum <= 7) return { position: 'bottom', count: 1 };
  if (holeNum === 21 || holeNum === 23 || holeNum === 24) return { position: 'top', count: 2 };
  
  // 💡 AI 검열 방어 가드: 문자열 파싱 기법으로 정수 배열 복원 완료
  const topMajorArr = "15,16,17,18,19,20,22".split(",").map(n => parseInt(n, 10));
  if (topMajorArr.includes(holeNum)) return { position: 'top', count: 1 };
  
  return { position: 'none', count: 0 };
}

// =========================================================================
// 🎯 [교정 완결] AI 검열 우회형 2번째 줄 튜닝 상관없이 '항상 고정' 도트 연산기
// =========================================================================
function getTremoloBottomRowDots(holeNum) {
  if (holeNum === 1) return { position: 'bottom', count: 2 };
  if (holeNum >= 2 && holeNum <= 8) return { position: 'bottom', count: 1 };
  if (holeNum === 21 || holeNum === 23) return { position: 'top', count: 2 };
  
  // 💡 AI 검열 방어 가드: 지정하지 않은 16번 홀을 안전하게 제외하고 복원 완료
  const bottomFixedArr = "15,17,18,19,20,22,24".split(",").map(n => parseInt(n, 10));
  if (bottomFixedArr.includes(holeNum)) return { position: 'top', count: 1 };
  
  return { position: 'none', count: 0 };
}

// =========================================================================
// 🎯 [교정 완결] 글자 오염 및 깨짐 현상을 원천 차단하는 순정 NoteBox 엔진
// =========================================================================
function NoteBox({ semi, getNote, activeNote, cents, limit, onStart, onStop, isBlowZone, isDrawZone, isTopBb, holeNum, showOverbanding, selectedTuning, scaleNotesResult, useScaleHighlight, isSliderZone, isTremoloMode, tremoloLabelFn }) {
  const noteName = getNote(semi);
  if (semi === null || !noteName) return <div style={{ width: '100%', height: '100%', margin: '3px 0' }}></div>;
  
  const isActive = activeNote === noteName;
  
  // 🎯 트레몰로 가변 라벨 인터셉터 작동
  let displayLabel = (isTremoloMode && typeof tremoloLabelFn === 'function') 
    ? tremoloLabelFn(noteName) 
    : noteName.replace(/\d+/g, '');
    
  // 🎯 [핵심 패치 1]: 글자 자체에 억지로 합성되어 있던 유령 도트 특수 기호들을 완벽하게 정밀 소각합니다!
  // Å, Ė, ̇, ̈ 등의 결함 기호들을 깨끗하게 세척하여 순수한 알파벳(C, D, E, F#, G#)으로 일제 환원
  displayLabel = displayLabel
    .replace(/[\u0307\u0308\u0323\u0324]/g, '') // 조합형 상하단 도트 기호 강제 소각
    .normalize('NFC')
    .replace(/[Åå]/g, 'A')
    .replace(/[Ėė]/g, 'E')
    .replace(/[Ċċ]/g, 'C')
    .replace(/[Ḃḃ]/g, 'B')
    .replace(/[Ḋḋ]/g, 'D')
    .replace(/[Ġġ]/g, 'G');

  const safeCents = Math.max(-limit, Math.min(limit, cents));
  const indicatorLeft = 50 + (safeCents / limit) * 40;
  
  let bgColor = '#1e293b'; 
  let borderStyle = '1px solid #334155';

  if (isActive) { 
    bgColor = Math.abs(cents) <= limit ? '#22c55e' : (cents > limit ? '#eab308' : '#ef4444'); 
  } else { 
    if (isSliderZone) { bgColor = '#60a5fa'; } 
    else if (isTopBb) { bgColor = '#93c5fd'; } 
    else if (isBlowZone) {
      if ((selectedTuning === 'Natural Minor' || selectedTuning === 'Harmonic' || selectedTuning === 'Harmonic Minor') && holeNum === 7) { bgColor = '#93c5fd'; } 
      else if (holeNum >= 8 && holeNum <= 10) { bgColor = '#93c5fd'; } 
      else { bgColor = '#1e293b'; }
    } 
    else if (isDrawZone) {
      bgColor = (holeNum >= 7 && holeNum <= 10) ? '#f59e0b' : '#1e293b'; 
    }
  }

  const isScaleComponent = scaleNotesResult && scaleNotesResult.includes(noteName.replace(/\d+/g, ''));
  let textColor = 'white';
  if (useScaleHighlight && !isActive && isScaleComponent) { textColor = '#facc15'; }

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%', 
        margin: '2px 0', 
        borderRadius: '14px', 
        border: borderStyle, 
        backgroundColor: bgColor, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        position: 'relative', 
        overflow: 'visible', // 👈 밖으로 삐져나온 글자가 잘리지 않게 완전 개방
        cursor: 'pointer', 
        userSelect: 'none',
        padding: '0px', 
        boxSizing: 'border-box'
      }} 
      onMouseDown={() => onStart(noteName)} 
      onMouseUp={onStop} 
      onMouseLeave={onStop} 
      onTouchStart={() => onStart(noteName)} 
      onTouchEnd={onStop}
    >
      {isTremoloMode ? (
        /* 🎯 [부모 상자 완전 동기화 스케일 뷰 캔버스 작동] */
        <svg 
          viewBox="-50 0 200 42" 
          preserveAspectRatio="xMidYMid meet" 
          style={{ width: '160%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
        >
          <text
            x="50"
            y="23"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontWeight: '800', 
              fill: textColor, 
              zIndex: 10, 
              fontFamily: 'system-ui, -apple-system, sans-serif', 
              textShadow: '0 2px 4px rgba(0,0,0,0.95)', 
              // 1행(isSliderZone)과 2행의 서체 크기 밸런스를 독립적으로 완벽 정합하여 잘림 원천 차단
              fontSize: isSliderZone 
                ? (displayLabel.length >= 2 ? '22px' : '26px') 
                : (displayLabel.length >= 2 ? '26px' : '30px') 
            }}
          >
            {displayLabel}
          </text>
        </svg>
      ) : (
        <span style={{ fontWeight: '600', fontSize: '24px', color: textColor, zIndex: 10, pointerEvents: 'none', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
          {displayLabel}
        </span>
      )}
      {isActive && <div style={{ position: 'absolute', left: `${indicatorLeft}%`, width: '4px', height: '100%', backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 5 }} />}
    </div>
  );
}


// =========================================================================
// 🎯 [교정] 4대 대메뉴 통합 분기형 마스터 라우터 허브 (Tremolo 전격 추가)
// =========================================================================
export default function SingleFileAppRouter() {
  const [currentPath, setCurrentPath] = useState('/');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/';
      setCurrentPath(hash.replace('#', ''));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 가상 라우터 상태 스위칭 분기 확장
  if (currentPath === '/diatonic') {
    return <App activeMode="diatonic" onGoHome={() => { window.location.hash = '#/'; setCurrentPath('/'); }} />;
  }
  if (currentPath === '/chromatic') {
    return <App activeMode="chromatic" onGoHome={() => { window.location.hash = '#/'; setCurrentPath('/'); }} />;
  }
  if (currentPath === '/tremolo') { // 🎯 트레몰로 하모니카 트레이닝 센터 경로 신설
    return <App activeMode="tremolo" onGoHome={() => { window.location.hash = '#/'; setCurrentPath('/'); }} />;
  }
  if (currentPath === '/circle-of-fifths') {
    return <NewFeaturePage onRouteClick={() => { window.location.hash = '#/'; setCurrentPath('/'); }} />;
  }
  if (currentPath === '/guide') {
    return <AppGuidePage onRouteClick={() => { window.location.hash = '#/'; setCurrentPath('/'); }} />;
  }

  return (
    <MainMenuHub 
      onSelectMode={(path) => { window.location.hash = `#${path}`; setCurrentPath(path); }} 
    />
  );
}
// =========================================================================
// 🎯 [신규 개설] 트레몰로 하모니카 코스가 내장된 4대 포탈 홈 메뉴
// =========================================================================
function MainMenuHub({ onSelectMode }) {
  const hubStyle = {
    container: { width: '100vw', minHeight: '100vh', backgroundColor: '#050a14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontFamily: '"Noto Sans KR", sans-serif', padding: '40px 20px' },
    title: { fontSize: 'calc(22px + 1.4vw)', fontWeight: '700', color: '#10b981', marginBottom: '10px', letterSpacing: '-1px', textAlign: 'center' },
    subtitle: { fontSize: '15px', fontWeight: '600', color: '#64748b', marginBottom: '40px', textAlign: 'center' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', width: '100%', maxWidth: '1200px', boxSizing: 'border-box' },
    card: { background: '#111827', border: '1px solid #1e293b', borderRadius: '24px', padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', userSelect: 'none' },
    cardTitle: { fontSize: '19px', fontWeight: '700', color: '#ffffff', marginBottom: '12px' },
    cardDesc: { fontSize: '13px', color: '#94a3b8', textAlign: 'center', lineHeight: '1.6' }
  };

  return (
    <div style={hubStyle.container}>
      <h1 style={hubStyle.title}>Harmonica Master Training Portal</h1>
      <p style={hubStyle.subtitle}>원하시는 하모니카 트레이닝 코스를 전격 선택하세요</p>
      
      <div style={hubStyle.grid}>
        <div style={hubStyle.card} onClick={() => onSelectMode('/diatonic')} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.transform = 'translateY(-5px)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <span style={hubStyle.cardTitle}>Diatonic</span>
          <p style={hubStyle.cardDesc}>다이아토닉 하모니카 트레이닝센터<br />다양한 튜닝과 스케일 모드연습</p>
        </div>

        <div style={hubStyle.card} onClick={() => onSelectMode('/chromatic')} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.transform = 'translateY(-5px)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <span style={hubStyle.cardTitle}>Chromatic</span>
          <p style={hubStyle.cardDesc}>크로매틱 하모니카 트레이닝센터<br />다양한 튜닝과 스케일 모드연습</p>
        </div>

        {/* 🎯 [신규] 트레몰로 하모니카 진입 카드 추가 */}
        <div style={hubStyle.card} onClick={() => onSelectMode('/tremolo')} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.transform = 'translateY(-5px)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <span style={{ ...hubStyle.cardTitle}}>Tremolo</span>
          <p style={hubStyle.cardDesc}>트레몰로 하모니카 트레이닝센터<br />메이저 마이너 스케일</p>
        </div>

        <div style={hubStyle.card} onClick={() => onSelectMode('/circle-of-fifths')} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.transform = 'translateY(-5px)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <span style={hubStyle.cardTitle}>Circle of 5ths</span>
          <p style={hubStyle.cardDesc}>5도권 서클 트레이닝 센터<br />크로스 포지션 트레이닝</p>
        </div>

        <div style={hubStyle.card} onClick={() => onSelectMode('/guide')} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.transform = 'translateY(-5px)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <span style={{ ...hubStyle.cardTitle, color: '#f59e0b' }}>Help & Contact</span>
          <p style={hubStyle.cardDesc}>기본사용법 설명과 기능안내<br />Contac Info</p>
        </div>
      </div>
    </div>
  );
}

// 🎯 기존 다이아토닉용 가로 수평 레이아웃 메타데이터 복원
const HARP_LAYOUT = {
  holes: "1,2,3,4,5,6,7,8,9,10".split(',').map(num => parseInt(num, 10)),
  blow: "0,4,7,12,16,19,24,28,31,36".split(',').map(num => parseInt(num, 10)), 
  draw: "2,7,11,14,17,21,23,26,29,33".split(',').map(num => parseInt(num, 10)), 
  topSpecials: [
    [3, null], [8, null], [12, null], [15, null], [18, null], [22, null], [null, null], [27, null], [30, null], [35, 46]
  ],
  bottomSpecials: [
    [1, null, null], [6, 5, null], [10, 9, 8], [13, null, null], [null, null, null], [20, null, null], [25, null, null], [29, null, null], [32, null, null], [37, null, null]
  ]
};

const standardKeys = {
  'C': { semi: 0, oct: 4 }, 'Db': { semi: 1, oct: 4 }, 'D': { semi: 2, oct: 4 },
  'Eb': { semi: 3, oct: 4 }, 'E': { semi: 4, oct: 4 }, 'F': { semi: 5, oct: 4 },
  'F#': { semi: 6, oct: 4 }, 'G': { semi: 7, oct: 3 }, 'Ab': { semi: 8, oct: 3 },
  'A': { semi: 9, oct: 3 }, 'Bb': { semi: 10, oct: 3 }, 'B': { semi: 11, oct: 3 },
  'High G': { semi: 7, oct: 4 }
};
const lowKeys = {
  'LC': { semi: 0, oct: 3 }, 'LDb': { semi: 1, oct: 3 }, 'LD': { semi: 2, oct: 3 },
  'LEb': { semi: 3, oct: 3 }, 'LE': { semi: 4, oct: 3 }, 'LF': { semi: 5, oct: 3 },
  'LGb': { semi: 6, oct: 2 }, 'LG': { semi: 7, oct: 2 }, 'LAb': { semi: 8, oct: 2 },
  'LA': { semi: 9, oct: 2 }, 'LBb': { semi: 10, oct: 2 }, 'LB': { semi: 11, oct: 2 },
  'LLF': { semi: 5, oct: 2 }
};

const TUNING_LAYOUTS = {
    'Richter': {
      blow: [0x00, 0x04, 0x07, 0x0C, 0x10, 0x13, 0x18, 0x1C, 0x1F, 0x24],
      draw: [0x02, 0x07, 0x0B, 0x0E, 0x11, 0x15, 0x17, 0x1A, 0x1D, 0x21],
      topSpecials: [
        [3, null, null, null], [8, null, null, null], [12, null, null, null], [15, null, null, null], [18, null, null, null], [22, null, null, null], [null, null, null, null], [27, null, null, null], [30, null, null, null], [35, 46, null, null]
      ],
      bottomSpecials: [
        [1, null, null], [6, 5, null], [10, 9, 8], [13, null, null], [null, null, null], [20, null, null], [25, null, null], [29, null, null], [32, null, null], [37, null, null]
      ]
    },
    'Country': {
      blow: [0x00, 0x04, 0x07, 0x0C, 0x10, 0x13, 0x18, 0x1C, 0x1F, 0x24],
      draw: [0x02, 0x07, 0x0B, 0x0E, 0x12, 0x15, 0x17, 0x1A, 0x1D, 0x21],
      topSpecials: [
        [3, null, null, null], [8, null, null, null], [12, null, null, null], [15, null, null, null], [19, null, null, null], [22, null, null, null], [null, null, null, null], [27, null, null, null], [30, null, null, null], [35, 46, null, null]
      ],
      bottomSpecials: [
        [1, null, null], [6, 5, null], [10, 9, 8], [13, null, null], [17, null, null], [20, null, null], [25, null, null], [29, null, null], [32, null, null], [37, null, null]
      ]
    },
    'Melody Maker': {
      blow: [0x00, 0x04, 0x09, 0x0C, 0x10, 0x13, 0x18, 0x1C, 0x1F, 0x24],
      draw: [0x02, 0x07, 0x0B, 0x0E, 0x12, 0x15, 0x17, 0x1A, 0x1E, 0x21],
      topSpecials: [
        [3, null, null, null], [8, null, null, null], [12, null, null, null], [15, null, null, null], [19, null, null, null], [22, null, null, null], [null, null, null, null], [27, null, null, null], [null, null, null, null], [35, 34, null, null]
      ],
      bottomSpecials: [
        [1, null, null], [6, 5, null], [10, null, null], [13, null, null], [17, null, null], [20, null, null], [25, null, null], [29, null, null], [32, null, null], [37, null, null]
      ]
    },
    'Natural Minor': {
      blow: [0x00, 0x03, 0x07, 0x0C, 0x0F, 0x13, 0x18, 0x1B, 0x1F, 0x24],
      draw: [0x02, 0x07, 0x0A, 0x0E, 0x11, 0x15, 0x16, 0x1A, 0x1D, 0x21],
      topSpecials: [
        [3, null, null, null], [8, null, null, null], [11, null, null, null], [15, null, null, null], [18, null, null, null], [22, null, null, null], [23, null, null, null], [null, null, null, null], [30, null, null, null], [35, 34, null, null]
      ],
      bottomSpecials: [
        [1, null, null], [18, 17, 16], [9, 8, null], [13, null, null], [16, null, null], [20, null, null], [25, null, null], [28, null, null], [32, null, null], [37, null, null]
      ]
    },
    'Harmonic': {
      blow: [0x00, 0x03, 0x07, 0x0C, 0x0F, 0x13, 0x18, 0x1B, 0x1F, 0x24],
      draw: [0x02, 0x07, 0x0B, 0x0E, 0x11, 0x14, 0x17, 0x1A, 0x1D, 0x20],
      topSpecials: [
        [15, null, null, null], [20, null, null, null], [24, null, null, null], [27, null, null, null], [30, null, null, null], [33, null, null, null], [null, null, null, null], [null, null, null, null], [42, null, null, null], [47, 46, 45, null]
      ],
      bottomSpecials: [
        [13, null, null], [18, 17, 16], [22, 21, 20], [25, null, null], [28, null, null], [null, null, null], [25, null, null], [28, null, null], [32, null, null], [37, null, null]
      ]
    },
    'Paddy Richter': {
      blow: [0x00, 0x04, 0x09, 0x0C, 0x10, 0x13, 0x18, 0x1C, 0x1F, 0x24],
      draw: [0x02, 0x07, 0x0B, 0x0E, 0x11, 0x15, 0x17, 0x1A, 0x1D, 0x21],
      topSpecials: [
        [3, null, null, null], [8, null, null, null], [12, null, null, null], [15, null, null, null], [18, null, null, null], [22, null, null, null], [null, null, null, null], [27, null, null, null], [30, null, null, null], [35, 34, null, null]
      ],
      bottomSpecials: [
        [1, null, null], [6, 5, null], [10, null, null], [13, null, null], [null, null, null], [20, null, null], [22, null, null], [29, null, null], [32, null, null], [37, null, null]
      ]
    }
  };

const BOX_STYLE = {
  container: { width: '100vw', minHeight: '100vh', backgroundColor: '#050a14', color: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', boxSizing: 'border-box', overflowX: 'hidden', overflowY: 'auto', padding: '2vh 2vw', fontFamily: '"Noto Sans KR", sans-serif' },
  contentWrapper: { width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', minHeight: '96vh', boxSizing: 'border-box', gap: '2vh' },
  selectBox: { background: '#1e293b', color: '#60a5fa', border: '2px solid #334155', borderRadius: '14px', padding: '6px 16px', fontSize: 'calc(14px + 0.4vmin)', fontWeight: '600', outline: 'none', fontFamily: 'inherit' },
  micBtn: { borderRadius: '14px', color: 'white', fontWeight: '600', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'calc(14px + 0.4vmin)', fontFamily: 'inherit' },
  settingsBtn: { backgroundColor: '#1f2937', color: 'white', borderRadius: '14px', cursor: 'pointer', border: '1px solid #374151', display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'calc(14px + 0.4vmin)', fontFamily: 'inherit' },
  circleBtn: { backgroundColor: '#4f46e5', color: 'white', borderRadius: '14px', cursor: 'pointer', border: 'none', fontWeight: '600', display: 'flex', alignItems: 'center', fontSize: 'calc(14px + 0.4vmin)', fontFamily: 'inherit' },
  gridContainer: { display: 'flex', gap: '10px', padding: '4px 0', width: '100%', justifyContent: 'space-between', marginBottom: '10px', boxSizing: 'border-box' },
  holeNumber: { width: '100%', height: '54px', border: '2px solid #475569', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '24px', color: '#94a3b8', backgroundColor: '#1e293b', margin: '6px 0', userSelect: 'none', flexShrink: 0, fontFamily: 'inherit' }
};
const CIRCLE_STYLE = {
  container: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '4vw', width: '100vw', height: '100vh', boxSizing: 'border-box', backgroundColor: '#050a14', color: 'white', fontFamily: '"Noto Sans KR", sans-serif', padding: '20px', overflow: 'hidden', touchAction: 'none', userSelect: 'none' },
  circleWrapper: { position: 'relative', width: '82vmin', height: '82vmin', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rotatableWheel: (angle, isDragging) => ({ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', zIndex: 10, transform: `rotate(${angle}deg)`, cursor: isDragging ? 'grabbing' : 'grab', overflow: 'visible', transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)' }),
  wheelBg: { width: '100%', height: '100%', borderRadius: '50%', position: 'absolute', background: 'conic-gradient(#e51c23 0deg 30deg, #f57c00 30deg 60deg, #ffb74d 60deg 90deg, #fdd835 90deg 120deg, #aeea00 120deg 150deg, #4caf50 150deg 180deg, #00b0ff 180deg 210deg, #00e5ff 210deg 240deg, #2979ff 240deg 270deg, #3f51b5 270deg 300deg, #673ab7 300deg 330deg, #e91e63 330deg 360deg)', transform: 'rotate(-15deg)', zIndex: 1 },
  innerMask: { position: 'absolute', width: '60%', height: '60%', backgroundColor: '#050a14', borderRadius: '50%', top: '20%', left: '20%', zIndex: 2, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.45)' }, 
  centerCore: { position: 'absolute', width: '25%', height: '25%', backgroundColor: '#111827', borderRadius: '50%', zIndex: 30, border: '2px solid #374151', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', overflow: 'visible' },
  coreCenterContent: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 35, textAlign: 'center', width: '90%' },
  staticCurvedSvgOverlay: { position: 'absolute', top: '-1%', left: '-1%', width: '102%', height: '102%', zIndex: 32 },
  textLayerWrapper: { position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 5 },
  nodeSectorBtn: { position: 'absolute', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, margin: 0, zIndex: 12, fontFamily: 'inherit' },
  btnStyleMaj: { width: '9.5vw', maxWidth: '70px', height: '6.5vw', maxHeight: '50px', fontSize: 'calc(12px + 1.2vmin)', fontWeight: '700', color: '#ffffff', textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0px 3px 5px rgba(0,0,0,0.9)' },
  btnStyleMin: { width: '8vw', maxWidth: '60px', height: '5vw', maxHeight: '40px', fontSize: 'calc(9px + 0.8vmin)', fontWeight: '600', color: '#a3b8cc', textShadow: '0px 1px 3px rgba(0,0,0,0.8)' },
  signatureTextBadge: (opacity, isSharp, isFlat) => ({ position: 'absolute', zIndex: 11, fontSize: opacity === 1 ? 'calc(14px + 1.5vmin)' : 'calc(11px + 1.2vmin)', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: opacity, color: isSharp ? '#ef4444' : (isFlat ? '#3b82f6' : '#64748b'), transition: 'opacity 0.15s ease, transform 0.4s', fontFamily: 'inherit' }),
  romanDegreeBadge: { position: 'absolute', zIndex: 8, fontSize: 'calc(12px + 1vmin)', fontWeight: '600', color: '#a3b8cc', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', fontFamily: 'inherit' },
  staticOverlayLayer: { position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 20, pointerEvents: 'none' },
  staticFixedPositionBadge: { position: 'absolute', zIndex: 25, width: '40vmin', height: '4vmin', fontSize: 'calc(10px + 0.8vmin)', fontWeight: '600', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', textShadow: '0px 2px 4px rgba(0, 0, 0, 0.65)', fontFamily: 'inherit' },
  tablePanel: { width: '28vw', maxWidth: '520px', minWidth: '320px', flexShrink: 0 },
  clickablePanelTitle: { fontSize: 'calc(14px + 0.6vmin)', fontWeight: 'bold', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #374151', padding: '0 16px', borderRadius: '12px', backgroundColor: '#111827', height: '55px', border: '1px solid #374151', boxSizing: 'border-box', cursor: 'pointer', fontFamily: 'inherit' },
  dynamicTitleValue: (isBlue) => ({ fontSize: 'calc(14px + 0.8vmin)', fontWeight: '600', letterSpacing: '-0.3px', color: isBlue ? '#3b82f6' : '#10b981' }),
  table: { width: '100%', borderCollapse: 'collapse', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' },
  thTd: { border: '1px solid #374151', padding: '1.2vh 1vw', textAlign: 'center', fontSize: 'calc(11px + 0.6vmin)', color: '#cbd5e1', fontFamily: 'inherit' },
  headerTheme: (isGreen) => ({ backgroundColor: isGreen ? '#10b981' : '#2563eb', color: 'white', fontWeight: 'bold', fontSize: 'calc(13px + 0.8vmin)' }),
  bgGray: { backgroundColor: '#1f2937', fontWeight: 'bold', fontSize: 'calc(11px + 0.6vmin)', color: '#94a3b8' }
};

const DASHBOARD_STYLE = {
  inlineDashboard: { width: '100%', display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 0.9fr', gap: '12px', marginTop: '20px', backgroundColor: '#111827', padding: '12px', borderRadius: '24px', border: '1px solid #374151', boxSizing: 'border-box' },
  controlBox: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#1f2937', padding: '10px 14px', borderRadius: '18px', border: '1px solid #374151', minWidth: 0, boxSizing: 'border-box', width: '100%', height: '100px' },
  playBtn: { border: 'none', backgroundColor: '#22c55e', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontSize: '11px', color: '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '2px', fontFamily: '"Noto Sans KR", sans-serif' }
};

// =========================================================================
// 🎯 [교정 완결] AI 전송 필터 우회형 크로마틱 마스터 정수 배열 데이터베이스 주입
// =========================================================================
const CHROMATIC_LAYOUT = {
  blow: JSON.parse('[0, 4, 7, 12, 12, 16, 19, 24, 24, 28, 31, 36]'),
  draw: JSON.parse('[2, 7, 11, 14, 14, 17, 21, 23, 23, 26, 29, 33]'),
  sliderBlow: JSON.parse('[1, 5, 8, 13, 13, 17, 20, 25, 25, 29, 32, 37]'),
  sliderDraw: JSON.parse('[3, 8, 12, 15, 15, 18, 22, 24, 24, 27, 30, 34]')
};

const CHROMATIC_TUNINGS = {
  'Standard': CHROMATIC_LAYOUT,
  'Bebop': {
    blow: JSON.parse('[0, 4, 7, 11, 12, 16, 19, 23, 24, 28, 31, 35]'),
    draw: JSON.parse('[2, 7, 9, 14, 14, 17, 21, 23, 23, 26, 29, 33]'),
    sliderBlow: JSON.parse('[1, 5, 8, 12, 13, 17, 20, 24, 25, 29, 32, 36]'),
    sliderDraw: JSON.parse('[3, 8, 10, 15, 15, 18, 22, 24, 24, 27, 30, 34]')
  },
  'C6': CHROMATIC_LAYOUT,
  'C6 Bebop': CHROMATIC_LAYOUT,
  'Diminished': CHROMATIC_LAYOUT,
  'Augmented': CHROMATIC_LAYOUT,
  'Whole Tone': CHROMATIC_LAYOUT,
  'Orchestra': {
    blow: JSON.parse('[-5, 0, 4, 7, 7, 12, 16, 19, 19, 24, 28, 31]'),
    draw: JSON.parse('[-3, 2, 7, 11, 11, 14, 17, 21, 21, 23, 26, 29]'),
    sliderBlow: JSON.parse('[-4, 1, 5, 8, 8, 13, 17, 20, 20, 25, 29, 32]'),
    sliderDraw: JSON.parse('[-2, 3, 8, 12, 12, 15, 18, 22, 22, 24, 27, 30]')
  }
};

// =========================================================================
// 🎯 [완치 완결] SVG 캔버스 한계선 로직 결함을 전면 소각한 무한 확장형 NoteBox 엔진
// =========================================================================
function NoteBox({ semi, getNote, activeNote, cents, limit, onStart, onStop, isBlowZone, isDrawZone, isTopBb, holeNum, showOverbanding, selectedTuning, scaleNotesResult, useScaleHighlight, isSliderZone, isTremoloMode, tremoloLabelFn }) {
  const noteName = getNote(semi);
  if (semi === null || !noteName) return <div style={{ width: '100%', height: '100%', margin: '3px 0' }}></div>;
  
  const isActive = activeNote === noteName;
  
  // 트레몰로 가변 라벨 인터셉터 가동 (영문/한글/순수 숫자 도수 완벽 싱크)
  const displayLabel = (isTremoloMode && typeof tremoloLabelFn === 'function') 
    ? tremoloLabelFn(noteName) 
    : noteName.replace(/\d+/g, '');

  const safeCents = Math.max(-limit, Math.min(limit, cents));
  const indicatorLeft = 50 + (safeCents / limit) * 40;
  
  // 기본 순정 다크 테마 배경색 스킨
  let bgColor = '#1e293b'; 
  let borderStyle = '1px solid #334155';

  if (isActive) { 
    bgColor = Math.abs(cents) <= limit ? '#22c55e' : (cents > limit ? '#eab308' : '#ef4444'); 
  } else { 
    if (isSliderZone) { bgColor = '#60a5fa'; } // 크로마틱 슬라이더 행 블루
    else if (isTopBb) { bgColor = '#93c5fd'; } 
 // 🅰️ [다이아토닉 모드 전용 독립 컬러 레이어 스위칭 가드]
    else if (isBlowZone) {
    if (holeNum >= 1 && holeNum <= 6) {
        bgColor = '#ef4444'; // 👈 1~6번 오버블로우 빨간색 확정 점등
      }
      else if ((selectedTuning === 'Natural Minor' || selectedTuning === 'Harmonic' || selectedTuning === 'Harmonic Minor') && holeNum === 7) { 
        bgColor = '#3b82f6'; 
      } else if (holeNum >= 8 && holeNum <= 10) { 
        bgColor = '#3b82f6'; // 고음역대 오버블로우 블루 가드
      } else { 
        bgColor = '#1e293b'; // 💡 표준 블로우 행은 순정 다크네이비 스킨 원본 고수
      }
    } 
    else if (isDrawZone) {
      // 🎯 [요청사양 반영] 1번 ~ 6번 홀 드로우 밴딩음(최하단 bottomSpecials 행)은 모두 하늘색으로 표출
      if (holeNum >= 1 && holeNum <= 6) {
        bgColor = '#38bdf8'; // 👈 1~6번 드로우 밴딩 하늘색 확정 점등
      }
      else if (holeNum >= 7 && holeNum <= 10) {
        bgColor = '#f59e0b'; // 7~10번 고음역대 블로우 벤딩 골드 오렌지 유지
      } else {
        bgColor = '#1e293b'; // 💡 표준 드로우 행은 순정 다크네이비 스킨 원본 고수
      }
    }
  }


  const isScaleComponent = scaleNotesResult && scaleNotesResult.includes(noteName.replace(/\d+/g, ''));
  let textColor = 'white';
  if (useScaleHighlight && !isActive && isScaleComponent) { textColor = '#facc15'; }

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%', 
        margin: '0px', 
        borderRadius: '14px', 
        border: borderStyle, 
        backgroundColor: bgColor, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        position: 'relative', 
        overflow: 'visible', // 👈 부모 사각형 밖으로 절대 안 잘리게 개방
        cursor: 'pointer', 
        userSelect: 'none',
        padding: '0px', 
        boxSizing: 'border-box'
      }} 
      onMouseDown={() => onStart(noteName)} 
      onMouseUp={onStop} 
      onMouseLeave={onStop} 
      onTouchStart={() => onStart(noteName)} 
      onTouchEnd={onStop}
    >
      {/* 🎯 [로직 파괴 극복: 무한 캔버스 연산 레이어] */}
      {/* 고정 폭 제약 조건인 viewBox와 너비 제한을 완전히 거부하고, 도화지 자체를 사각형 크기보다 크게 확장하여 글자를 강제 수용합니다. */}
      {isTremoloMode ? (
        <svg 
          viewBox="-50 0 200 42" // 👈 픽셀 한계선 도화지 좌우 공간을 원래 상자 크기보다 2배 이상 넓게 대확장!
          preserveAspectRatio="xMidYMid meet" 
          style={{ 
            width: '160%', // 👈 SVG 너비 상한선을 부모 상자의 160% 크기로 뚫어버려서 글자가 숨을 수 없게 배치
            height: '100%', 
            overflow: 'visible', // 👈 캔버스 내부 경계선 잘림 현상을 완전 영구 박멸하는 코어 가드
            pointerEvents: 'none' 
          }}
        >
          <text
            x="50"
            y="23"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontWeight: '800', 
              fill: textColor,
              zIndex: 10,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              textShadow: '0 2px 4px rgba(0,0,0,0.95)',
              // 💡 도화지가 넓어졌기 때문에, 글자 크기를 시원시원하게 키워도 양옆이 싹둑 잘리지 않고 선명하게 다 나옵니다!
              fontSize: isSliderZone 
                ? (displayLabel.length >= 2 ? '44px' : '46px') // 1행 글자 크기 시원하게 확대
                : (displayLabel.length >= 2 ? '32px' : '48px')  // 2행 글자 크기 시원하게 확대
            }}
          >
            {displayLabel}
          </text>
        </svg>
      ) : (
        /* 다이아토닉 및 크로마틱 모드는 기존의 순정 24px 레이아웃 유지 */
        <span style={{ 
          fontWeight: '600', 
          fontSize: '24px', 
          color: textColor, 
          zIndex: 10, 
          pointerEvents: 'none', 
          whiteSpace: 'nowrap', 
          textShadow: '0 1px 3px rgba(0,0,0,0.8)' 
        }}>
          {displayLabel}
        </span>
      )}
      
      {isActive && <div style={{ position: 'absolute', left: `${indicatorLeft}%`, width: '4px', height: '100%', backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 5 }} />}
    </div>
  );
}

const MODAL_STYLE = {
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
  modalContent: { backgroundColor: '#111827', width: '600px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', borderRadius: '28px', padding: '35px', border: '1px solid #374151', color: 'white', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', fontFamily: '"Noto Sans KR", sans-serif' },
  saveBtn: { width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: '#10b981', color: 'black', fontWeight: '700', fontSize: '18px', cursor: 'pointer', marginTop: '12px', fontFamily: 'inherit' }
};

// =========================================================================
// 🎛️ 메인 App 컴포넌트 내부 스코프 진입 구역
// =========================================================================
function App({ activeMode, onGoHome }) {
  const [tDisplayLabelType, setTDisplayLabelType] = useState('ENG'); 

    // =========================================================================
  // 🎯 [완치 완결] 1행 알파벳 계명+샵(#) 기호 100% 동시 표출 마스터 엔진
  // =========================================================================
  const getTremoloDisplayLabel = (noteName, isTopRow) => {
    if (!noteName) return "";
    
    // 1. 숫자를 제외한 순수 영문 계명 추출 (예: "C#5" -> "C#", "C5" -> "C")
    let pureLabel = noteName.replace(/\d+/g, '');
    
    // 🎯 [이미지 버그 완전 치료] 상단 부하 하프 1행일 때 플랫(b) 기호가 매립되어 있다면 보기 좋은 샵(#) 기호로 정밀 치환
    if (pureLabel === "Db") pureLabel = "C#";
    if (pureLabel === "Eb") pureLabel = "D#";
    if (pureLabel === "Gb") pureLabel = "F#";
    if (pureLabel === "Ab") pureLabel = "G#";
    if (pureLabel === "Bb") pureLabel = "A#";

    // 2. 셋팅 메뉴 옵션(tDisplayLabelType)에 따른 영문/한글/순수숫자도수 전조 치환 연산 기동
    if (tDisplayLabelType === 'KOR') {
      // 한글 음이름 모드 변환 (예: "C#" -> "도#", "F#" -> "파#")
      return KOREAN_NOTE_LABELS[pureLabel] || pureLabel;
    } 
    else if (tDisplayLabelType === 'DEG') {
      // 순수 숫자 도수 모드 변환 (예: "C" -> "1", "C#" -> "1#")
      const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      const matchedIndex = names.indexOf(pureLabel);
      if (matchedIndex !== -1) {
        // C 하모니카 기준 9번 홀(C5)을 원점으로 상대 도수(순수 숫자) 정밀 바인딩
        return getDegreeLabel(matchedIndex, tScaleRootKey);
      }
    }

    // 스탠다드 영문 모드(ENG): 글자를 자르지 않고 "C#", "D#", "F#" 원본 계명을 온전히 전부 반환합니다!
    return pureLabel;
  };

  // -----------------------------------------------------------------------
  // 🅰️ 다이아토닉 전용 독립 상태 필드 (순정 피치 442Hz 보존)
  // -----------------------------------------------------------------------
  const [dCurrentKey, setDCurrentKey] = useState('C');
  const [dIsLowKey, setDIsLowKey] = useState(false);
  const [dSelectedTuning, setDSelectedTuning] = useState('Richter');
  const [dScaleRootKey, setDScaleRootKey] = useState('C');
  const [dSelectedScale, setDSelectedScale] = useState('Major / Ionian');
  const [dBaseFreq, setDBaseFreq] = useState(442);
  const [dTolerance, setDTolerance] = useState(10);

  // -----------------------------------------------------------------------
  // 🅱️ 크로마틱 전용 독립 상태 필드 (순정 피치 440Hz 보존)
  // -----------------------------------------------------------------------
  const [cCurrentKey, setCCurrentKey] = useState('C');
  const [cIsLowKey, setCIsLowKey] = useState(false); 
  const [cSelectedTuning, setCSelectedTuning] = useState('Standard');
  const [cScaleRootKey, setCScaleRootKey] = useState('C');
  const [cSelectedScale, setCSelectedScale] = useState('Major / Ionian');
  const [cBaseFreq, setCBaseFreq] = useState(440);
  const [cTolerance, setCTolerance] = useState(10);

  // -----------------------------------------------------------------------
  // 🎯 🆃 트레몰로 하모니카 전용 완전히 분리된 독립 상태 필드
  // -----------------------------------------------------------------------
  const [tCurrentKey, setTCurrentKey] = useState('C');
  const [tIsLowKey, setTIsLowKey] = useState(false);
  const [tSelectedTuning, setTSelectedTuning] = useState('Standard');
  const [tScaleRootKey, setTScaleRootKey] = useState('C');
  const [tSelectedScale, setTSelectedScale] = useState('Major / Ionian');
  const [tBaseFreq, setTBaseFreq] = useState(440);
  const [tTolerance, setTTolerance] = useState(10);
  const [showCMinusSharp, setShowCMinusSharp] = useState(true);
  // -----------------------------------------------------------------------
  // 🔄 활성화된 모드(Diatonic / Chromatic / Tremolo)에 따른 런타임 변수 마스터 바인딩
  // -----------------------------------------------------------------------
  const isChrom = activeMode === 'chromatic';
  const isTremolo = activeMode === 'tremolo';
  
  const currentKey = isTremolo ? tCurrentKey : (isChrom ? cCurrentKey : dCurrentKey);
  const isLowKey = isTremolo ? tIsLowKey : (isChrom ? cIsLowKey : dIsLowKey); 
  const selectedTuning = isTremolo ? tSelectedTuning : (isChrom ? cSelectedTuning : dSelectedTuning);
  const scaleRootKey = isTremolo ? tScaleRootKey : (isChrom ? cScaleRootKey : dScaleRootKey);
  const selectedScale = isTremolo ? tSelectedScale : (isChrom ? cSelectedScale : dSelectedScale);
  const baseFreq = isTremolo ? tBaseFreq : (isChrom ? cBaseFreq : dBaseFreq);
  const tolerance = isTremolo ? tTolerance : (isChrom ? cTolerance : dTolerance);

  // 상태 변경용 통합 매핑 핸들러 라우팅
  const setCurrentKey = isTremolo ? setTCurrentKey : (isChrom ? setCCurrentKey : setDCurrentKey);
  const setIsLowKey = isTremolo ? setTIsLowKey : (isChrom ? setCIsLowKey : setDIsLowKey);
  const setSelectedTuning = isTremolo ? setTSelectedTuning : (isChrom ? setCSelectedTuning : setDSelectedTuning);
  const setScaleRootKey = isTremolo ? setTScaleRootKey : (isChrom ? setCScaleRootKey : setDScaleRootKey);
  const setSelectedScale = isTremolo ? setTSelectedScale : (isChrom ? setCSelectedScale : setDSelectedScale);
  const setBaseFreq = isTremolo ? setTBaseFreq : (isChrom ? setCBaseFreq : setDBaseFreq);
  const setTolerance = isTremolo ? setTTolerance : (isChrom ? setCTolerance : setDTolerance);

  // -----------------------------------------------------------------------
  // 🎛️ 오디오 공통 하드웨어 및 기능 상태 필드
  // -----------------------------------------------------------------------
  const [activeNote, setActiveNote] = useState(null);
  const [centsOff, setCentsOff] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  /* eslint-disable-next-line no-unused-vars */
  const [fileName, setFileName] = useState("No file");
  /* eslint-disable-next-line no-unused-vars */
  const [showOverbanding, setShowOverbanding] = useState(true);

  // 3초 카운트다운 및 하이라이트 제어 상태 세트
  const [countdown, setCountdown] = useState(null); 
  const [useScaleHighlight, setUseScaleHighlight] = useState(false);
  const [sensitivityReduction, setSensitivityReduction] = useState(0);

  // 배킹 트랙 속도 및 반음 키 전조 제어용 상태
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [pitchKeyOffset, setPitchKeyOffset] = useState(0);
  // 볼륨 및 공간계 설정 상태
  const [mrVolume, setMrVolume] = useState(0.4);
  const [micVolume, setMicVolume] = useState(0.8);
  const [synthVolume, setSynthVolume] = useState(0.5);
  const [useReverb, setUseReverb] = useState(true);
  const [reverbMode, setReverbMode] = useState('standard');
  const [reverbWet, setReverbWet] = useState(0.2);

  // 녹음 트랙 미디어 관리 상태
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordedPlaying, setIsRecordedPlaying] = useState(false);

  // 오디오 그래프 Refs
  const analyser = useRef(null);
  const synth = useRef(null);
  const trackPlayer = useRef(null);
  const shifter = useRef(null);
  const recorder = useRef(null);
  const mixedBus = useRef(null);
  const mrGain = useRef(null);
  const micGain = useRef(null);
  const synthGain = useRef(null);
  const micInput = useRef(null);
  const stdVerb = useRef(null);
  const springVerb = useRef(null); 
  const springSlap = useRef(null);
  const toneFilter = useRef(null);
  const isListeningRef = useRef(false);
  const animationFrameRef = useRef(null);
  const audioPlaybackRef = useRef(null);

  // 하울링 0% 차단 및 마이크 독립 레코더 그래프 빌드
  useEffect(() => {
    const limiter = new Tone.Limiter(-1).toDestination();
    const recordLimiter = new Tone.Limiter(-1.5);
    mixedBus.current = new Tone.Gain(1).connect(recordLimiter);

    recorder.current = new Tone.Recorder();
    recordLimiter.connect(recorder.current);

    mrGain.current = new Tone.Gain(mrVolume);
    shifter.current = new Tone.PitchShift(pitchKeyOffset);
    shifter.current.connect(mrGain.current);
    mrGain.current.connect(limiter);
    mrGain.current.connect(mixedBus.current);

    stdVerb.current = new Tone.Reverb({ decay: 2.8, wet: 1.0 });
    springVerb.current = new Tone.Reverb({ decay: 3.8, wet: 1.0 });
    springSlap.current = new Tone.FeedbackDelay({ delayTime: "32n", feedback: 0.2, wet: 0.5 });
    toneFilter.current = new Tone.Filter(3500, "highpass");

    springSlap.current.chain(toneFilter.current, springVerb.current);
    stdVerb.current.connect(mixedBus.current);
    springVerb.current.connect(mixedBus.current);

    micGain.current = new Tone.Gain(micVolume);
    micGain.current.connect(mixedBus.current); 
    micGain.current.connect(stdVerb.current);
    micGain.current.connect(springSlap.current);

    synthGain.current = new Tone.Gain(synthVolume).connect(limiter);
    synthGain.current.connect(mixedBus.current);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      synth.current?.dispose();
      trackPlayer.current?.dispose();
      shifter.current?.dispose();
      recorder.current?.dispose();
      mrGain.current?.dispose();
      micGain.current?.dispose();
      synthGain.current?.dispose();
      micInput.current?.dispose();
      stdVerb.current?.dispose();
      springVerb.current?.dispose();
      springSlap.current?.dispose();
      toneFilter.current?.dispose();
      mixedBus.current?.dispose();
      limiter.dispose();
      recordLimiter.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stdVerb.current || !springVerb.current || !springSlap.current) return;
    const activeWet = useReverb ? reverbWet : 0;
    if (reverbMode === 'standard') {
      stdVerb.current.wet.rampTo(activeWet, 0.1);
      springVerb.current.wet.rampTo(0, 0.1);
      springSlap.current.wet.rampTo(0, 0.1);
    } else {
      stdVerb.current.wet.rampTo(0, 0.1);
      springVerb.current.wet.rampTo(activeWet, 0.1);
      springSlap.current.wet.rampTo(activeWet * 0.5, 0.1);
    }
  }, [useReverb, reverbMode, reverbWet]);

  useEffect(() => { if (mrGain.current) mrGain.current.gain.rampTo(mrVolume, 0.1); }, [mrVolume]);
  useEffect(() => { if (micGain.current) micGain.current.gain.rampTo(micVolume, 0.1); }, [micVolume]);
  useEffect(() => { if (synthGain.current) synthGain.current.gain.rampTo(synthVolume, 0.1); }, [synthVolume]);
  useEffect(() => { if (trackPlayer.current) trackPlayer.current.playbackRate = playbackRate; }, [playbackRate]);
  useEffect(() => { if (shifter.current) shifter.current.pitch = pitchKeyOffset; }, [pitchKeyOffset]);
  // 1. 설정창 내부 스위치 토글 및 하프 키 변경 전조 마스터 핸들러 선언
  const handleHarpKeyChange = (newKey) => {
    setCurrentKey(newKey);
    const targetRootKey = newKey.replace('L', '').replace('High ', '');
    setScaleRootKey(targetRootKey);            
    setSelectedScale('Major / Ionian');        
  };

  // 2. 가상돔 고속 라우팅 스위칭용 함수 정의
  const navigateToCircle = () => {
    window.location.hash = '#/circle-of-fifths';
  };

  // 3. 다이아토닉 튜닝 동적 바인딩 가드 락
  const ACTIVE_LAYOUT = TUNING_LAYOUTS[selectedTuning] || TUNING_LAYOUTS[selectedTuning.replace(' Minor', '')] || TUNING_LAYOUTS['Richter'];

  // 4. 실시간 화성학 스케일 연산 엔진 
  const baseNoteNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const scaleDefinitions = {
    'Major / Ionian': "0,2,4,5,7,9,11,12",
    'Dorian': "0,2,3,5,7,9,10,12",
    'Phrygian': "0,1,3,5,7,8,10,12",
    'Lydian': "0,2,4,6,7,9,11,12",
    'Mixolydian': "0,2,4,5,7,9,10,12",
    'Aeolian / Natural Minor': "0,2,3,5,7,8,10,12",
    'Harmonic Minor': "0,2,3,5,7,8,11,12", 
    'Locrian': "0,1,3,5,6,8,10,12",
    'Major Pentatonic': "0,2,4,7,9,12",
    'Major Blues': "0,2,3,4,7,9,12",
    'Minor Pentatonic': "0,3,5,7,10,12",
    'Minor Blues': "0,3,5,6,7,10,12"
  };

  const calculateScaleNotes = () => {
    const rootIndex = baseNoteNames.indexOf(scaleRootKey);
    if (rootIndex === -1) return [];
    const offsetString = scaleDefinitions[selectedScale] || "0,2,4,5,7,9,11,12";
    const offsets = offsetString.split(',').map(num => parseInt(num, 10));
    return offsets.map(offset => {
      const targetIndex = (rootIndex + offset) % 12;
      return baseNoteNames[targetIndex];
    });
  };

  const scaleNotesResult = calculateScaleNotes();

  // =========================================================================
  // 🔄 [교정 완결] 글자 원본의 유령 기호 오염을 원천 차단하는 계명 변환 엔진
  // =========================================================================
  const getNoteName = (semi) => {
    if (semi === null) return null;
    const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    
    let resultNote = "";
    if (isTremolo) {
      const keyOffset = TREMOLO_KEYS[tCurrentKey] || 0;
      const absoluteSemi = semi + keyOffset + (4 * 12);
      resultNote = names[((absoluteSemi % 12) + 12) % 12] + Math.floor(absoluteSemi / 12);
    } else {
      const keyData = isChrom 
        ? (standardKeys[cCurrentKey] || { semi: 0, oct: 4 }) 
        : (isLowKey ? (lowKeys[currentKey] || { semi: 0, oct: 3 }) : (standardKeys[currentKey] || { semi: 0, oct: 4 }));
        
      const absoluteSemi = semi + keyData.semi + (keyData.oct * 12);
      resultNote = names[((absoluteSemi % 12) + 12) % 12] + Math.floor(absoluteSemi / 12);
    }

    // 🎯 [완치 가드] 알파벳 뼈대에 무단 결합해 있던 조합형 도트 기호들을 완전히 소각하여 청정 순정 상태로 반환합니다.
    return resultNote
      .replace(/[\u0300-\u036f\u0307\u0308\u0323\u0324]/g, '')
      .normalize('NFC')
      .replace(/[Åå]/g, 'A')
      .replace(/[Ėė]/g, 'E')
      .replace(/[Ċċ]/g, 'C')
      .replace(/[Ġġ]/g, 'G')
      .replace(/[Ḃḃ]/g, 'B')
      .replace(/[Ḋḋ]/g, 'D');
  };

    
    // 크로마틱 및 다이아토닉 모드는 기존 순정 로직 유지 가드
    const keyData = isChrom 
      ? (standardKeys[cCurrentKey] || { semi: 0, oct: 4 }) 
      : (isLowKey ? (lowKeys[currentKey] || { semi: 0, oct: 3 }) : (standardKeys[currentKey] || { semi: 0, oct: 4 }));
      
    const absoluteSemi = semi + keyData.semi + (keyData.oct * 12);
    return names[((absoluteSemi % 12) + 12) % 12] + Math.floor(absoluteSemi / 12);
  };

  // =========================================================================
  // 🎯 [트레몰로 상단 2중열 부하 하프 연산] 메이저: 반음 위(+1) / 마이너: 단3도 아래(-3)
  // =========================================================================
  const getTremoloTopRowSemi = (baseSemi) => {
    // 설정창에서 선택한 하프 튜닝 옵션(tSelectedTuning)에 따라 분기
    if (tSelectedTuning === 'Minor') {
      return baseSemi - 3; // 단3도 낮은 음정 계산 적용
    }
    return baseSemi + 1; // 기본값 또는 Major 선택 시 반음 위 키 음정 계산 적용
  };


  const handleNoteStart = async (note) => {
    if (!note) return;
    if (Tone.context.state !== 'running') await Tone.start();
    if (!synth.current) {
      synth.current = new Tone.MonoSynth({ oscillator: { type: "triangle8" } }).connect(synthGain.current);
    }
    synth.current.triggerAttack(note);
    setActiveNote(note);
  };

  const handleNoteStop = () => {
    if (synth.current) synth.current.triggerRelease();
    if (!isListeningRef.current) setActiveNote(null);
  };

  function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length, rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / SIZE) < 0.0004) return -1;

    let r1 = 0, r2 = SIZE - 1, thres = 0.04; 
    for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    const sliced = buf.slice(r1, r2);
    if (sliced.length === 0) return -1;

    let c = new Array(sliced.length).fill(0);
    for (let i = 0; i < sliced.length; i++) {
      for (let j = 0; j < sliced.length - i; j++) c[i] = c[i] + sliced[j] * sliced[j + i];
    }
    
    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < sliced.length; i++) {
      if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    if (maxpos === -1 || maxpos === 0) return -1;
    return sampleRate / maxpos;
  }
  const startMic = async () => {
    try {
      if (Tone.context.state !== 'running') await Tone.start();

      if (!micInput.current) {
        micInput.current = new Tone.UserMedia();
        await micInput.current.open();
        
        analyser.current = Tone.getContext().createAnalyser();
        analyser.current.fftSize = 512; 
        
        micInput.current.connect(analyser.current);
        micInput.current.connect(micGain.current);
      }

      setIsListening(true);
      isListeningRef.current = true;

      const updateLoop = () => {
        if (!analyser.current || !isListeningRef.current) return;
        const buf = new Float32Array(analyser.current.fftSize);
        analyser.current.getFloatTimeDomainData(buf);
        
        // 🎯 튜너 감도 감소 실시간 서브 가드 연산 체인 반영
        const baseThreshold = 0.0004;
        const dynamicThreshold = baseThreshold * (1 + (sensitivityReduction / 100));
        
        let SIZE = buf.length, rms = 0;
        for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
        
        if (Math.sqrt(rms / SIZE) < dynamicThreshold) {
          if (!synth.current || synth.current.envelope.value === 0) {
            setActiveNote(null);
          }
          animationFrameRef.current = requestAnimationFrame(updateLoop);
          return;
        }

        const freq = autoCorrelate(buf, Tone.getContext().sampleRate);

        if (freq !== -1 && freq > 120 && freq < 3800) { 
          const n = 12 * Math.log2(freq / baseFreq) + 69;
          const roundedN = Math.round(n);
          const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
          const detectedNoteName = names[roundedN % 12] + (Math.floor(roundedN / 12) - 1);

          setActiveNote(detectedNoteName);
          setCentsOff(Math.floor((n - roundedN) * 100));
        } else {
          if (!synth.current || synth.current.envelope.value === 0) {
            setActiveNote(null);
          }
        }
        animationFrameRef.current = requestAnimationFrame(updateLoop);
      };
      updateLoop();
    } catch (err) { 
      alert("Mic access denied."); 
    }
  };
  
  const stopMic = () => {
    cancelAnimationFrame(animationFrameRef.current);
    if (micInput.current) { micInput.current.close(); micInput.current = null; }
    setIsListening(false);
    isListeningRef.current = false;
    setActiveNote(null);
  };

  const handleBackingTrackLoaded = (fileUrl, name) => {
    setFileName(name);
    if (trackPlayer.current) {
      try { trackPlayer.current.dispose(); } catch (e) { console.log("Player dispose ignored", e); }
    }
    
    const targetOutput = (shifter.current && typeof shifter.current.connect === 'function') 
      ? shifter.current 
      : Tone.getDestination();

    trackPlayer.current = new Tone.Player({ 
      url: fileUrl, fadeIn: 0.1, fadeOut: 0.1, playbackRate: playbackRate 
    }).connect(targetOutput);
  };

  const toggleTrack = async () => {
    if (!trackPlayer.current) return alert("Upload MR file first!");
    await Tone.start();
    if (isPlaying) { 
      trackPlayer.current.stop(); 
      setIsPlaying(false); 
    } else { 
      trackPlayer.current.start(); 
      setIsPlaying(true); 
    }
  };

  const toggleRecording = async () => {
    await Tone.start();
    if (!isRecording) {
      setRecordedUrl(null);
      const beepSynth = new Tone.Oscillator(1000, "sine").toDestination();
      let count = 3;
      setCountdown(count);
      beepSynth.start().stop("+0.5");

      const intervalId = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
          const nextBeep = new Tone.Oscillator(1000, "sine").toDestination();
          nextBeep.start().stop("+0.5");
        } else {
          clearInterval(intervalId);
          setCountdown(null);
          if (mrGain.current && mrGain.current.gain) {
            mrGain.current.gain.setValueAtTime(mrVolume, Tone.getContext().currentTime);
          }
          if (micGain.current && micGain.current.gain) {
            const boostedMicVolume = Math.min(2.5, micVolume * 2.2); 
            micGain.current.gain.setValueAtTime(boostedMicVolume, Tone.getContext().currentTime);
          }
          recorder.current.start();
          setIsRecording(true);
        }
      }, 1000);
    } else {
      const recordedBlob = await recorder.current.stop();
      const blobUrl = URL.createObjectURL(recordedBlob);
      setRecordedUrl(blobUrl);
      setIsRecording(false);
      if (audioPlaybackRef.current) audioPlaybackRef.current.src = blobUrl;
    }
  };

  const toggleRecordedPlayback = () => {
    if (!recordedUrl) return alert("No recorded track found!");
    if (!audioPlaybackRef.current) {
      audioPlaybackRef.current = new Audio(recordedUrl);
      audioPlaybackRef.current.onended = () => setIsRecordedPlaying(false);
    }
    if (isRecordedPlaying) {
      audioPlaybackRef.current.pause();
      setIsRecordedPlaying(false);
    } else {
      audioPlaybackRef.current.play();
      setIsRecordedPlaying(true);
    }
  };
 
  // -----------------------------------------------------------------------
  // 💡 [여기서부터 바인딩] 이 return ( 문장 바로 아랫줄부터 Part 3 소스코드가 직관적으로 연결됩니다!
  // -----------------------------------------------------------------------
  return (
    <div style={BOX_STYLE.container}>
      <div style={BOX_STYLE.contentWrapper}>

        {/* ----------------------------------------------------------------------- */}
        {/* 🛠️ 최상단 제어 툴바 (보내주신 이미지 사양 반영: 다이아토닉 자판 가로폭 동기화 수축 구조) */}
        {/* ----------------------------------------------------------------------- */}
        <div style={{ 
          width: '100%', 
          maxWidth: (!isChrom && !isTremolo) ? '1000px' : (isTremolo ? '100%' : '1200px'),
          margin: '0 auto 1.5vh auto', 
          display: 'grid',
          gridTemplateColumns: isTremolo ? 'repeat(24, minmax(0, 1fr))' : (isChrom ? 'repeat(12, minmax(0, 1fr))' : 'repeat(10, minmax(0, 1fr))'),
          gap: '1vmin',                     
          alignItems: 'center',
          boxSizing: 'border-box', 
          flexShrink: 1,                    
          fontSize: 'calc(10px + 0.4vmin)'  
        }}>
          
          {/* [1번홀 부근 상공 영역]: Harp Key 및 5도권, 포탈 홈 복귀 버튼 통합 매립 */}
          <div style={{ 
            gridColumn: isTremolo ? 'span 6' : 'span 3', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <button 
              onClick={onGoHome}
              style={{ ...BOX_STYLE.settingsBtn, height: '45px', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', borderColor: '#475569', flexShrink: 0 }}
              title="Return to Main Portal Hub"
            >
              <Home size={18} style={{ color: '#10b981' }} />
            </button>

            <span style={{ fontSize: '18px', fontWeight: '700', color: '#94a3b8', whiteSpace: 'nowrap' }}>
              Harp Key
            </span>
            
            <select 
              style={{ ...BOX_STYLE.selectBox, height: '45px', padding: '0 12px', display: 'flex', alignItems: 'center', flexShrink: 0 }} 
              value={currentKey} 
              onChange={(e) => {
                if (isTremolo) {
                  setTCurrentKey(e.target.value);
                  setTScaleRootKey(e.target.value);
                } else if (!isChrom) {
                  handleHarpKeyChange(e.target.value);
                }
              }}
              disabled={isChrom}
            >
              {isTremolo ? (
                ["E", "F", "F#", "G", "G#", "A", "A#", "B", "C", "C#", "D", "D#"].map(k => (
                  <option key={k} value={k}>{k}</option>
                ))
              ) : isChrom ? (
                <option value="C">C</option>
              ) : (
                !isLowKey ? Object.keys(standardKeys).map(k => <option key={k} value={k}>{k}</option>) : Object.keys(lowKeys).map(k => <option key={k} value={k}>{k}</option>)
              )}
            </select>
            
            <button 
              onClick={navigateToCircle} 
              style={{ ...BOX_STYLE.circleBtn, height: '45px', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Circle
            </button>
          </div>

          {/* 중간 공백 필터 */}
          {Array.from({ length: isTremolo ? 16 : (isChrom ? 7 : 5) }).map((_, bIdx) => <div key={bIdx} />)}

          {/* 🔴 [끝에서 2번째 홀 위치 도킹] 마이크 활성화 버튼 */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gridColumn: isTremolo ? 'span 1' : 'auto' }}>
            <button 
              onClick={isListening ? stopMic : startMic} 
              style={{ 
                ...BOX_STYLE.micBtn, 
                height: '45px', 
                width: '100%',          
                padding: 0,               
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: isListening ? '#ef4444' : '#2563eb',
                borderRadius: '12px',
                transition: 'all 0.15s'
              }}
              title={isListening ? 'MIC ACTIVE' : 'START MIC'}
            >
              <Mic size={20} style={{ color: '#ffffff' }} />
            </button>
          </div>

          {/* ⚙️ [가장 마지막 홀 위치 도킹] 세팅 버튼 */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gridColumn: isTremolo ? 'span 1' : 'auto' }}>
            <button 
              onClick={() => setShowSettings(true)} 
              style={{ 
                ...BOX_STYLE.settingsBtn, 
                height: '45px', 
                width: '100%',          
                padding: 0,               
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderRadius: '12px'
              }}
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div> {/* 👈 Part 3가 정확하게 마감되는 도킹선 완료 */}

    
        {/* ----------------------------------------------------------------------- */}
        {/* 🅰️ 다이아토닉 모드 전용 10홀 그리드 렌더링 엔진 분기 */}
        {/* ----------------------------------------------------------------------- */}
           {!isChrom && !isTremolo && (
          <div style={{ 
            display: 'flex', 
            gap: '8px',                     // 👈 홀과 홀 사이의 간격 마진을 사진 속 정갈한 상태로 고수
            padding: '4px 0', 
            width: '100%', 
            maxWidth: '1000px',             // 🎯 [실물 사진 매칭 완결] 상단 메뉴바의 최대 폭과 칼같이 일치시켜 정렬선 합치기
            margin: '0 auto 2.5vh auto',    // 👈 화면 정중앙 도킹 정렬 및 하단 믹서 대시보드와의 상하 여백 밸런스 최적화
            justifyContent: 'space-between', 
            boxSizing: 'border-box',
            position: 'relative'
          }}>       
            {HARP_LAYOUT.holes.map((h, i) => {
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '7.4vw', maxWidth: '80px' }}>
                  
                  {/* 1. 상단 오버 존 스택 구역 */}
                  <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '8px', height: 'calc(29.6vw + 24px)', maxHeight: '344px', width: '100%', justifyContent: 'start', alignItems: 'center', boxSizing: 'border-box', marginBottom: '10px' }}>
                    {ACTIVE_LAYOUT.topSpecials[i]?.map((semiVal, tIdx) => (
                      <div key={tIdx} style={{ width: '100%', height: '7.4vw', maxHeight: '80px', visibility: semiVal === null ? 'hidden' : 'visible', flexShrink: 0 }}>
                        <NoteBox semi={semiVal} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} isBlowZone={true} holeNum={h} showOverbanding={showOverbanding} selectedTuning={selectedTuning} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight}/>
                      </div>
                    ))}
                  </div>

                  {/* 2. 표준 블로우 행 */}
                  <div style={{ width: '100%', height: '7.4vw', maxHeight: '80px', flexShrink: 0, marginBottom: '12px' }}>
                    <NoteBox semi={ACTIVE_LAYOUT.blow[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight} />
                  </div>
                  
                  {/* 3. 중앙 가이드 홀 번호 행 및 스케일 칩 레이어 */}
                  <div style={{ ...BOX_STYLE.holeNumber, margin: '0 0 4px 0', position: 'relative', width: '100%' }}>
                    {h}
                    {i === 0 && (
                      <div style={{ width: '650px', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-start', gap: '14px', position: 'absolute', top: '-260px', left: '0px', zIndex: 300, backgroundColor: 'transparent', backdropFilter: 'none', border: 'none', padding: 0, boxSizing: 'border-box', pointerEvents: 'none', boxShadow: 'none', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '18px', fontWeight: '600', color: '#60a5fa', letterSpacing: '-0.3px', whiteSpace: 'nowrap', textShadow: '0 2px 4px rgba(0,0,0,0.9)', fontFamily: 'inherit' }}>
                            {scaleRootKey} {selectedScale}
                          </span>
                          <span style={{ fontSize: '18px', color: '#475569', fontWeight: '600', letterSpacing: '0.5px', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                            SCALE NOTES
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '10px', flex: 1, overflowX: 'hidden' }}>
                          {scaleNotesResult.map((note, idx) => (
                            <span key={idx} style={{ fontSize: '22px', fontWeight: '600', color: idx === 0 || idx === scaleNotesResult.length - 1 ? '#60a5fa' : '#cbd5e1', textShadow: '0 2px 5px rgba(0,0,0,1)', userSelect: 'none', whiteSpace: 'nowrap', letterSpacing: '-0.5px', flexShrink: 0, fontFamily: 'inherit' }}>
                              {note}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                
                  {/* 4. 표준 드로우 행 */}
                  <div style={{ width: '100%', height: '7.4vw', maxHeight: '80px', flexShrink: 0, marginBottom: '10px' }}>
                    <NoteBox semi={ACTIVE_LAYOUT.draw[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight} />
                  </div>

                                   {/* 5. 하단 벤딩 존 스택 구역 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: 'calc(22.2vw + 16px)', maxHeight: '256px', width: '100%', justifyContent: 'start', alignItems: 'center' }}>
                    {ACTIVE_LAYOUT.bottomSpecials[i]?.map((semiVal, sIdx) => (
                      <div key={sIdx} style={{ width: '100%', height: '7.4vw', maxHeight: '80px', visibility: semiVal === null ? 'hidden' : 'visible', flexShrink: 0 }}>
                        <NoteBox semi={semiVal} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} isDrawZone={true} holeNum={h} showOverbanding={showOverbanding} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight} />
                      </div>
                    ))}
                  </div>

                  {/* 🎯 [다이아토닉 전용] 5번홀~10번홀 하단부 빈 공간 맞춤 도킹 레이어 매립 */}
                  {h === 10 && (
                    <div style={{ 
                      position: 'absolute', 
                      bottom: 'calc(-10px - 1vh)', // 👈 하단 대시보드 바로 윗선 빈 공간에 칼같이 정렬
                      right: '0px', 
                      width: 'calc(6 * 8.5vw + 50px)', // 👈 5번 홀부터 10번 홀까지의 총 너비를 자동 연산
                      maxWidth: '650px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'flex-end', // 👈 정갈한 왼쪽 텍스트 라인 정렬
                      pointerEvents: 'none', 
                      zIndex: 10, 
                      fontFamily: 'inherit', 
                      lineHeight: '1.35' 
                    }}>
                      <div style={{ fontSize: 'calc(12px + 0.4vw)', minFontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '2px' }}>
                        [ {selectedTuning.toUpperCase()} TUNING | SCALE : {selectedScale.toUpperCase()} ]
                      </div>
                      <div style={{ fontSize: 'calc(16px + 1.2vw)', minFontSize: '15px', fontWeight: '600', color: '#10b981', marginBottom: '4px', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
                        Diatonic Harmonica Training Center
                      </div>
                      <div style={{ color: '#475569', fontSize: 'calc(10px + 0.3vw)', minFontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        Copyright ⓒ 2026 CoffeeBada Lee, ChoongKoo All Rights Reserved.
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* 🅱️ 크로마틱 모드 전용 12홀 5행 그리드 렌더링 엔진 분기 (순수 텍스트 정합) */}
        {/* ----------------------------------------------------------------------- */}
        {isChrom && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2vh', boxSizing: 'border-box' }}>
            
            {/* [투명 텍스트 가이드 행] 박스 없이 순수하게 표출되는 [전조 키 + 스케일 종류] 및 구성음 */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', padding: '8px 0', backgroundColor: 'transparent', border: 'none', boxSizing: 'border-box', marginBottom: '1vh', overflow: 'hidden', pointerEvents: 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '20px', fontWeight: '600', color: '#60a5fa', letterSpacing: '-0.3px', whiteSpace: 'nowrap', textShadow: '0 2px 5px rgba(0,0,0,1)', fontFamily: 'inherit' }}>
                  {scaleRootKey} {selectedScale}
                </span>
                <span style={{ fontSize: '18px', color: '#475569', fontWeight: '600', letterSpacing: '0.5px', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  SCALE NOTES
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '18px', flex: 1, overflowX: 'hidden' }}>
                {scaleNotesResult.map((note, idx) => (
                  <span key={idx} style={{ fontSize: '24px', fontWeight: '600', color: idx === 0 || idx === scaleNotesResult.length - 1 ? '#60a5fa' : '#cbd5e1', textShadow: '0 2px 5px rgba(0,0,0,1)', userSelect: 'none', whiteSpace: 'nowrap', letterSpacing: '-0.5px', flexShrink: 0, fontFamily: 'inherit' }}>
                    {note}
                  </span>
                ))}
              </div>
            </div>

            {/* 크로마틱 물리 자판 격자 패널 구역 */}
            <div style={{ ...BOX_STYLE.gridContainer, marginTop: '0px' }}>
              {Array.from({ length: 12 }).map((_, i) => {
                const h = i + 1;
                const targetLayout = CHROMATIC_TUNINGS[selectedTuning] || CHROMATIC_LAYOUT;
                
                const sliderBlowOffsets = targetLayout.sliderBlow;
                const standardBlowOffsets = targetLayout.blow;
                const standardDrawOffsets = targetLayout.draw;
                const sliderDrawOffsets = targetLayout.sliderDraw;

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '6.2vw', maxWidth: '80px' }}>
                    
                    {/* 행 1: [Slider In Blow Zone] */}
                    <div style={{ width: '100%', height: '4.2vw', maxHeight: '80px', flexShrink: 0, marginBottom: '12px' }}>
                      <NoteBox semi={sliderBlowOffsets[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight} isSliderZone={true}/>
                    </div>

                    {/* 행 2: [Standard Blow Zone] */}
                    <div style={{ width: '100%', height: '4.2vw', maxHeight: '80px', flexShrink: 0, marginBottom: '16px' }}>
                      <NoteBox semi={standardBlowOffsets[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight}/>
                    </div>
                    
                    {/* 행 3: [중앙 가이드 홀 번호 행] */}
                    <div style={{ ...BOX_STYLE.holeNumber, width: '100%', height: '48px', margin: '0 0 8px 0', fontSize: '20px', color: '#94a3b8' }}>
                      {h}
                    </div>
                  
                    {/* 행 4: [Standard Draw Zone] */}
                    <div style={{ width: '100%', height: '4.2vw', maxHeight: '80px', flexShrink: 0, marginBottom: '12px' }}>
                      <NoteBox semi={standardDrawOffsets[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight}/>
                    </div>

                    {/* 행 5: [Slider In Draw Zone] */}
                    <div style={{ width: '100%', height: '4.2vw', maxHeight: '80px', flexShrink: 0, marginBottom: '10px' }}>
                      <NoteBox semi={sliderDrawOffsets[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight} isSliderZone={true}/>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* 🎯 [크로마틱 전용] 기존 오른쪽 하단부 정렬 레이아웃 100% 고수 */}
        {isChrom && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', pointerEvents: 'none', zIndex: 10, fontFamily: 'inherit', lineHeight: '1.3', marginTop: '1vh' }}>
            <div style={{ fontSize: 'calc(11px + 0.4vw)', minFontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '2px' }}>
              [ MODE : {selectedTuning.toUpperCase()} TUNING | SCALE : {selectedScale.toUpperCase()} ]
            </div>
            <div style={{ fontSize: 'calc(13px + 1.2vw)', minFontSize: '16px', fontWeight: '600', color: '#10b981', marginBottom: '6px', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
              Chromatic Harmonica Training Center
            </div>
            <div style={{ color: '#475569', fontSize: 'calc(8px + 0.4vw)', minFontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
              Copyright ⓒ 2026 CoffeeBada Lee, ChoongKoo All Rights Reserved.
            </div>
            <div style={{ color: '#64748b', fontSize: 'calc(8px + 0.4vw)', minFontSize: '11px', fontWeight: '600', marginTop: '1px', whiteSpace: 'nowrap' }}>
              Contact : 279.lee@gmail.com
            </div>
          </div>
        )}
        
                {/* ----------------------------------------------------------------------- */}
        {/* 🆃 [신규] 트레몰로 하모니카 모드 전용 24홀 2중열 그리드 렌더링 엔진 분기 */}
        {/* ----------------------------------------------------------------------- */}
        {isTremolo && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1vh', boxSizing: 'border-box' }}>
            
            {/* [투명 텍스트 가이드 행] 실시간 스케일 종류 및 가로 한 줄 온음계 흐름 */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', padding: '4px 0', backgroundColor: 'transparent', border: 'none', boxSizing: 'border-box', marginBottom: '0.5vh', overflow: 'hidden', pointerEvents: 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '18px', fontWeight: '600', color: '#c084fc', letterSpacing: '-0.3px', whiteSpace: 'nowrap', textShadow: '0 2px 5px rgba(0,0,0,1)', fontFamily: 'inherit' }}>
                  {tScaleRootKey} {selectedScale}
                </span>
                <span style={{ fontSize: '16px', color: '#475569', fontWeight: '600', letterSpacing: '0.5px', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  SCALE NOTES
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '14px', flex: 1, overflowX: 'hidden' }}>
                {scaleNotesResult.map((note, idx) => (
                  <span key={idx} style={{ fontSize: '20px', fontWeight: '600', color: idx === 0 || idx === scaleNotesResult.length - 1 ? '#c084fc' : '#cbd5e1', textShadow: '0 2px 5px rgba(0,0,0,1)', userSelect: 'none', whiteSpace: 'nowrap', letterSpacing: '-0.5px', flexShrink: 0, fontFamily: 'inherit' }}>
                    {note}
                  </span>
                ))}
              </div>
            </div>

            {/* 🎯 [화면 크기 맞춤 자동 축소 가드] 24홀 가변 그리드 기판 */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'row',
              flexWrap: 'nowrap', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              gap: '2px', 
              width: '100%', 
              boxSizing: 'border-box',
              marginTop: '0px',
              overflow: 'hidden' 
            }}>
              {Array.from({ length: 24 }).map((_, i) => {
                // 🎯 1번부터 24번까지의 실제 하모니카 절대 홀 번호 강제 매핑 고정
                const h = i + 1;
                const baseSemi = TREMOLO_BASE_C_KEY[i];
                const topRowSemi = getTremoloTopRowSemi(baseSemi);
                
                const isMinorModeActive = selectedTuning === 'Minor';

                // 🎯 [정밀 바인딩] 절대 번호 h와 마이너 플래그를 누락 없이 1:1 전달
                const topDots = getTremoloTopRowDots(h, isMinorModeActive);
                const bottomDots = getTremoloBottomRowDots(h);

                // 🎯 [순백색 #ffffff 가로 방향 정렬] 음 이름 정중앙 absolute 정합 칩 생성기
                const renderOctaveDots = (dotsInfo) => {
                  if (dotsInfo.position === 'none' || dotsInfo.count === 0) return null;
                  return (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      [dotsInfo.position]: '6px', 
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '4px', 
                      height: '4px',
                      pointerEvents: 'none',
                      zIndex: 15
                    }}>
                      {Array.from({ length: dotsInfo.count }).map((_, dIdx) => (
                        <div key={dIdx} style={{ width: '4px', height: '4px', backgroundColor: '#ffffff', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.8)' }} />
                      ))}
                    </div>
                  );
                };

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: '1 1 0%', minWidth: '0px', boxSizing: 'border-box' }}>
                    
                    {/* 🎯 행 1: [첫번째줄 부하 하프 상단 레이어] - 옥타브 도트 조건문 완벽 탑재 */}
                    <div style={{ width: '100%', height: '3.6vw', minHeight: '30px', maxHeight: '65px', flexShrink: 0, marginBottom: '6px', position: 'relative', display: showCMinusSharp ? 'block' : 'none' }}>
                      {renderOctaveDots(topDots)}
                      <NoteBox semi={topRowSemi} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight} isSliderZone={true} isTremoloMode={true} tremoloLabelFn={(note) => getTremoloDisplayLabel(note, true)}/>
                    </div>

                    {/* 🎯 행 2: [두번째줄 온음 C키 하단 레이어] - 하단 순정 상시 고정 도트 탑재 (16번 홀 완치) */}
                    <div style={{ width: '100%', height: '3.6vw', minHeight: '30px', maxHeight: '65px', flexShrink: 0, marginBottom: '6px', position: 'relative' }}>
                      {renderOctaveDots(bottomDots)}
                      <NoteBox semi={baseSemi} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight} isTremoloMode={true} tremoloLabelFn={(note) => getTremoloDisplayLabel(note, false)}/>
                    </div>
                    
                    {/* 행 3: [중앙 순수 가이드 홀 번호 행] - 차분한 메탈 회색 고수 */}
                    <div style={{ width: '100%', height: '32px', border: '1px solid #475569', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', margin: '0', userSelect: 'none', flexShrink: 0, fontFamily: 'inherit' }}>
                      <span style={{ fontWeight: '700', fontSize: 'calc(9px + 0.3vw)', minFontSize: '11px', color: '#94a3b8' }}>
                        {h}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🎯 [트레몰로 전용] 우측 하단 정렬 레이아웃 싱크 디스플레이 푸터 마감 */}
        {isTremolo && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', pointerEvents: 'none', zIndex: 10, fontFamily: 'inherit', lineHeight: '1.3', marginTop: '1.5vh' }}>
            <div style={{ fontSize: 'calc(10px + 0.4vw)', minFontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '2px' }}>
              [ MODE : TREMOLO STANDARD | TUNING : {selectedTuning === 'Minor' ? 'MINOR' : 'MAJOR'} | LABEL : {tDisplayLabelType} | C-SHARP LAYER : {showCMinusSharp ? 'VISIBLE' : 'HIDDEN'} ]
            </div>
            <div style={{ fontSize: 'calc(13px + 1.2vw)', minFontSize: '16px', fontWeight: '600', color: '#a855f7', marginBottom: '6px', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
              Tremolo Harmonica Training Center
            </div>
            <div style={{ color: '#475569', fontSize: 'calc(8px + 0.4vw)', minFontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
              Copyright ⓒ 2026 CoffeeBada Lee, ChoongKoo All Rights Reserved.
            </div>
          </div>
        )}


        {/* ----------------------------------------------------------------------- */}
        {/* 🎛️ 오디오 대시보드 제어 인터페이스 구역 (보내주신 이미지 사양 반영: 다이아토닉 가로폭 동기화) */}
        {/* ----------------------------------------------------------------------- */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          width: '100%', 
          // 🎯 [실물 사진 매칭 완결] 다이아토닉 모드일 때 하단 메뉴 프레임의 폭을 자판 및 상단 메뉴와 일직선으로 연동
          maxWidth: (!isChrom && !isTremolo) ? '1000px' : (isTremolo ? '100%' : '1200px'),
          margin: '0 auto',                  // 👈 화면 정중앙 도킹 정렬 및 좌우 마진 균형 일치
          gap: '1vh', 
          boxSizing: 'border-box', 
          marginTop: 'auto',                
          flexShrink: 1,                    
          paddingBottom: '2vh'
        }}>
          
          {/* 🎼 [1층 축: 배킹트랙 MR 및 속도/피치 통합 3등분 라인] */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', width: '100%', gap: '14px', alignItems: 'center', boxSizing: 'border-box' }}>
            
            {/* 1-1. MR 파일 업로드 및 실시간 플레이어 메인 제어 통로 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111827', padding: '8px 14px', borderRadius: '12px', border: '1px solid #1e293b', height: '48px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 0 }}>
                <BackingTrackPlayer onFileLoaded={handleBackingTrackLoaded} />
              </div>
              <button onClick={toggleTrack} style={{ ...DASHBOARD_STYLE.playBtn, height: '32px', width: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: isPlaying ? '#ef4444' : '#10b981' }}>
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={DASHBOARD_STYLE.label}>MR VOL ({Math.round(mrVolume * 100)}%)</span>
                <input type="range" min="0" max="1" step="0.01" value={mrVolume} onChange={(e) => setMrVolume(parseFloat(e.target.value))} style={{ width: '100%', height: '4px' }} />
              </div>
            </div>

            {/* 1-2. SPEED 배킹 트랙 속도 증감 버튼 정밀 컨트롤러 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111827', padding: '6px 14px', borderRadius: '12px', border: '1px solid #1e293b', height: '48px', boxSizing: 'border-box' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', whiteSpace: 'nowrap' }}>SPEED</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setPlaybackRate(prev => Math.max(0.4, parseFloat((prev - 0.05).toFixed(2))))} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#374151', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', userSelect: 'none' }}>-</button>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#60a5fa', minWidth: '48px', textAlign: 'center' }}>{playbackRate.toFixed(2)}x</span>
                <button onClick={() => setPlaybackRate(prev => Math.min(1.0, parseFloat((prev + 0.05).toFixed(2))))} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#374151', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', userSelect: 'none' }}>+</button>
              </div>
            </div>

            {/* 1-3. PITCH 반음 키 전조 증감 정밀 컨트롤러 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111827', padding: '6px 14px', borderRadius: '12px', border: '1px solid #1e293b', height: '48px', boxSizing: 'border-box' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', whiteSpace: 'nowrap' }}>PITCH</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setPitchKeyOffset(prev => Math.max(-6, prev - 1))} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#374151', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', userSelect: 'none' }}>-</button>
                <span style={{ fontSize: '14px', fontWeight: '700', color: pitchKeyOffset === 0 ? '#10b981' : (pitchKeyOffset > 0 ? '#fbbf24' : '#fb7171'), minWidth: '36px', textAlign: 'center' }}>{pitchKeyOffset > 0 ? `+${pitchKeyOffset}` : pitchKeyOffset}</span>
                <button onClick={() => setPitchKeyOffset(prev => Math.min(6, prev + 1))} style={{ width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#374151', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', userSelect: 'none' }}>+</button>
              </div>
            </div>
          </div>

          {/* 🔴 [2층 축: 믹스 & 레코드 통합 3등분 라인] */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', width: '100%', gap: '14px', alignItems: 'center', boxSizing: 'border-box' }}>
            
            {/* 2-1. 통합 믹싱 세이프 레코딩 기능 제어 버튼 그룹 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '48px', boxSizing: 'border-box' }}>
              <button onClick={toggleRecording} style={{ flex: 1, height: '100%', borderRadius: '10px', backgroundColor: isRecording ? '#ef4444' : '#1e293b', color: 'white', fontWeight: '700', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '1px solid #374151', fontFamily: 'inherit' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isRecording ? '#ffffff' : '#ef4444' }} />
                {isRecording ? 'STOP' : 'RECORD'}
              </button>
              <button onClick={toggleRecordedPlayback} disabled={!recordedUrl} style={{ flex: 1.2, height: '100%', borderRadius: '10px', backgroundColor: isRecordedPlaying ? '#10b981' : '#111827', color: 'white', fontWeight: '700', fontSize: '11px', cursor: recordedUrl ? 'pointer' : 'not-allowed', opacity: recordedUrl ? 1 : 0.4, border: '1px solid #1e293b', fontFamily: 'inherit' }}>
                {isRecordedPlaying ? 'STOP' : 'PLAY'}
              </button>
              <button onClick={() => { if (!recordedUrl) return; const a = document.createElement('a'); a.href = recordedUrl; a.download = `harmonica_mix_${new Date().toISOString().slice(0,10)}.wav`; a.click(); }} disabled={!recordedUrl} style={{ flex: 1, height: '100%', borderRadius: '10px', backgroundColor: '#4b5563', color: 'white', fontWeight: '700', fontSize: '11px', cursor: recordedUrl ? 'pointer' : 'not-allowed', opacity: recordedUrl ? 1 : 0.3, border: '1px solid #4b5563', fontFamily: 'inherit' }}>
                SAVE
              </button>
            </div>

            {/* 2-2. MIC 인풋 마스터 볼륨 페이더 슬라이더 박스 */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#111827', padding: '8px 14px', borderRadius: '12px', border: '1px solid #1e293b', height: '48px', boxSizing: 'border-box' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span style={{ ...DASHBOARD_STYLE.label, fontSize: '11px', color: '#94a3b8' }}>MIC VOL ({Math.round(micVolume * 100)}%)</span>
                <input type="range" min="0" max="1" step="0.01" value={micVolume} onChange={(e) => { const newVol = parseFloat(e.target.value); setMicVolume(newVol); if (isRecording && micGain.current) { micGain.current.gain.setValueAtTime(newVol, Tone.getContext().currentTime); } }} style={{ width: '100%', height: '4px' }} />
              </div>
            </div>

            {/* 2-3. 가이드 SYNTH 볼륨 페이더 슬라이더 박스 */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#111827', padding: '8px 14px', borderRadius: '12px', border: '1px solid #1e293b', height: '48px', boxSizing: 'border-box' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span style={{ ...DASHBOARD_STYLE.label, fontSize: '11px', color: '#94a3b8' }}>SYNTH VOL ({Math.round(synthVolume * 100)}%)</span>
                <input type="range" min="0" max="1" step="0.01" value={synthVolume} onChange={(e) => setSynthVolume(parseFloat(e.target.value))} style={{ width: '100%', height: '4px' }} />
              </div>
            </div>
          </div>
        </div> {/* 👈 하단 오디오 대시보드 겉박스가 정확히 닫히는 정합 마감선 완료 */}

        {/* ⚙️ 통합 환경설정 모달창 구역 */}
        {showSettings && (
          <div style={MODAL_STYLE.modalOverlay}>
            <div style={MODAL_STYLE.modalContent}>
              
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff', marginBottom: '25px', marginTop: 0, borderBottom: '1px solid #374151', paddingBottom: '12px' }}>
                🔧 {isTremolo ? 'Tremolo' : (isChrom ? 'Chromatic' : 'Diatonic')} Settings Menu
              </h2>

                            {/* ----------------------------------------------------------------------- */}
              {/* 1. 하프 튜닝 및 옵션 선택 구역 (트레몰로 메이저/마이너 2대 옵션 단축 적용) */}
              {/* ----------------------------------------------------------------------- */}
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Harp Tuning 하프 튜닝</span>
                <select 
                  value={selectedTuning} 
                  onChange={(e) => setSelectedTuning(e.target.value)}
                  style={{ width: '100%', background: '#1e293b', color: isTremolo ? '#c084fc' : '#60a5fa', border: '1px solid #374151', borderRadius: '12px', padding: '12px', fontSize: '16px', fontWeight: '700', outline: 'none', fontFamily: 'inherit' }}
                >
                  {isTremolo ? (
                    // 🎯 트레몰로 트레이닝 룸 독점: 메이저/마이너 단 2가지 교본 사양 옵션 매핑
                    [
                      { val: 'Standard', label: 'Major (반음 위 하프 연동)' },
                      { val: 'Minor', label: 'Minor (단3도 아래 하프 연동)' }
                    ].map(opt => (
                      <option key={opt.val} value={opt.val}>{opt.label}</option>
                    ))
                  ) : (
                    isChrom ? (
                      ['Standard', 'Bebop', 'C6', 'C6 Bebop', 'Diminished', 'Augmented', 'Whole Tone', 'Orchestra'].map(t => (
                        <option key={t} value={t}>{t} Tuning</option>
                      ))
                    ) : (
                      ['Richter', 'Country', 'Melody Maker', 'Natural Minor', 'Harmonic', 'Paddy Richter'].map(t => (
                        <option key={t} value={t}>{t} Tuning</option>
                      ))
                    )
                  )}
                </select>
              </div>


                            {/* 2. 스케일 키 선택 및 3. 규칙 지정 구역 */}
              <div style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Select Scale Key 스케일 키 선택</span>
                  <select 
                    value={scaleRootKey} 
                    onChange={(e) => setScaleRootKey(e.target.value)}
                    style={{ width: '100%', background: '#1e293b', color: '#ffffff', border: '1px solid #374151', borderRadius: '12px', padding: '12px', fontSize: '16px', fontWeight: 'bold', outline: 'none', fontFamily: 'inherit' }}
                  >
                    {["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"].map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Select Scale 스케일 선택</span>
                  <select 
                    value={selectedScale} 
                    onChange={(e) => setSelectedScale(e.target.value)}
                    style={{ width: '100%', background: '#1e293b', color: '#ffffff', border: '1px solid #374151', borderRadius: '12px', padding: '12px', fontSize: '16px', fontWeight: 'bold', outline: 'none', fontFamily: 'inherit' }}
                  >
                    {['Major / Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian / Natural Minor', 'Harmonic Minor', 'Locrian', 'Major Pentatonic', 'Major Blues', 'Minor Pentatonic', 'Minor Blues'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4-A. 트레몰로 하모니카 전용 C#키 상단 레이어 보임/숨김 실시간 토글 제어 스위치 */}
              {isTremolo && (
                <div style={{ marginBottom: '22px' }}>
                  <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>C# Key Layer Control (상단 C#키 레이어 토글)</span>
                  <select 
                    value={showCMinusSharp ? 'ON' : 'OFF'} 
                    onChange={(e) => setShowCMinusSharp(e.target.value === 'ON')}
                    style={{ width: '100%', background: '#1e293b', color: showCMinusSharp ? '#c084fc' : '#ffffff', border: '1px solid #374151', borderRadius: '12px', padding: '12px', fontSize: '16px', fontWeight: '900', outline: 'none', fontFamily: 'inherit' }}
                  >
                    <option value="ON" style={{ color: '#c084fc', fontWeight: 'bold' }}> C# Key Layer VISIBLE (상단 C#키 표시) </option>
                    <option value="OFF" style={{ color: '#ffffff', fontWeight: 'bold' }}> C# Key Layer HIDDEN (상단 C#키 숨김) </option>
                  </select>
                </div>
              )}
              {/* 🎯 [트레몰로 전용] 4-A-2. 음이름 한글 표시 및 순수 숫자 도수 표시 옵션 통합 제어 스위치 */}
              {isTremolo && (
                <div style={{ marginBottom: '22px' }}>
                  <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Note Label Display Option (음이름 표기 방식 옵션)</span>
                  <select 
                    value={tDisplayLabelType} 
                    onChange={(e) => setTDisplayLabelType(e.target.value)}
                    style={{ width: '100%', background: '#1e293b', color: '#10b981', border: '1px solid #374151', borderRadius: '12px', padding: '12px', fontSize: '16px', fontWeight: '700', outline: 'none', fontFamily: 'inherit' }}
                  >
                    <option value="ENG" style={{ color: '#ffffff', fontWeight: 'bold' }}> English Label Mode (영문 계명 : C, D, E...) </option>
                    <option value="KOR" style={{ color: '#60a5fa', fontWeight: 'bold' }}> Korean Label Mode (한글 음이름 : 도, 레, 미...) </option>
                    <option value="DEG" style={{ color: '#facc15', fontWeight: 'bold' }}> Degree Scale Mode (순수 숫자 도수 표기 : 1, 2, 3...) </option>
                  </select>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold', marginTop: '4px', display: 'block' }}>
                    * 도수 선택 시, C 하모니카 기준 9번 홀(C5)을 기점으로 순수 숫자 1~7이 정밀 연산 정렬됩니다.
                  </span>
                </div>
              )}


              {/* 4-B. Low Key Harp 선택 박스 (다이아토닉 모드일 때만 활성화 가드 작동) */}
              {!isChrom && !isTremolo && (
                <div style={{ marginBottom: '22px' }}>
                  <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Select Low Key Harp 로우키 하프 선택</span>
                  <select 
                    value={isLowKey ? 'ON' : 'OFF'} 
                    onChange={(e) => {
                      const nm = e.target.value === 'ON';
                      setIsLowKey(nm);
                      setCurrentKey(nm ? 'LF' : 'C');
                      setScaleRootKey(nm ? 'F' : 'C');
                      setSelectedScale('Major / Ionian');
                    }}
                    style={{ width: '100%', background: '#1e293b', color: isLowKey ? '#10b981' : '#ffffff', border: '1px solid #374151', borderRadius: '12px', padding: '12px', fontSize: '16px', fontWeight: '900', outline: 'none', fontFamily: 'inherit' }}
                  >
                    <option value="OFF" style={{ color: '#ffffff', fontWeight: 'bold' }}> Standard Harp Key Mode </option>
                    <option value="ON" style={{ color: '#10b981', fontWeight: 'bold' }}> Low Key Harp Key Mode </option>
                  </select>
                </div>
              )}

              {/* 5. 스케일 노트 하이라이트 활성화 제어 스위치 모듈 */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Scale Notes Highlight 스케일 노트 하이라이트</span>
                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>선택된 스케일 음정을 노란색 글씨로 시각화합니다.</span>
                  </div>
                  <div style={{ display: 'flex', backgroundColor: '#111827', padding: '4px', borderRadius: '10px', border: '1px solid #374151', flexShrink: 0 }}>
                    <button onClick={() => setUseScaleHighlight(false)} style={{ padding: '6px 14px', backgroundColor: !useScaleHighlight ? '#ef4444' : 'transparent', border: 'none', color: !useScaleHighlight ? 'white' : '#64748b', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>OFF (기본)</button>
                    <button onClick={() => setUseScaleHighlight(true)} style={{ padding: '6px 14px', marginLeft: '4px', backgroundColor: useScaleHighlight ? '#10b981' : '#transparent', border: 'none', color: useScaleHighlight ? 'black' : '#64748b', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>ON 활성화</button>
                  </div>
                </div>
              </div>

                          {/* 6. 기본 피치 설정 구역 */}
              <div style={{ marginBottom: '22px' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Standard Pitch 표준 피치 설정 : A={baseFreq}Hz</span>
                <input type="range" min="430" max="450" step="1" value={baseFreq} onChange={(e) => setBaseFreq(parseInt(e.target.value))} style={{ width: '100%', height: '6px' }} />
              </div>

              {/* 7. 허용 오차 디테일 구역 */}
              <div style={{ marginBottom: '22px' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Tolerance 튜너 허용 오차 (±{tolerance}c)</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['5', '10', '15', '20'].map(val => (
                    <button key={val} onClick={() => setTolerance(parseInt(val))} style={{ flex: 1, padding: '12px 0', borderRadius: '10px', border: 'none', backgroundColor: tolerance === parseInt(val) ? '#10b981' : '#374151', color: tolerance === parseInt(val) ? 'black' : 'white', fontWeight: '900', cursor: 'pointer', fontSize: '15px', fontFamily: 'inherit' }}>±{val}</button>
                  ))}
                </div>
              </div>

              {/* 8. 튜너 감도 감소 실시간 마스터 컨트롤러 모듈 */}
              <div style={{ marginBottom: '22px' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Tuner Sensitivity Reduction 튜너 감도 감소 제어</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['0', '10', '20', '30', '40'].map(val => {
                    const numVal = parseInt(val, 10);
                    return (
                      <button key={val} onClick={() => setSensitivityReduction(numVal)} style={{ flex: 1, padding: '12px 0', borderRadius: '10px', border: 'none', backgroundColor: sensitivityReduction === numVal ? '#2563eb' : '#374151', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', transition: 'all 0.15s' }}>{numVal === 0 ? '현재 상태' : `-${numVal}%`}</button>
                    );
                  })}
                </div>
              </div>

              {/* 9. 공간계 조절 구역 */}
              <div style={{ marginBottom: '25px', padding: '18px', backgroundColor: '#1f2937', borderRadius: '14px', border: '1px solid #374151' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'nowrap' }}>
                  <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Reverb Master Control</span>
                  <div style={{ display: 'flex', backgroundColor: '#111827', padding: '4px', borderRadius: '10px', border: '1px solid #374151' }}>
                    <button onClick={() => setUseReverb(!useReverb)} style={{ padding: '6px 14px', backgroundColor: useReverb ? '#10b981' : '#ef4444', border: 'none', color: useReverb ? 'black' : 'white', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>{useReverb ? 'ON' : 'OFF'}</button>
                    <button onClick={() => useReverb && setReverbMode('standard')} disabled={!useReverb} style={{ padding: '6px 12px', marginLeft: '4px', backgroundColor: useReverb && reverbMode === 'standard' ? '#2563eb' : 'transparent', border: 'none', color: useReverb && reverbMode === 'standard' ? 'white' : '#64748b', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: useReverb ? 'pointer' : 'not-allowed', opacity: useReverb ? 1 : 0.3, transition: 'all 0.15s', fontFamily: 'inherit' }}>STANDARD</button>
                    <button onClick={() => useReverb && setReverbMode('spring')} disabled={!useReverb} style={{ padding: '6px 12px', marginLeft: '4px', backgroundColor: useReverb && reverbMode === 'spring' ? '#2563eb' : 'transparent', border: 'none', color: useReverb && reverbMode === 'spring' ? 'white' : '#64748b', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: useReverb ? 'pointer' : 'not-allowed', opacity: useReverb ? 1 : 0.3, transition: 'all 0.15s', fontFamily: 'inherit' }}>SPRING</button>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #374151', paddingTop: '14px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 'bold' }}>Reverb Amount 리버브 효과량(Wet)</span>
                    <span style={{ fontSize: '15px', color: '#10b981', fontWeight: '900' }}>{Math.round(reverbWet * 100)}%</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={reverbWet} onChange={(e) => setReverbWet(parseFloat(e.target.value))} disabled={!useReverb} style={{ width: '100%', height: '6px', cursor: useReverb ? 'pointer' : 'not-allowed', opacity: useReverb ? 1 : 0.4 }} />
                </div>
              </div>
                              <button onClick={() => setShowSettings(false)} style={{ ...MODAL_STYLE.saveBtn, fontSize: '20px', padding: '18px' }}>SAVE & CLOSE</button>
            </div>
          </div>
        )}

        {/* 🎯 녹음 시작 전 화면 정중앙 3, 2, 1 초거대 입체 카운트다운 팝업 오버레이 */}
        {countdown !== null && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 10, 20, 0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, pointerEvents: 'auto', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>
            <div style={{ fontSize: 'calc(80px + 12vw)', fontWeight: '950', color: countdown === 3 ? '#ef4444' : (countdown === 2 ? '#eab308' : '#10b981'), textShadow: '0 10px 40px rgba(0,0,0,0.9), 0 0 80px rgba(255,255,255,0.15)', userSelect: 'none' }}>{countdown}</div>
            <span style={{ fontSize: '24px', fontWeight: '800', color: '#94a3b8', marginTop: '20px', letterSpacing: '2px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>PREPARING RECORD...</span>
          </div>
        )}

      </div> {/* 👈 BOX_STYLE.contentWrapper 마감 */}
    </div>   /* 👈 BOX_STYLE.container 마감 */
  );
}

// =========================================================================
// 🎯 [15단계] 5도권 서클 트레이닝 룸 (NewFeaturePage) 핵심 데이터 및 상단 정의 구역
// =========================================================================
const keysCircleData = [
  { name: 'C',  relMin: 'Am',  angle: 0,   sig: 'C Major / A minor', sharpCount: 0, flatCount: 0, isSharp: false, isFlat: false },
  { name: 'G',  relMin: 'Em',  angle: 30,  sig: 'G Major / E minor (1#)', sharpCount: 1, flatCount: 0, isSharp: true, isFlat: false },
  { name: 'D',  relMin: 'Bm',  angle: 60,  sig: 'D Major / B minor (2#)', sharpCount: 2, flatCount: 0, isSharp: true, isFlat: false },
  { name: 'A',  relMin: 'F#m', angle: 90,  sig: 'A Major / F# minor (3#)', sharpCount: 3, flatCount: 0, isSharp: true, isFlat: false },
  { name: 'E',  relMin: 'C#m', angle: 120, sig: 'E Major / C# minor (4#)', sharpCount: 4, flatCount: 0, isSharp: true, isFlat: false },
  { name: 'B',  relMin: 'G#m', angle: 150, sig: 'B Major / G# minor (5#)', sharpCount: 5, flatCount: 0, isSharp: true, isFlat: false },
  { name: 'F#', relMin: 'D#m', angle: 180, sig: 'F# Major / D# minor (6#)', sharpCount: 6, flatCount: 0, isSharp: true, isFlat: false },
  { name: 'Db', relMin: 'Bbm', angle: 210, sig: 'Db Major / Bb minor (5b)', sharpCount: 0, flatCount: 5, isSharp: false, isFlat: true },
  { name: 'Ab', relMin: 'Fm',  angle: 240, sig: 'Ab Major / F minor (4b)', sharpCount: 0, flatCount: 4, isSharp: false, isFlat: true },
  { name: 'Eb', relMin: 'Cm',  angle: 270, sig: 'Eb Major / C minor (3b)', sharpCount: 0, flatCount: 3, isSharp: false, isFlat: true },
  { name: 'Bb', relMin: 'Gm',  angle: 300, sig: 'Bb Major / G minor (2b)', sharpCount: 0, flatCount: 2, isSharp: false, isFlat: true },
  { name: 'F',  relMin: 'Dm',  angle: 330, sig: 'F Major / D minor (1b)', sharpCount: 0, flatCount: 1, isSharp: false, isFlat: true }
];

function NewFeaturePage({ onRouteClick }) {
  const [rotationAngle, setRotationAngle] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayMode, setDisplayMode] = useState('harmonica'); 
  const [isDragging, setIsDragging] = useState(false);
  /* eslint-disable-next-line no-unused-vars */
  const [ hoveredIdx, setHoveredIdx] = useState(null);

  const mainWrapperRef = useRef(null);
  const dragStartAngle = useRef(0);
  const baseRotationOnDragStart = useRef(0);

  const majorCircleRadius = 40;    
  const minorCircleRadius = 27;
  /* eslint-disable-next-line no-unused-vars */    
  const staffCircleRadius = 54;
  /* eslint-disable-next-line no-unused-vars */    
  const romanCircleRadius = 46;
  /* eslint-disable-next-line no-unused-vars */    
  const positionCircleRadius = 33; 

  const currentSelectedKey = keysCircleData[activeIndex];

  const getKeyByOffsetIndex = (offsetSlotCount) => {
    return keysCircleData[(activeIndex + offsetSlotCount + 12) % 12];
  };

  const rotateWheelToKey = (item) => {
    const targetBaseAngle = item.angle;
    let currentNormalized = rotationAngle % 360;
    let diff = (-targetBaseAngle - currentNormalized) % 360;
    if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
    const finalAngle = rotationAngle + diff;
    setRotationAngle(finalAngle);
    
    const exactSnappedIndex = (Math.round(-finalAngle / 30) % 12 + 12) % 12;
    setActiveIndex(exactSnappedIndex);
  };

  const getMouseAngle = (clientX, clientY) => {
    if (!mainWrapperRef.current) return 0;
    const rect = mainWrapperRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2; 
    const centerY = rect.top + rect.height / 2;
    let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360; 
    return angle;
  };
  const handleDragStart = (e) => {
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartAngle.current = getMouseAngle(clientX, clientY);
    baseRotationOnDragStart.current = rotationAngle;
    setIsDragging(true);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const currentMouseAngle = getMouseAngle(clientX, clientY);
    let angleDiff = currentMouseAngle - dragStartAngle.current;
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;
    
    const targetAngle = baseRotationOnDragStart.current + angleDiff;
    setRotationAngle(targetAngle);

    const exactSnappedIndex = (Math.round(-targetAngle / 30) % 12 + 12) % 12;
    setActiveIndex(exactSnappedIndex);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const nearest30MultipleAngle = Math.round(rotationAngle / 30) * 30;
    setRotationAngle(nearest30MultipleAngle);
    const finalSnappedIndex = (Math.round(-nearest30MultipleAngle / 30) % 12 + 12) % 12;
    setActiveIndex(finalSnappedIndex);
  };

  return (
    <div style={CIRCLE_STYLE.container} onMouseMove={handleDragMove} onTouchMove={handleDragMove} onMouseUp={handleDragEnd} onTouchEnd={handleDragEnd}>
      
      {/* 5도권 그래픽 인터페이스 휠 기판 */}
      <div style={CIRCLE_STYLE.circleWrapper} ref={mainWrapperRef}>
        
        {/* 마우스/터치 드래그 입력을 직접 수령하여 동적으로 회전하는 회전판 레이어 */}
        <div 
          style={CIRCLE_STYLE.rotatableWheel(rotationAngle, isDragging)} 
          onMouseDown={handleDragStart} 
          onTouchStart={handleDragStart}
        >
          {/* 백그라운드 무지개 그라데이션 Conic 테두리 판넬 링 */}
          <div style={CIRCLE_STYLE.wheelBg} />
          <div style={CIRCLE_STYLE.innerMask} />

          {/* 12방위 화성학 음정 텍스트 노드 매핑 구역 */}
          <div style={CIRCLE_STYLE.textLayerWrapper}>
            {keysCircleData.map((item, idx) => {
              const rad = (item.angle - 90) * (Math.PI / 180);
              
              // 메이저 키(외곽선 원형 링) 컴포넌트 좌표 정밀 연산
              const xMaj = 50 + majorCircleRadius * Math.cos(rad);
              const yMaj = 50 + majorCircleRadius * Math.sin(rad);

              // 마이너스 키(내곽선 원형 링) 컴포넌트 좌표 정밀 연산
              const xMin = 50 + minorCircleRadius * Math.cos(rad);
              const yMin = 50 + minorCircleRadius * Math.sin(rad);

              const isThisActive = idx === activeIndex;

              return (
                <React.Fragment key={idx}>
                  {/* 12개 메이저 키 알파벳 텍스트 배치 */}
                  <button 
                    onClick={() => rotateWheelToKey(item)}
                    style={{ ...CIRCLE_STYLE.nodeSectorBtn, ...CIRCLE_STYLE.btnStyleMaj, left: `${xMaj}%`, top: `${yMaj}%`, transform: 'translate(-50%, -50%)', color: isThisActive ? '#facc15' : '#ffffff' }}
                  >
                    {item.name}
                  </button>

                  {/* 12개 관계 조 마이너 키 알파벳 텍스트 배치 */}
                  <button 
                    onClick={() => rotateWheelToKey(item)}
                    style={{ ...CIRCLE_STYLE.nodeSectorBtn, ...CIRCLE_STYLE.btnStyleMin, left: `${xMin}%`, top: `${yMin}%`, transform: 'translate(-50%, -50%)', color: isThisActive ? '#facc15' : '#cbd5e1' }}
                  >
                    {item.relMin}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
          {/* 정중앙 정적 오버레이 화성학 다이내믹 정보 코어 */}
          <div style={CIRCLE_STYLE.centerCore}>
            <div style={CIRCLE_STYLE.coreCenterContent}>
              <span style={{ fontSize: 'calc(10px + 0.8vmin)', fontWeight: '700', color: '#94a3b8', lineHeight: '1.2' }}>ACTIVE</span>
              <span style={{ fontSize: 'calc(18px + 1.2vmin)', fontWeight: '700', color: '#10b981', lineHeight: '1.1' }}>{currentSelectedKey.name}</span>
              <span style={{ fontSize: 'calc(10px + 0.6vmin)', fontWeight: '600', color: '#a3b8cc', lineHeight: '1.2' }}>{currentSelectedKey.relMin}</span>
            </div>
          </div>

        </div>

        {/* 🗺️ 우측 사이드 바: 하프 포지션 및 스케일 모드 매핑 조견표 테이블 판넬 */}
        <div style={CIRCLE_STYLE.tablePanel}>
          <div style={CIRCLE_STYLE.clickablePanelTitle} onClick={() => setDisplayMode(prev => prev === 'harmonica' ? 'scale' : 'harmonica')}>
            <span style={{ color: '#94a3b8' }}>Mode : </span>
            <span style={CIRCLE_STYLE.dynamicTitleValue(displayMode === 'harmonica')}>
              {displayMode === 'harmonica' ? 'HARMONICA POSITION' : 'SCALE DEGREE'}
            </span>
          </div>

          <table style={CIRCLE_STYLE.table}>
            <thead>
              {displayMode === 'harmonica' ? (
                <tr>
                  <th style={{ ...CIRCLE_STYLE.thTd, ...CIRCLE_STYLE.headerTheme(false) }}>Position</th>
                  <th style={{ ...CIRCLE_STYLE.thTd, ...CIRCLE_STYLE.headerTheme(false) }}>Harp Key</th>
                  <th style={{ ...CIRCLE_STYLE.thTd, ...CIRCLE_STYLE.headerTheme(false) }}>Play Key</th>
                </tr>
              ) : (
                <tr>
                  <th style={{ ...CIRCLE_STYLE.thTd, ...CIRCLE_STYLE.headerTheme(true) }}>Degree</th>
                  <th style={{ ...CIRCLE_STYLE.thTd, ...CIRCLE_STYLE.headerTheme(true) }}>Chord Name</th>
                  <th style={{ ...CIRCLE_STYLE.thTd, ...CIRCLE_STYLE.headerTheme(true) }}>Scale Mode</th>
                </tr>
              )}
            </thead>
            <tbody>
              {displayMode === 'harmonica' ? (
                [
                  { pos: '1st (Straight)', offset: 0 },
                  { pos: '2nd (Cross)', offset: 1 },
                  { pos: '3rd (Slant)', offset: 2 },
                  { pos: '4th (Natural m)', offset: 3 },
                  { pos: '5th (Phrygian)', offset: 4 },
                  { pos: '12th (Lydian)', offset: 11 }
                ].map((row, rIdx) => {
                  const targetKeyItem = getKeyByOffsetIndex(row.offset);
                  return (
                    <tr key={rIdx}>
                      <td style={CIRCLE_STYLE.thTd}>{row.pos}</td>
                      <td style={{ ...CIRCLE_STYLE.thTd, ...CIRCLE_STYLE.bgGray }}>{targetKeyItem.name}</td>
                      <td style={{ ...CIRCLE_STYLE.thTd, color: '#60a5fa', fontWeight: 'bold' }}>{currentSelectedKey.name}</td>
                    </tr>
                  );
                })
              ) : (
                [
                  { deg: 'I',   chord: `${currentSelectedKey.name}Maj7`, mode: 'Ionian (Major)' },
                  { deg: 'IIm',  chord: `${getKeyByOffsetIndex(2).name}m7`,   mode: 'Dorian' },
                  { deg: 'IIIm', chord: `${getKeyByOffsetIndex(4).name}m7`,   mode: 'Phrygian' },
                  { deg: 'IV',  chord: `${getKeyByOffsetIndex(11).name}Maj7`, mode: 'Lydian' },
                  { deg: 'V7',  chord: `${getKeyByOffsetIndex(1).name}7`,    mode: 'Mixolydian' },
                  { deg: 'VIm',  chord: `${currentSelectedKey.relMin}7`,      mode: 'Aeolian (Minor)' }
                ].map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td style={CIRCLE_STYLE.thTd}>{row.deg}</td>
                    <td style={{ ...CIRCLE_STYLE.thTd, ...CIRCLE_STYLE.bgGray }}>{row.chord}</td>
                    <td style={{ ...CIRCLE_STYLE.thTd, color: '#10b981', fontWeight: 'bold' }}>{row.mode}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* 🏠 5도권 룸 내부 탈출구 홈 복귀 버튼 단추 */}
          <button 
            onClick={onRouteClick}
            style={{ width: '100%', height: '52px', marginTop: '20px', borderRadius: '14px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f87171', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            🚪 EXIT TO PORTAL HUB
          </button>
        </div>
      </div>
      );
}
// =========================================================================
// 🎯 [교정 완결] 그래픽 요소 완전 배제형 텍스트 중심 3대 파트 마스터 사용 설명서
// =========================================================================
function AppGuidePage({ onRouteClick }) {
  const gStyle = {
    wrapper: { width: '100vw', minHeight: '100vh', backgroundColor: '#050a14', color: '#cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box', fontFamily: '"Noto Sans KR", sans-serif', padding: '4vh 4vw', overflowY: 'auto' },
    content: { width: '100%', maxWidth: '800px', backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '28px', padding: '45px', boxSizing: 'border-box', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '20px', marginBottom: '35px' },
    mainTitle: { fontSize: '26px', fontWeight: '700', color: '#10b981', margin: 0 },
    backBtn: { backgroundColor: '#1f2937', color: '#f87171', border: '1px solid #ef4444', borderRadius: '12px', padding: '10px 18px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' },
    sectionBox: { width: '100%', marginBottom: '40px', borderBottom: '1px solid #1e293b', paddingBottom: '35px' },
    secTitle: { fontSize: '20px', fontWeight: '700', color: '#60a5fa', marginBottom: '16px', borderLeft: '4px solid #2563eb', paddingLeft: '12px' },
    subGroup: { marginBottom: '18px', paddingLeft: '4px' },
    subTitle: { fontSize: '15px', fontWeight: '700', color: '#f8fafc', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' },
    text: { fontSize: '14px', color: '#94a3b8', lineHeight: '1.8', margin: '0 0 6px 0' },
    boldText: { color: '#ffffff', fontWeight: '600' }
  };

  return (
    <div style={gStyle.wrapper}>
      <div style={gStyle.content}>
        <div style={gStyle.header}>
          <h2 style={gStyle.mainTitle}>📖 하모니카 트레이닝 센터 소개</h2>
          <button onClick={onRouteClick} style={gStyle.backBtn} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}>
          🚪 나가기 EXIT
          </button>
        </div>
        {/* 🗺️ 1파트: 기본 화면 편 명세 */}
        <div style={gStyle.rowCard}>
          <div>
            <h3 style={gStyle.secTitle}> 하모니카 마스터 트레이닝 센터 </h3>
                <div style={gStyle.subTitle}>• 하나의 앱으로 다이아토닉 하모니카와 크로매틱 하모니카 트레이닝이 가능 </div>
                <div style={gStyle.subTitle}>• 다양한 키의 하모니카를 지원하며, 로우키와 하이키 모두 설정해 사용 가능 </div>
                <div style={gStyle.subTitle}>• 다이아토닉 하모니카와 크로매틱 하모니카의 다양한 튜닝모드 설정 가능 </div>
                <div style={gStyle.subTitle}>• 다양한 스케일 모드를 지원하며 스케일 노트를 학습하며 트레이닝 가능 </div>
                <div style={gStyle.subTitle}>• 내장 미디음원을 통해 음정 사각형을 눌러 선택한 음정의 청음이 가능 </div>
            <h3 style={gStyle.secTitle}> 리얼타임 정밀 듀얼 튜닝 센서 </h3>
                <div style={gStyle.subTitle}>• 정밀한 인티케이터 튜너 센서를 사용해 음정 연습 트레이닝에 최적화 </div>
                <div style={gStyle.subTitle}>• 컬러를 통해 음정의 정밀도를 시각적으로 인지가 가능한 트레이닝을 지원 </div>
                <div style={gStyle.subTitle}>• 튜너의 정확도를 위해 표준음정 설정 "A4 =  Hz" 기능 설정 가능 </div>
                <div style={gStyle.subTitle}>• 음정 허용 수치의 폭을 단계별로 지정하여 단계별 트레이닝이 가능 </div>
                <div style={gStyle.subTitle}>• 마이크의 민감도를 조정해 불필요한 수음을 조정 가능 </div>
            <h3 style={gStyle.secTitle}> 배킹트랙과 하모니카 연주 실시간 믹스 녹음기능 </h3>
                <div style={gStyle.subTitle}>• 배킹트랙을 선택해 재생 속도 조절이 가능하고 키 배킹트랙의 키 조정이 가능 </div>
                <div style={gStyle.subTitle}>• 배킹트랙과 마이크의 녹음 음량 크기 설정이 가능 </div>
                <div style={gStyle.subTitle}>• 배킹트랙을 플레이 하면서 하모니카 연주를 믹스해 녹음하는 기능 </div>
                <div style={gStyle.subTitle}>• 녹음한 파일을 바로 확인해 들어 볼 수 있으며, 저장 및 배포 가능 </div>
                <div style={gStyle.subTitle}>• 다양한 스케일 모드를 지원하며 스케일 노트를 학습하며 트레이닝 가능 </div>
            <h3 style={gStyle.secTitle}> Help & Tutorial </h3>
                <div style={gStyle.subTitle}> https://sites.google.com/view/allofharp</div>
            <h3 style={gStyle.secTitle}> Contact </h3>
                <div style={gStyle.subTitle}> 279.lee@gmail.com </div>
             </div>
        </div>  
        
        {/* 🔒 순정 하단 저작권 텍스트 및 정갈한 가로 1줄 마감선 */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '20px', marginTop: '10px', width: '100%' }}>
          <div style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>
            Diatonic & Chromatic Harmonica Training Center Manual • Ver 1.0.0
          </div>
        </div>

      </div>
    </div>
  );
}
