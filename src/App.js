import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Play, Pause, Mic, Settings, Home } from 'lucide-react';
import BackingTrackPlayer from './BackingTrackPlayer';

// (기존 다이아토닉 5도권 keysCircleData 및 romanDegrees, fixedPositionLabels 구조는 통합 유지)
const keysCircleData = [
  { idx: 0, major: "C",  minor: "Am",  roman: "I",   pos: "1st", angle: 0,   sharpFlat: "⚠️ Natural", type: "natural", displaySig: "♮" },
  { idx: 1, major: "G",  minor: "Em",  roman: "V",   pos: "2nd", angle: 30,  sharpFlat: "1 ♯", type: "sharp", displaySig: "1♯" },
  { idx: 2, major: "D",  minor: "Bm",  roman: "II",  pos: "3rd", angle: 60,  sharpFlat: "2 ♯", type: "sharp", displaySig: "2♯" },
  { idx: 3, major: "A",  minor: "F♯m", roman: "VI",  pos: "4th", angle: 90,  sharpFlat: "3 ♯", type: "sharp", displaySig: "3♯" },
  { idx: 4, major: "E",  minor: "C♯m", roman: "III", pos: "5th", angle: 120, sharpFlat: "4 ♯", type: "sharp", displaySig: "4♯" },
  { idx: 5, major: "B",  minor: "G♯m", roman: "VII", pos: "6th", angle: 150, sharpFlat: "5 ♯", type: "sharp", displaySig: "5♯" },
  { idx: 6, major: "G♭", minor: "E♭m", roman: "IV",  pos: "7th", angle: 180, sharpFlat: "6 ♭ / 6 ♯", type: "flat", displaySig: "6♭" },
  { idx: 7, major: "D♭", minor: "Bbm",  roman: "I♭",  angle: 210, sharpFlat: "5 ♭", type: "flat", displaySig: "5♭" }, 
  { idx: 8, major: "A♭", minor: "Fm",  roman: "V♭",  pos: "9th", angle: 240, sharpFlat: "4 ♭", type: "flat", displaySig: "4♭" },
  { idx: 9, major: "E♭", minor: "Cm",  roman: "II♭", pos: "10th", angle: 270, sharpFlat: "3 ♭", type: "flat", displaySig: "3♭" },
  { idx: 10, major: "B♭", minor: "Gm",  roman: "VI♭", pos: "11th", angle: 300, sharpFlat: "2 ♭", type: "flat", displaySig: "2♭" },
  { idx: 11, major: "F",  minor: "Dm",  roman: "III♭", pos: "12th", angle: 330, sharpFlat: "1 ♭", type: "flat", displaySig: "1♭" }
];
const romanDegrees = [
  { text: "I", angle: 0 }, { text: "V", angle: 30 }, { text: "IIm", angle: 60 },
  { text: "VIm", angle: 90 }, { text: "IIIm", angle: 120 }, { text: "VIIdim", angle: 150 },
  { text: "IV", angle: 330 }
];
const fixedPositionLabels = [
  { text: "1st", harmonicaAngle: 0, songAngle: 0 },
  { text: "2nd", harmonicaAngle: 30, songAngle: -30 },
  { text: "12th", harmonicaAngle: -30, songAngle: 30 },
  { text: "3rd", harmonicaAngle: 60, songAngle: -60 },
  { text: "4th", harmonicaAngle: 90, songAngle: -90 },
  { text: "5th", harmonicaAngle: 120, songAngle: -120 }
];

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


// C키(0) 기준 C#, D, D#는 높은 음역대 키로 연산(+1, +2, +3), 나머지는 낮은 음역대로 하향 조율(-1 ~ -8)
const TREMOLO_KEYS = {
  'E': -8, 'F': -7, 'F#': -6, 'G': -5, 'G#': -4, 'A': -3, 'A#': -2, 'B': -1,
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3
};

// =========================================================================
// 🎯 [교정 완결] 트레몰로 베이스 C키 오프셋 매트릭스 (정규식 이스케이프 문법 세척)
// =========================================================================
const TREMOLO_BASE_C_KEY = "-5,2,0,5,4,9,7,11,12,14,16,17,19,21,24,23,28,26,31,29,36,33,40,35".split(",").map(n => parseInt(n, 10));

// =========================================================================
// 🎯 [글로벌 UI 고도화] 마우스 드래그, 텍스트 블록 지정, 롱클릭 전면 차단 고정 가드
// =========================================================================
const GLOBAL_NO_SELECT_STYLE = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  MozUserSelect: 'none',
  msUserSelect: 'none',
  WebkitTouchCallout: 'none',
  cursor: 'default'
};
// =========================================================================
// 🎯 [교정 완결] C4 ~ B4 대역(9~14, 16번 홀) 점 소각형 절대 옥타브 추적 도트 엔진
// =========================================================================
function calculateAbsoluteOctaveDots(noteName) {
  if (!noteName) return { position: 'none', count: 0 };

  const match = noteName.match(/\d+/);
  if (!match) return { position: 'none', count: 0 };
  const octave = parseInt(match, 10);

  // 🎯 [연주자님 지침 완벽 수렴]: 9~14, 16번 홀에 속하는 C4 ~ B4 대역을 무조건 0점(기준점)으로 셋팅!
  // 이렇게 하면 4옥타브 음정 상자에는 점이 완벽히 한 개도 나타나지 않고 소각됩니다.
  const BASE_OCTAVE = 5;
  const difference = octave - BASE_OCTAVE;

  // 🅰️ 기준 음역대(4)보다 낮은 대역 -> 음이름 아래쪽에 흰색 점 표시
  if (difference < 0) {
    const absDiff = Math.abs(difference);
    if (absDiff === 1) return { position: 'bottom', count: 1 }; // 한 옥타브 낮음 (예: C3) -> 아래 점 1개
    if (absDiff >= 2) return { position: 'bottom', count: 2 };  // 두 옥타브 이하 낮음 (예: B2) -> 아래 점 2개
  }
  // 🅱️ 기준 음역대(4)보다 높은 대역 -> 음이름 위쪽에 흰색 점 표시
  else if (difference > 0) {
    if (difference === 1) return { position: 'top', count: 1 }; // 한 옥타브 높음 (예: C5) -> 위 점 1개
    if (difference >= 2) return { position: 'top', count: 2 };  // 두 옥타브 이상 높음 (예: B6) -> 위 점 2개
  }

  // 💡 4옥타브(C4 ~ B4) 대역은 기준 음역대이므로 지시하신 대로 점을 철저히 배제하고 리턴합니다.
  return { position: 'none', count: 0 };
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
          <span style={hubStyle.cardTitle}>Circle of Fifths</span>
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
// 🎯 [교정 완결] 화면 폭 수축 시 옥타브 도트 수직 겹침 간섭을 완벽 차단한 NoteBox 엔진
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
    else if (isBlowZone) {
      if (holeNum >= 1 && holeNum <= 6 && !isTremoloMode) { bgColor = '#ef4444'; }
      else if ((selectedTuning === 'Natural Minor' || selectedTuning === 'Harmonic' || selectedTuning === 'Harmonic Minor') && holeNum === 7) { bgColor = '#93c5fd'; } 
      else if (holeNum >= 8 && holeNum <= 10) { bgColor = '#93c5fd'; } 
      else { bgColor = '#1e293b'; }
    } 
    else if (isDrawZone) {
      if (holeNum >= 1 && holeNum <= 6 && !isTremoloMode) { bgColor = '#38bdf8'; }
      else if (holeNum >= 7 && holeNum <= 10) { bgColor = '#f59e0b'; } 
      else { bgColor = '#1e293b'; }
    }
  }

  const isScaleComponent = scaleNotesResult && scaleNotesResult.includes(noteName.replace(/\d+/g, ''));
  let textColor = 'white';
  if (useScaleHighlight && !isActive && isScaleComponent) { textColor = '#facc15'; }

  // 실시간 절대 노트 주파수 기반 자동 도트 연산 바인딩
  const dotsInfo = isTremoloMode ? calculateAbsoluteOctaveDots(noteName) : { position: 'none', count: 0 };

  // 🎯 [완치 완결]: 글자와의 절대 거리 안전 마진을 강제 확보하는 스택형 도트 생성 링커
  const renderOctaveDots = () => {
    if (dotsInfo.position === 'none' || dotsInfo.count === 0) return null;
    
    // 💡 top인 경우 박스 천장에, bottom인 경우 박스 바닥에 수직으로 일정한 비율 여백 보존
    const verticalAlignStyle = dotsInfo.position === 'top' ? { top: '3px' } : { bottom: '3px' };
    
    return (
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        ...verticalAlignStyle,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '4px', 
        height: '8px',
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
    <div 
      style={{ 
        width: '100%', 
        height: '100%', 
        margin: '2px 0', 
        borderRadius: '12px', 
        border: borderStyle, 
        backgroundColor: bgColor, 
        display: 'flex', 
        flexDirection: 'column', // 👈 [완치 완결]: 폰트와 점을 세로 정렬 구조로 격리하여 물리 겹침을 원천 차단
        alignItems: 'center', 
        justifyContent: 'center', 
        position: 'relative', 
        overflow: 'visible', 
        cursor: 'pointer', 
        padding: '2px 0', // 수직 완충 마진 주입
        boxSizing: 'border-box',
        ...GLOBAL_NO_SELECT_STYLE 
      }} 
      onMouseDown={() => onStart(noteName)} 
      onMouseUp={onStop} 
      onMouseLeave={onStop} 
      onTouchStart={() => onStart(noteName)} 
      onTouchEnd={onStop}
    >
      {renderOctaveDots()} 
      
      {isTremoloMode ? (
        <svg viewBox="-50 0 200 42" preserveAspectRatio="xMidYMid meet" style={{ width: '160%', height: '80%', overflow: 'visible', pointerEvents: 'none', ...GLOBAL_NO_SELECT_STYLE, marginTop: dotsInfo.position === 'top' ? '4px' : '0px', marginBottom: dotsInfo.position === 'bottom' ? '4px' : '0px' }}>
          <text 
          x="50"
          y="24"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontWeight: '650',
            fill: textColor,
            zIndex: 10,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textShadow: '0 2px 4px rgba(0,0,0,0.95)',
            fontSize: isSliderZone 
            ? (displayLabel.length >= 2 ? '50px' : '52px')  // 트레몰로 1번줄 폰트 크기
            : (displayLabel.length >= 2 ? '52px' : '54px'), // 트레몰로 2번줄 폰트 크기
            ...GLOBAL_NO_SELECT_STYLE }}>{displayLabel}</text>
        </svg>
      ) : (
        <span style={{ fontWeight: '600', fontSize: '24px', color: textColor, zIndex: 10, pointerEvents: 'none', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,0.8)', ...GLOBAL_NO_SELECT_STYLE }}>{displayLabel}</span>
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
  // 🎯 [완치 완결] 한글/도수 모드 1행 계명 실종 박멸 및 온전한 샵(#) 표출 엔진
  // =========================================================================
  const getTremoloDisplayLabel = (noteName, isTopRow) => {
    if (!noteName) return "";
    
    // 1. 숫자를 제외한 순수 영문 계명 정밀 추출 및 노이즈 기호 전면 청소
    let pureLabel = noteName.replace(/\d+/g, '')
      .replace(/[\u0300-\u036f\u0307\u0308\u0323\u0324]/g, '')
      .normalize('NFC')
      .trim();

    // 🎯 [요청사양 반영] 플랫(b) 기호가 매립된 임시 기호표 음들은 보기 좋은 샵(#) 기호로 완벽하게 선행 일제 변환
    if (pureLabel === "Db") pureLabel = "C#";
    if (pureLabel === "Eb") pureLabel = "D#";
    if (pureLabel === "Gb") pureLabel = "F#";
    if (pureLabel === "Ab") pureLabel = "G#";
    if (pureLabel === "Bb") pureLabel = "A#";

    // 2. 셋팅 메뉴 옵션(tDisplayLabelType)에 따른 최종 다국적 음이름 치환 연산 기동
    if (tDisplayLabelType === 'KOR') {
      // 💡 [한글 모드]: 글자를 절대 자르지 않고 "솔#", "레#", "도#", "파#" 형태로 완벽하게 전부 반환합니다!
      const tremoloKoreanMap = {
        "C": "도", "C#": "도#", "D": "레", "D#": "레#", "E": "미", "F": "파", "F#": "파#",
        "G": "솔", "G#": "솔#", "A": "라", "A#": "라#", "B": "시"
      };
      return tremoloKoreanMap[pureLabel] || pureLabel;
    } 
    else if (tDisplayLabelType === 'DEG') {
      // 💡 [도수 모드]: 글자를 절대 자르지 않고 "1#", "2#", "4#", "5#" 형태로 완벽하게 전부 반환합니다!
      const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      const matchedIndex = names.indexOf(pureLabel);
      if (matchedIndex !== -1) {
        return getDegreeLabel(matchedIndex, tScaleRootKey);
      }
    }

    // 기본 스탠다드 영문 모드(ENG): 지우거나 가위질하지 않고 원래 계명 그대로 "C#", "D#", "F#", "G#" 온전히 출력
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
  // 🔄 [트레몰로 가변 전조 반영] 절대 계명 계산 및 주파수 변환 마스터 함수 개편
  // =========================================================================
  const getNoteName = (semi) => {
    if (semi === null) return null;
    const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    
    // 트레몰로 모드일 때는 신설된 TREMOLO_KEYS 오프셋을 기반으로 동적 피치 연산 수행
    if (isTremolo) {
      const keyOffset = TREMOLO_KEYS[tCurrentKey] || 0;
      const absoluteSemi = semi + keyOffset + (4 * 12); // C4 기본 기준점 안착
      return names[((absoluteSemi % 12) + 12) % 12] + Math.floor(absoluteSemi / 12);
    }
    
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

            <span style={{ fontSize: '18px', fontWeight: '900', color: '#94a3b8', whiteSpace: 'nowrap' }}>
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
              Circle of Fifths
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
            maxWidth: '1000px',             // 🎯 상단 메뉴바의 최대 폭과 칼같이 일치시켜 정렬선 합치기
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
                      <div style={{ 
                        width: '650px', 
                        display: 'flex', 
                        flexDirection: 'row', 
                        flexWrap: 'nowrap', 
                        alignItems: 'center', 
                        justifyContent: 'flex-start', 
                        gap: '14px', 
                        position: 'absolute', 
                        // 🎯 [완치 완결 코어 패치]: 화면이 아무리 커지더라도 절대 도화지 바깥으로 탈출하지 못하도록 상하 폭 최대 고정 마진 분기 수식을 정비했습니다.
                        // 소형 화면에서는 calc(-29.6vw - 50px)로 부드럽게 연동하고, 대형 모니터에서는 상한선인 -255px 자리에 자석처럼 찰칵 고정되어 증발 현상을 영구 차단합니다!
                        top: 'max(-255px, calc(-29.6vw - 42px))', 
                        left: '0px', 
                        zIndex: 300, 
                        backgroundColor: 'transparent', 
                        backdropFilter: 'none', 
                        border: 'none', 
                        padding: 0, 
                        boxSizing: 'border-box', 
                        pointerEvents: 'none', 
                        boxShadow: 'none', 
                        overflow: 'hidden' 
                      }}>
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
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1vh', boxSizing: 'border-box', ...GLOBAL_NO_SELECT_STYLE }}>
            
            {/* [투명 텍스트 가이드 행] 실시간 스케일 종류 및 가로 한 줄 온음계 흐름 */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', padding: '4px 0', backgroundColor: 'transparent', border: 'none', boxSizing: 'border-box', marginBottom: '0.5vh', overflow: 'hidden', pointerEvents: 'none', ...GLOBAL_NO_SELECT_STYLE }}>
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '18px', fontWeight: '600', color: '#c084fc', letterSpacing: '-0.3px', whiteSpace: 'nowrap', textShadow: '0 2px 5px rgba(0,0,0,1)', fontFamily: 'inherit', ...GLOBAL_NO_SELECT_STYLE }}>
                  {tScaleRootKey} {selectedScale}
                </span>
                <span style={{ fontSize: '16px', color: '#475569', fontWeight: '600', letterSpacing: '0.5px', whiteSpace: 'nowrap', fontFamily: 'inherit', ...GLOBAL_NO_SELECT_STYLE }}>
                  SCALE NOTES
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '14px', flex: 1, overflowX: 'hidden' }}>
                {scaleNotesResult.map((note, idx) => (
                  <span key={idx} style={{ fontSize: '20px', fontWeight: '600', color: idx === 0 || idx === scaleNotesResult.length - 1 ? '#c084fc' : '#cbd5e1', textShadow: '0 2px 5px rgba(0,0,0,1)', userSelect: 'none', whiteSpace: 'nowrap', letterSpacing: '-0.5px', flexShrink: 0, fontFamily: 'inherit', ...GLOBAL_NO_SELECT_STYLE }}>
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
              gap: '4px',   // 트레몰로 음정사각형 좌우 간격
              width: '100%', 
              boxSizing: 'border-box',
              marginTop: '0px',
              overflow: 'hidden',
              ...GLOBAL_NO_SELECT_STYLE
            }}>
              {Array.from({ length: 24 }).map((_, i) => {
                const h = i + 1;
                const baseSemi = TREMOLO_BASE_C_KEY[i];
                const topRowSemi = getTremoloTopRowSemi(baseSemi);

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: '1 1 0%', minWidth: '0px', boxSizing: 'border-box', ...GLOBAL_NO_SELECT_STYLE }}>
                    
                    {/* 🎯 행 1: [첫번째줄 부하 하프 상단 레이어] - 내장형 절대 옥타브 도트 가드 자동 제어 */}
                    <div style={{ width: '100%', height: '3.6vw', minHeight: '30px', maxHeight: '65px', flexShrink: 0, marginBottom: '6px', position: 'relative', display: showCMinusSharp ? 'block' : 'none', ...GLOBAL_NO_SELECT_STYLE }}>
                      <NoteBox semi={topRowSemi} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight} isSliderZone={true} isTremoloMode={true} tremoloLabelFn={(note) => getTremoloDisplayLabel(note, true)}/>
                    </div>

                    {/* 🎯 행 2: [두번째줄 온음 C키 하단 레이어] - 내장형 절대 옥타브 도트 가드 자동 제어 */}
                    <div style={{ width: '100%', height: '3.6vw', minHeight: '30px', maxHeight: '65px', flexShrink: 0, marginBottom: '6px', position: 'relative', ...GLOBAL_NO_SELECT_STYLE }}>
                      <NoteBox semi={baseSemi} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} scaleNotesResult={scaleNotesResult} useScaleHighlight={useScaleHighlight} isTremoloMode={true} tremoloLabelFn={(note) => getTremoloDisplayLabel(note, false)}/>
                    </div>
                    
                    {/* 🎯 행 3: [중앙 순수 가이드 홀 번호 행] - 홀 번호 자형까지 마우스 드래그지정 원천 불허 */}
                    <div style={{ width: '95%', height: '32px', border: '1px solid #475569', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', margin: '0', flexShrink: 0, fontFamily: 'inherit', ...GLOBAL_NO_SELECT_STYLE }}>
                      <span style={{ fontWeight: '700', fontSize: 'calc(9px + 0.3vw)', minFontSize: '11px', color: '#94a3b8', ...GLOBAL_NO_SELECT_STYLE }}>
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
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', pointerEvents: 'none', zIndex: 10, fontFamily: 'inherit', lineHeight: '1.3', marginTop: '1.5vh', ...GLOBAL_NO_SELECT_STYLE }}>
            <div style={{ fontSize: 'calc(10px + 0.4vw)', minFontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '2px', ...GLOBAL_NO_SELECT_STYLE }}>
              [ MODE : TREMOLO STANDARD | TUNING : {selectedTuning === 'Minor' ? 'MINOR' : 'MAJOR'} | LABEL : {tDisplayLabelType} | C-SHARP LAYER : {showCMinusSharp ? 'VISIBLE' : 'HIDDEN'} ]
            </div>
            <div style={{ fontSize: 'calc(13px + 1.2vw)', minFontSize: '16px', fontWeight: '600', color: '#10b981', marginBottom: '6px', letterSpacing: '-0.5px', whiteSpace: 'nowrap', ...GLOBAL_NO_SELECT_STYLE }}>
              Tremolo Harmonica Training Center
            </div>
            <div style={{ color: '#475569', fontSize: 'calc(8px + 0.4vw)', minFontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap', ...GLOBAL_NO_SELECT_STYLE }}>
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
                      { val: 'Standard', label: 'Major (메이저 # 하모니카 보이기)' },
                      { val: 'Minor', label: 'Minor (마이너 하모니카 보이기)' }
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
                    <option value="ON" style={{ color: '#c084fc', fontWeight: 'bold' }}> # Key / monor Key Layer VISIBLE (윗줄 샵키 / 마이너키 표시) </option>
                    <option value="OFF" style={{ color: '#ffffff', fontWeight: 'bold' }}> # Key / monor Key Layer HIDDEN (윗줄 샵키 / 마이너키 숨기기) </option>
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
                    <option value="ENG" style={{ color: '#ffffff', fontWeight: 'bold' }}> English Label Mode (영문 표기 : C, D, E...) </option>
                    <option value="KOR" style={{ color: '#60a5fa', fontWeight: 'bold' }}> Korean Label Mode (한글 표기 : 도, 레, 미...) </option>
                    <option value="DEG" style={{ color: '#facc15', fontWeight: 'bold' }}> Degree Scale Mode (도수 표기 : 1, 2, 3...) </option>
                  </select>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold', marginTop: '4px', display: 'block' }}>
                    * 도수 선택 시, C 하모니카 기준 9번 홀(C5)을 기점으로 순수 숫자 1~7이 연산 정렬됩니다.
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
// 🎯 [15단계] 5도권 서클 트레이닝 룸 (NewFeaturePage) 핵심 알고리즘 제어 구역
// =========================================================================
function NewFeaturePage({ onRouteClick }) {
  const [rotationAngle, setRotationAngle] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayMode, setDisplayMode] = useState('harmonica'); 
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const mainWrapperRef = useRef(null);
  const dragStartAngle = useRef(0);
  const baseRotationOnDragStart = useRef(0);

  // 💡 휠 크기 대비 각 요소가 배치되어야 할 화성학적 % 위치 비율
  const majorCircleRadius = 40;    
  const minorCircleRadius = 27;    
  const staffCircleRadius = 54;    
  const romanCircleRadius = 46;    
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

  const onDragStart = (e) => {
    if (e.target.tagName === 'BUTTON') return;
    
    const isTouch = e.type.startsWith('touch');
    const clientX = isTouch ? (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX) : e.clientX;
    const clientY = isTouch ? (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY) : e.clientY;
    
    setIsDragging(true);
    dragStartAngle.current = getMouseAngle(clientX, clientY);
    baseRotationOnDragStart.current = rotationAngle;
  };
  useEffect(() => {
    const onDragMove = (e) => {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault(); 

      const isTouch = e.type.startsWith('touch');
      const touchObj = isTouch ? (e.touches && e.touches[0] ? e.touches[0] : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : null)) : null;
      
      const clientX = isTouch ? (touchObj ? touchObj.clientX : e.clientX) : e.clientX;
      const clientY = isTouch ? (touchObj ? touchObj.clientY : e.clientY) : e.clientY;
      
      let angleDifference = getMouseAngle(clientX, clientY) - dragStartAngle.current;
      if (angleDifference > 180) angleDifference -= 360; if (angleDifference < -180) angleDifference += 360;
      const nextAngle = baseRotationOnDragStart.current + angleDifference;
      setRotationAngle(nextAngle);
      
      const currentSnappedIndex = (Math.round(-nextAngle / 30) % 12 + 12) % 12;
      setActiveIndex(currentSnappedIndex);
    };

    const onDragEnd = () => {
      if (!isDragging) return; 
      setIsDragging(false);
      const targetSnapAngle = Math.round(rotationAngle / 30) * 30;
      setRotationAngle(targetSnapAngle);
      
      const finalCalculatedIndex = (Math.round(-targetSnapAngle / 30) % 12 + 12) % 12;
      setActiveIndex(finalCalculatedIndex);
    };

    if (isDragging) {
      window.addEventListener('mousemove', onDragMove); 
      window.addEventListener('mouseup', onDragEnd);
      window.addEventListener('touchmove', onDragMove, { passive: false }); 
      window.addEventListener('touchend', onDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onDragMove); 
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchmove', onDragMove); 
      window.removeEventListener('touchend', onDragEnd);
    };
  }, [isDragging, rotationAngle]);

  const toggleDisplayMode = () => setDisplayMode(prev => (prev === 'harmonica' ? 'song' : 'harmonica'));

  return (
    <div style={CIRCLE_STYLE.container}>
      {/* 🎯 [정밀 패치] 창 닫기 버튼을 휠 왼쪽 안전 여백 구역으로 고정 이동하여 겹침 간섭 현상 원천 배제 */}
      <div style={{ position: 'absolute', top: '4vh', left: '4vw', zIndex: 5000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button onClick={onRouteClick} style={{ ...BOX_STYLE.settingsBtn, padding: '12px 20px', fontSize: 'calc(11px + 0.4vmin)', fontWeight: 'bold', backgroundColor: '#1f2937', borderColor: '#3e3e3e', color: '#fbff00', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}>
          Home
        </button>
      </div>

      <div ref={mainWrapperRef} style={CIRCLE_STYLE.circleWrapper} onMouseDown={onDragStart} onTouchStart={onDragStart}>
        <div style={CIRCLE_STYLE.rotatableWheel(rotationAngle, isDragging)}>
          <div style={CIRCLE_STYLE.wheelBg}></div>
          <div style={CIRCLE_STYLE.innerMask}></div>
          
          <div style={CIRCLE_STYLE.textLayerWrapper}>
            {keysCircleData.map((item) => {
              const rad = ((item.angle - 90) * Math.PI) / 180;
              const cos = Math.cos(rad); 
              const sin = Math.sin(rad);
              const isTopActiveSlot = item.idx === activeIndex;
              const displayMajorLabel = (displayMode === 'song' && isTopActiveSlot) ? `${item.major} Maj / ${item.major}m` : item.major;
              const isMinorHidden = (displayMode === 'song' && isTopActiveSlot);

              return (
                <React.Fragment key={item.idx}>
                  <button style={{ ...CIRCLE_STYLE.nodeSectorBtn, ...CIRCLE_STYLE.btnStyleMaj, width: (displayMode === 'song' && isTopActiveSlot) ? '250px' : '70px', borderRadius: (displayMode === 'song' && isTopActiveSlot) ? '20px' : '50%', left: `calc(50% + ${majorCircleRadius * cos}%)`, top: `calc(50% + ${majorCircleRadius * sin}%)`, transform: `translate(-50%, -50%) rotate(${-rotationAngle}deg)`, whiteSpace: 'nowrap', zIndex: isTopActiveSlot ? 50 : 12 }} onMouseEnter={() => setHoveredIdx(item.idx)} onMouseLeave={() => setHoveredIdx(null)} onClick={(e) => { e.stopPropagation(); rotateWheelToKey(item); }}>
                    {displayMajorLabel}
                  </button>
                  <button style={{ ...CIRCLE_STYLE.nodeSectorBtn, ...CIRCLE_STYLE.btnStyleMin, left: `calc(50% + ${minorCircleRadius * cos}%)`, top: `calc(50% + ${minorCircleRadius * sin}%)`, transform: `translate(-50%, -50%) rotate(${-rotationAngle}deg)`, display: isMinorHidden ? 'none' : 'flex' }} onMouseEnter={() => setHoveredIdx(item.idx)} onMouseLeave={() => setHoveredIdx(null)} onClick={(e) => { e.stopPropagation(); rotateWheelToKey(item); }}>
                    {item.minor}
                  </button>
                  <div style={{ ...CIRCLE_STYLE.signatureTextBadge(hoveredIdx === item.idx ? 1 : 0, item.type === 'sharp', item.type === 'flat'), left: `calc(50% + ${staffCircleRadius * cos}%)`, top: `calc(50% + ${staffCircleRadius * sin}%)`, transform: `translate(-50%, -50%) rotate(${-rotationAngle}deg)` }}>
                    {item.displaySig}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
        {/* 크기가 줄어들어도 작은 원(Center Core)이 화면 정중앙에 완벽한 대칭을 유지 */}
        <div style={{ ...CIRCLE_STYLE.centerCore, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
          <div style={CIRCLE_STYLE.coreCenterContent}>
            <span style={{ fontSize: 'calc(16px + 0.5vmin)', fontWeight: 'bold', marginBottom: '2px', color: displayMode === 'harmonica' ? '#ef4444' : '#00a8ff', whiteSpace: 'nowrap' }}>
              {displayMode === 'harmonica' ? 'Harp Key' : 'Song Key'}
            </span>
            <span style={{ fontWeight: '600', fontSize: 'calc(16px + 1.6vmin)', color: '#3b82f6', whiteSpace: 'nowrap', lineHeight: '1.15', display: 'block', textAlign: 'center' }}>
              {displayMode === 'harmonica' ? (
                currentSelectedKey.major
              ) : (
                <>
                  {currentSelectedKey.major} Maj
                  <br />
                  {currentSelectedKey.major}m
                </>
              )}
            </span>
          </div>

          {/* 🎯 [잘림 현상 완치] 카피라이트 텍스트가 바깥 원 테두리에 가려 끊기지 않도록 가이드 패스 및 viewBox 완벽 확장 */}
          <svg style={CIRCLE_STYLE.staticCurvedSvgOverlay} viewBox="0 0 184 184">
            <defs>
              <path id="core-top-path" d="M 22,92 A 70,70 0 1,1 162,92" />
              <path id="core-bottom-path" d="M 12,92 A 80,80 0 0,0 172,92" /> 
            </defs>
            <text fontSize="16px" fontWeight="900" fill="#f59e0b" fontFamily="system-ui, -apple-system, sans-serif">
              <textPath href="#core-top-path" startOffset="50%" textAnchor="middle">The Circle of Fifths</textPath>
            </text>
            <text fontSize="10.5px" fontWeight="bold" fill="#94a3b8" letterSpacing="-0.2px" fontFamily="system-ui, -apple-system, sans-serif">
              <textPath href="#core-bottom-path" startOffset="50%" textAnchor="middle">Copyright©2026 Coffeebada All Rights Reserved</textPath>
            </text>
          </svg>
        </div>

        <div style={CIRCLE_STYLE.staticOverlayLayer}>
          {romanDegrees.map((degree, dIdx) => (
            <div key={dIdx} style={{ ...CIRCLE_STYLE.romanDegreeBadge, left: `calc(50% + ${romanCircleRadius * Math.cos((degree.angle - 90) * Math.PI / 180)}%)`, top: `calc(50% + ${romanCircleRadius * Math.sin((degree.angle - 90) * Math.PI / 180)}%)`, transform: 'translate(-50%, -50%)', filter: 'drop-shadow(0px 3px 3px rgba(0, 0, 0, 0.85))', willChange: 'transform' }}>
              {degree.text}
            </div>
          ))}
          {fixedPositionLabels.map((pos, pIdx) => {
            const targetAngle = displayMode === 'harmonica' ? pos.harmonicaAngle : pos.songAngle;
            return (
              <div key={pIdx} style={{ ...CIRCLE_STYLE.staticFixedPositionBadge, left: `calc(50% + ${positionCircleRadius * Math.cos((targetAngle - 90) * Math.PI / 180)}%)`, top: `calc(50% + ${positionCircleRadius * Math.sin((targetAngle - 90) * Math.PI / 180)}%)`, transform: 'translate(-50%, -50%)' }}>
                {pos.text}
              </div>
            );
          })}
        </div>
      </div>

      <div style={CIRCLE_STYLE.tablePanel}>
        <div style={CIRCLE_STYLE.clickablePanelTitle} onClick={toggleDisplayMode}>
          <span style={{ fontWeight: '900', color: '#ffffff' }}>{displayMode === 'harmonica' ? 'Harmonica Key' : 'Song Key'}</span>
          <span style={CIRCLE_STYLE.dynamicTitleValue(displayMode === 'harmonica')}>
            {displayMode === 'harmonica' ? currentSelectedKey.major : `${currentSelectedKey.major} Maj / ${currentSelectedKey.major}m`}
          </span>
        </div>
        <table style={CIRCLE_STYLE.table}>
          <thead>
            <tr>
              <th colSpan="3" style={{ ...CIRCLE_STYLE.thTd, ...CIRCLE_STYLE.headerTheme(displayMode === 'harmonica') }}>
                {displayMode === 'harmonica' ? 'Song Key' : 'Harp Key'}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowSpan="3" style={{ ...CIRCLE_STYLE.thTd, ...CIRCLE_STYLE.bgGray, width: '20%' }}>Major</td>
              <td style={{ ...CIRCLE_STYLE.thTd, width: '55%', fontSize: '15px', textAlign: 'left' }}>1st Position / Ionian Mode</td>
              <td style={{ ...CIRCLE_STYLE.thTd, fontWeight: 'bold', color: '#cbd5e1', width: '25%' }}>{getKeyByOffsetIndex(0).major}</td>
            </tr>
            <tr>
              <td style={{ ...CIRCLE_STYLE.thTd, fontSize: '15px', textAlign: 'left' }}>2nd Position / Mixolydian Mode</td>
              <td style={{ ...CIRCLE_STYLE.thTd, fontWeight: 'bold' }}>{displayMode === 'harmonica' ? getKeyByOffsetIndex(1).major : getKeyByOffsetIndex(-1).major}</td>
            </tr>
            <tr>
              <td style={{ ...CIRCLE_STYLE.thTd, fontSize: '15px', textAlign: 'left' }}>12th Position / Lydian Mode</td>
              <td style={{ ...CIRCLE_STYLE.thTd, fontWeight: 'bold' }}>{displayMode === 'harmonica' ? getKeyByOffsetIndex(-1).major : getKeyByOffsetIndex(1).major}</td>
            </tr>
            <tr>
              <td rowSpan="3" style={{ ...CIRCLE_STYLE.thTd, ...CIRCLE_STYLE.bgGray }}>minor</td>
              <td style={{ ...CIRCLE_STYLE.thTd, fontSize: '15px', textAlign: 'left' }}>3rd Position / Dorian Mode</td>
              <td style={{ ...CIRCLE_STYLE.thTd, fontWeight: 'bold', color: '#fb923c' }}>
                {displayMode === 'harmonica' ? `${getKeyByOffsetIndex(2).major}m` : getKeyByOffsetIndex(-2).major}
              </td>
            </tr>
            <tr>
              <td style={{ ...CIRCLE_STYLE.thTd, fontSize: '15px', textAlign: 'left' }}>4th Position / Aeolian Mode</td>
              <td style={{ ...CIRCLE_STYLE.thTd, fontWeight: 'bold', color: '#fb923c' }}>
                {displayMode === 'harmonica' ? `${getKeyByOffsetIndex(3).major}m` : getKeyByOffsetIndex(-3).major}
              </td>
            </tr>
            <tr>
              <td style={{ ...CIRCLE_STYLE.thTd, fontSize: '15px', textAlign: 'left' }}>5th Position / Phrygian Mode</td>
              <td style={{ ...CIRCLE_STYLE.thTd, fontWeight: 'bold', color: '#fb923c' }}>
                {displayMode === 'harmonica' ? `${getKeyByOffsetIndex(4).major}m` : getKeyByOffsetIndex(-4).major}
              </td>
            </tr>
          </tbody>
        </table>
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
             <h3 style={gStyle.secTitle}> 하모니카 연습이 조금이나마 즐거워 지시길 바랍니다 </h3>
                <div style={gStyle.subTitle}>• 하모니카로 당신의 인생을 연주하세요! 당신의 연주에 담길 당신의 인생을 응원합니다 </div>    
            <h3 style={gStyle.secTitle}> Help & Tutorial </h3>
                <div style={gStyle.subTitle}> https://sites.google.com/view/allofharp</div>
            <h3 style={gStyle.secTitle}> Contact </h3>
                <div style={gStyle.subTitle}> 279.lee@gmail.com </div>
             </div>
        </div>  
        
        {/* 🔒 순정 하단 저작권 텍스트 및 정갈한 가로 1줄 마감선 */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '20px', marginTop: '10px', width: '100%' }}>
          <div style={{ fontSize: '14px', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>
            Harmonica Training Center since 2026 • Ver 2.0.0
          </div>
        </div>

      </div>
    </div>
  );
}
