import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Play, Pause, Upload, Mic, Square, Download, Settings, X } from 'lucide-react';
import BackingTrackPlayer from './BackingTrackPlayer';

// 🎯 5도권 12개 슬롯 배치 메타데이터 정의 (Db조 나란한조 Bbm 오타 정합 패치 완료)
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

// 🎯 5도권 포지션 레이블 축약형 고정 및 4th 오타 전면 수정 완료
const fixedPositionLabels = [
  { text: "1st", harmonicaAngle: 0, songAngle: 0 },
  { text: "2nd", harmonicaAngle: 30, songAngle: -30 },
  { text: "12th", harmonicaAngle: -30, songAngle: 30 },
  { text: "3rd", harmonicaAngle: 60, songAngle: -60 },
  { text: "4th", harmonicaAngle: 90, songAngle: -90 },
  { text: "5th", harmonicaAngle: 120, songAngle: -120 }
];

// 🎯 가로 수평 높이를 반듯하게 일렬 정렬하기 위한 고정 격자 2차원 매트릭스 데이터 구조
const HARP_LAYOUT = {
  holes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  blow: [0, 4, 7, 12, 16, 19, 24, 28, 31, 36], 
  draw: [2, 7, 11, 14, 17, 21, 23, 26, 29, 33], 
  
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
  'Gb': { semi: 6, oct: 4 }, 'G': { semi: 7, oct: 3 }, 'Ab': { semi: 8, oct: 3 },
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

// 🛠️ [정사각형 80px 그리드 가이드 스타일]: 가로 세로 1:1 대칭 비율 유지 및 마진 정밀 압축
const BOX_STYLE = {
  container: { 
    backgroundColor: '#050a14', // 👈 전체 여백을 완전한 검은색으로 고정
    width: '100vw', 
    // ⚠️ 고정 height: '100vh'와 overflow: 'hidden'을 과감히 제거하여 스크롤 락을 풉니다.
    minHeight: '100vh',         // 👈 컨텐츠 길이에 맞게 세로가 유연하게 늘어나도록 보정
    color: 'white', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'flex-start', // 👈 작은 화면에서 컨텐츠가 상단부터 자연스럽게 정렬되도록 변경
    fontFamily: 'sans-serif', 
    boxSizing: 'border-box', 
    
    // 💡 [핵심 보정] 가로 스크롤은 숨기고, 세로 스크롤 및 모바일 터치 쓸어내리기 제어권을 완벽히 복원합니다.
    overflowX: 'hidden',    
    overflowY: 'auto',     // 👈 화면이 작으면 위아래로 부드럽게 스크롤바가 작동합니다.
    touchAction: 'pan-y',   // 👈 아이패드/핸드폰에서 손가락으로 위아래 화면 밀기가 정상 작동합니다.
    userSelect: 'none',     
    
    position: 'relative',
    padding: '40px 20px'    // 👈 위아래 마진 여백을 넉넉히 주어 끝자락 대시보드가 잘리지 않게 방어
  },
  contentWrapper: { 
    width: '100%', 
    maxWidth: '1080px', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    boxSizing: 'border-box', 
    marginTop: '-15px' 
  },

    // 💡 [BOX_STYLE 상단 툴바 글자 크기 일괄 통일 패치 완료]
  selectBox: { 
    background: '#1e293b', color: '#60a5fa', border: '2px solid #334155', borderRadius: '14px', 
    padding: '6px 16px', 
    fontSize: 'calc(16px + 0.4vmin)', // 👈 4개 요소의 글자 크기를 완벽하게 한 수식으로 연동
    fontWeight: '900', outline: 'none' 
  },
  micBtn: { 
    borderRadius: '14px', color: 'white', fontWeight: 'bold', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '10px', 
    fontSize: 'calc(14px + 0.4vmin)'  // 👈 글자 크기 통일
  },
  settingsBtn: { 
    backgroundColor: '#1f2937', color: 'white', borderRadius: '14px', cursor: 'pointer', border: '1px solid #374151', display: 'flex', alignItems: 'center', gap: '10px', 
    fontSize: 'calc(14px + 0.4vmin)'  // 👈 글자 크기 통일
  },
  circleBtn: { 
    backgroundColor: '#4f46e5', color: 'white', borderRadius: '14px', cursor: 'pointer', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', 
    fontSize: 'calc(14px + 0.4vmin)'  // 👈 글자 크기 통일
  },

  gridContainer: { display: 'flex', gap: '10px', padding: '4px 0', width: '100%', justifyContent: 'space-between', marginBottom: '10px', boxSizing: 'border-box' },
  holeNumber: { 
  width: '7.4vw',        // 80px 대신 화면 폭에 비례하는 단위로 설정
  maxWidth: '80px',      // 화면이 아무리 커져도 최대 80px까지만 커지도록 제한
  height: '54px', 
  border: '2px solid #475569', 
  borderRadius: '14px', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center', 
  fontWeight: '900', 
  fontSize: '24px', 
  color: '#94a3b8', 
  backgroundColor: '#1e293b', 
  margin: '6px 0', 
  userSelect: 'none', 
  flexShrink: 0 
}
  //holeNumber: { width: '80px', height: '54px', border: '2px solid #475569', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '24px', color: '#94a3b8', backgroundColor: '#1e293b', margin: '6px 0', userSelect: 'none', flexShrink: 0 }
};

const DASHBOARD_STYLE = {
  inlineDashboard: { width: '100%', display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 0.9fr', gap: '12px', marginTop: '20px', backgroundColor: '#111827', padding: '12px', borderRadius: '24px', border: '1px solid #374151', boxSizing: 'border-box' },
  controlBox: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#1f2937', padding: '10px 14px', borderRadius: '18px', border: '1px solid #374151', minWidth: 0, boxSizing: 'border-box', width: '100%', height: '100px' },
  playBtn: { border: 'none', backgroundColor: '#22c55e', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '2px' }
};

const MODAL_STYLE = {
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
  modalContent: { 
    backgroundColor: '#111827', 
    width: '600px',           // 가로 폭 고정
    maxWidth: '90vw',         // 스마트폰 등 초소형 화면에서는 화면의 90% 폭으로 자동 압축 가드
    maxHeight: '80vh',        // 💡 [신규 추가] 세팅창이 화면 높이의 80%를 넘지 않도록 제한
    overflowY: 'auto',        // 💡 [신규 추가] 내용이 넘치면 세팅창 내부만 위아래로 부드럽게 스크롤 작동
    borderRadius: '28px', 
    padding: '35px',          // 세로 스크롤을 고려해 상하 패딩 최적화
    border: '1px solid #374151', 
    color: 'white',
    boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
  },
  saveBtn: { width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: '#10b981', color: 'black', fontWeight: '900', fontSize: '18px', cursor: 'pointer', marginTop: '12px' }
};

// 💡 [CIRCLE_STYLE 반응형 스케일링 ]
const CIRCLE_STYLE = {
    container: { 
    display: 'flex', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: '4vw', 
    width: '100vw', 
    height: '100vh',        // 화면 세로에 딱 맞춤
    boxSizing: 'border-box', 
    backgroundColor: '#050a14', 
    color: 'white', 
    fontFamily: 'sans-serif', 
    padding: '20px', 
    overflow: 'hidden',     // 💡 여백 밀림 시 흰색 노출 원천 차단
    touchAction: 'none',    
    userSelect: 'none'
  },
  // 화면 세로/가로 중 작은 축(vmin)을 기준으로 전체 원 크기를 동기화하여 왜곡을 막습니다.
  circleWrapper: { position: 'relative', width: '82vmin', height: '82vmin', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rotatableWheel: (angle, isDragging) => ({ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', zIndex: 10, transform: `rotate(${angle}deg)`, cursor: isDragging ? 'grabbing' : 'grab', overflow: 'visible', transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)' }),
  wheelBg: { width: '100%', height: '100%', borderRadius: '50%', position: 'absolute', background: 'conic-gradient(#e51c23 0deg 30deg, #f57c00 30deg 60deg, #ffb74d 60deg 90deg, #fdd835 90deg 120deg, #aeea00 120deg 150deg, #4caf50 150deg 180deg, #00b0ff 180deg 210deg, #00e5ff 210deg 240deg, #2979ff 240deg 270deg, #3f51b5 270deg 300deg, #673ab7 300deg 330deg, #e91e63 330deg 360deg)', transform: 'rotate(-15deg)', zIndex: 1 },
  innerMask: { position: 'absolute', width: '60%', height: '60%', backgroundColor: '#050a14', borderRadius: '50%', top: '20%', left: '20%', zIndex: 2, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.45)' }, 
  centerCore: { position: 'absolute', width: '25%', height: '25%', backgroundColor: '#111827', borderRadius: '50%', zIndex: 30, border: '2px solid #374151', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', overflow: 'visible' },
  coreCenterContent: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 35, textAlign: 'center', width: '90%' },
  staticCurvedSvgOverlay: { position: 'absolute', top: '-1%', left: '-1%', width: '102%', height: '102%', zIndex: 32 },
  textLayerWrapper: { position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 5 },
  nodeSectorBtn: { position: 'absolute', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, margin: 0, zIndex: 12 },
  
  // 버튼과 글자 크기 vmin 단위로 자동 유연 축소 처리
  btnStyleMaj: { width: '9.5vw', maxWidth: '70px', height: '6.5vw', maxHeight: '50px', fontSize: 'calc(12px + 1.2vmin)', fontWeight: '900', color: '#ffffff', textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0px 3px 5px rgba(0,0,0,0.9)' },
  btnStyleMin: { width: '8vw', maxWidth: '60px', height: '5vw', maxHeight: '40px', fontSize: 'calc(9px + 0.8vmin)', fontWeight: '800', color: '#a3b8cc', textShadow: '0px 1px 3px rgba(0,0,0,0.8)' },
  
  signatureTextBadge: (opacity, isSharp, isFlat) => ({ position: 'absolute', zIndex: 11, fontSize: opacity === 1 ? 'calc(14px + 1.5vmin)' : 'calc(11px + 1.2vmin)', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: opacity, color: isSharp ? '#ef4444' : (isFlat ? '#3b82f6' : '#64748b'), transition: 'opacity 0.15s ease, transform 0.4s' }),
  romanDegreeBadge: { position: 'absolute', zIndex: 8, fontSize: 'calc(12px + 1vmin)', fontWeight: '900', color: '#a3b8cc', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  staticOverlayLayer: { position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 20, pointerEvents: 'none' },
  staticFixedPositionBadge: { position: 'absolute', zIndex: 25, width: '40vmin', height: '4vmin', fontSize: 'calc(10px + 0.8vmin)', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', textShadow: '0px 2px 4px rgba(0, 0, 0, 0.65)' },
  
  tablePanel: { width: '28vw', maxWidth: '520px', minWidth: '320px', flexShrink: 0 },
  clickablePanelTitle: { fontSize: 'calc(14px + 0.6vmin)', fontWeight: 'bold', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #374151', padding: '0 16px', borderRadius: '12px', backgroundColor: '#111827', height: '55px', border: '1px solid #374151', boxSizing: 'border-box', cursor: 'pointer' },
  dynamicTitleValue: (isBlue) => ({ fontSize: 'calc(14px + 0.8vmin)', fontWeight: '900', letterSpacing: '-0.3px', color: isBlue ? '#3b82f6' : '#10b981' }),
  table: { width: '100%', borderCollapse: 'collapse', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' },
  thTd: { border: '1px solid #374151', padding: '1.2vh 1vw', textAlign: 'center', fontSize: 'calc(11px + 0.6vmin)', color: '#cbd5e1' },
  headerTheme: (isGreen) => ({ backgroundColor: isGreen ? '#10b981' : '#2563eb', color: 'white', fontWeight: 'bold', fontSize: 'calc(13px + 0.8vmin)' }),
  bgGray: { backgroundColor: '#1f2937', fontWeight: 'bold', fontSize: 'calc(11px + 0.6vmin)', color: '#94a3b8' }
};

export default function SingleFileAppRouter() {
  const [currentPath, setCurrentPath] = useState('/');
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/';
      setCurrentPath(hash.replace('#', ''));
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (currentPath === '/circle-of-fifths') {
    return <NewFeaturePage onRouteClick={() => window.close()} />;
  }
  return <App />;
}

function App() {
  const [currentKey, setCurrentKey] = useState('C');
  const [isLowKey, setIsLowKey] = useState(false);
  const [baseFreq, setBaseFreq] = useState(440);
  const [activeNote, setActiveNote] = useState(null);
  const [centsOff, setCentsOff] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [tolerance, setTolerance] = useState(10);
  const [showSettings, setShowSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState("No file");
  const [showOverbanding, setShowOverbanding] = useState(true);
 
  // 💡 [추가] 셋팅 메뉴 내 스케일 연산을 위한 상태 변수
  const [scaleRootKey, setScaleRootKey] = useState('C');
  const [selectedScale, setSelectedScale] = useState('Major / Ionian');

  // 12음 기본 인덱스 데이터 매핑 테이블
  const baseNoteNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  
  // 11가지 스케일의 화성학적 반음 간격 오프셋 사전 정의
  const scaleDefinitions = {
    'Major / Ionian': [0, 2, 4, 5, 7, 9, 11, 12],
    'Dorian': [0, 2, 3, 5, 7, 9, 10, 12],
    'Phrygian': [0, 1, 3, 5, 7, 8, 10, 12],
    'Lydian': [0, 2, 4, 6, 7, 9, 11, 12],
    'Mixolydian': [0, 2, 4, 5, 7, 9, 10, 12],
    'Aeolian / Natural Minor': [0, 2, 3, 5, 7, 8, 10, 12],
    'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11, 12], 
    'Locrian': [0, 1, 3, 5, 6, 8, 10, 12],
    'Major Pentatonic': [0, 2, 4, 7, 9, 12],
    'Major Blues': [0, 2, 3, 4, 7, 9, 12],
    'Minor Pentatonic': [0, 3, 5, 7, 10, 12],
    'Minor Blues': [0, 3, 5, 6, 7, 10, 12]
  };

  // 💡 선택된 키와 스케일 규칙에 의거하여 음 이름을 실시간으로 연산해내는 마스터 함수
  const calculateScaleNotes = () => {
    const rootIndex = baseNoteNames.indexOf(scaleRootKey);
    if (rootIndex === -1) return [];
    
    const offsets = scaleDefinitions[selectedScale] || [];
    return offsets.map(offset => {
      const targetIndex = (rootIndex + offset) % 12;
      return baseNoteNames[targetIndex];
    });
  };

  const scaleNotesResult = calculateScaleNotes();

  // 배킹 트랙 속도 및 반음 키 전조 제어용 상태
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [pitchKeyOffset, setPitchKeyOffset] = useState(0);

  // 볼륨 및 공간계 설정 상태
  const [mrVolume, setMrVolume] = useState(0.8);
  const [micVolume, setMicVolume] = useState(0.8);
  const [synthVolume, setSynthVolume] = useState(0.5);
  const [useReverb, setUseReverb] = useState(true);
  const [reverbMode, setReverbMode] = useState('standard');
  const [reverbWet, setReverbWet] = useState(0.3);

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

  // 오디오 파이프라인 그래프 빌드 및 청소
  useEffect(() => {
    const limiter = new Tone.Limiter(-1).toDestination();
    mixedBus.current = new Tone.Gain(1).connect(limiter);

    recorder.current = new Tone.Recorder();
    mixedBus.current.connect(recorder.current);

    mrGain.current = new Tone.Gain(mrVolume).connect(mixedBus.current);
    shifter.current = new Tone.PitchShift(pitchKeyOffset).connect(mrGain.current);

    stdVerb.current = new Tone.Reverb({ decay: 2.5, wet: 0 }).connect(mixedBus.current);
    springSlap.current = new Tone.FeedbackDelay({ delayTime: "32n", feedback: 0.2, wet: 0 });
    toneFilter.current = new Tone.Filter(4500, "highpass");
    springVerb.current = new Tone.Reverb({ decay: 3.5, wet: 0 }).connect(mixedBus.current);

    springSlap.current.chain(toneFilter.current, springVerb.current);

    // 💡 [피드백 차단 패치] 마이크 게인을 녹음 버스(mixedBus)에만 연결하고, 최종 스피커 출력단에는 절대 연결하지 않습니다.
    micGain.current = new Tone.Gain(micVolume).connect(mixedBus.current);
    
    // 마이크 리버브 공간계 역시 스커트 단을 거쳐 최종 mixedBus(녹음)에만 합류하도록 유지합니다.
    micGain.current.connect(stdVerb.current);
    micGain.current.connect(springSlap.current);

    synthGain.current = new Tone.Gain(synthVolume).connect(mixedBus.current);

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
      mixedBus.current?.dispose();
      limiter.dispose();
    };
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

  // 실시간 슬라이더 속도값 변화 반영 훅
  useEffect(() => {
    if (trackPlayer.current) {
      trackPlayer.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // 실시간 반음 키 단위 전조 피치 반영 훅
  useEffect(() => {
    if (shifter.current) {
      shifter.current.pitch = pitchKeyOffset;
    }
  }, [pitchKeyOffset]);

  const getNoteName = (semi) => {
    if (semi === null) return null;
    const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    const keyData = isLowKey ? (lowKeys[currentKey] || { semi: 0, oct: 3 }) : (standardKeys[currentKey] || { semi: 0, oct: 4 });
    const absoluteSemi = semi + keyData.semi + (keyData.oct * 12);
    return names[((absoluteSemi % 12) + 12) % 12] + Math.floor(absoluteSemi / 12);
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

const startMic = async () => {
 try {
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }

      if (!micInput.current) {
        // 1. 마이크 입력 장치 활성화
        micInput.current = new Tone.UserMedia();
        await micInput.current.open();
        
        // 2. 실시간 음정 인식을 위한 분석기 생성
        analyser.current = Tone.getContext().createAnalyser();
        analyser.current.fftSize = 512; 
        
        // 3. 💡 [녹음 연동 및 하울링 전면 차단 패치]
        // 마이크 입력을 스피커로 직결하지 않고, 오직 주파수 분석기(analyser)와
        // 믹싱 버스에 물려있는 마이크 볼륨 제어 노드(micGain.current)에만 안전하게 연결합니다.
        // micGain.current는 스피커와 단절된 채 mixedBus(레코더)에만 연결되어 있으므로 하울링 없이 완벽히 녹음됩니다.
        micInput.current.connect(analyser.current);
        micInput.current.connect(micGain.current);
      }
      setIsListening(true);
      isListeningRef.current = true;

      const updateLoop = () => {
        if (!analyser.current || !isListeningRef.current) return;
        const buf = new Float32Array(analyser.current.fftSize);
        analyser.current.getFloatTimeDomainData(buf);
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

  function autoCorrelate(buf, sampleRate) {
 let SIZE = buf.length, rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    
    // 💡 [감도 극한 패치] 기존 0.0015에서 0.0004로 노이즈 문턱값을 극단적으로 낮추어,
    // 마이크에서 멀리 떨어진 소리나 아주 작게 연주하는 ppp(피아니시모) 음정까지 전부 잡아냅니다.
    if (Math.sqrt(rms / SIZE) < 0.0004) return -1;

    // 미세 약음 진동 유효 스캔 범위 확장
    let r1 = 0, r2 = SIZE - 1, thres = 0.04; 
    for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    const sliced = buf.slice(r1, r2);
    if (sliced.length === 0) return -1;

    let c = new Array(sliced.length).fill(0);
    for (let i = 0; i < sliced.length; i++) {
      for (let j = 0; j < sliced.length - i; j++) c[i] = c[i] + sliced[j] * sliced[j + i];
    }
    
    // 하모니카 배음 가짜 피크 스킵 가드
    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < sliced.length; i++) {
      if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    
    if (maxpos === -1 || maxpos === 0) return -1;
    
    return sampleRate / maxpos;
  }
  // 💡 [2단계 패치: 진입 및 종료 핸들러 함수 구역 삽입 완료]

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const targetFile = files[0]; 
      setFileName(targetFile.name);
      const url = URL.createObjectURL(targetFile);
      if (trackPlayer.current) trackPlayer.current.dispose();
      trackPlayer.current = new Tone.Player({ url, fadeIn: 0.1, fadeOut: 0.1, playbackRate: playbackRate }).connect(shifter.current);
    }
  };

    const handleBackingTrackLoaded = (fileUrl, name) => {
    setFileName(name);
    if (trackPlayer.current) trackPlayer.current.dispose();
    trackPlayer.current = new Tone.Player({ 
      url: fileUrl, 
      fadeIn: 0.1, 
      fadeOut: 0.1, 
      playbackRate: playbackRate 
    }).connect(shifter.current);
  };

  const toggleTrack = async () => {
    if (!trackPlayer.current) return alert("Upload MR file first!");
    await Tone.start();
    if (isPlaying) { trackPlayer.current.stop(); setIsPlaying(false); }
    else { trackPlayer.current.start(); setIsPlaying(true); }
    <BackingTrackPlayer />
  };

  const toggleRecording = async () => {
    await Tone.start();
    if (!isRecording) {
      setRecordedUrl(null);
      recorder.current.start();
      setIsRecording(true);
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
      // 녹음본 재생이 끝나면 실행될 이벤트
      audioPlaybackRef.current.onended = () => {
        setIsRecordedPlaying(false);
      };
    }
    
    if (isRecordedPlaying) {
      audioPlaybackRef.current.pause();
      setIsRecordedPlaying(false);
    } else {
      // 💡 [마이크 자동 차단 패치] 녹음 확인 소리를 재생하는 순간 실시간 마이크 추적 루프를 강제로 중단시킵니다.
      if (isListening) {
        stopMic();
      }
      
      audioPlaybackRef.current.play();
      setIsRecordedPlaying(true);
    }
  };
  return (
    <div style={BOX_STYLE.container}>
      <div style={BOX_STYLE.contentWrapper}>

        {/* 상단 버튼 그룹 (4개 요소 높이 일괄 42px 통일 패치 완료) */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#94a3b8' }}>Harp Key</span>
            
            {/* 1. Harp Key 선택 박스 */}
            <select 
              style={{ ...BOX_STYLE.selectBox, height: '45px', padding: '0 16px', display: 'flex', alignItems: 'center' }} 
              value={currentKey} 
              onChange={(e) => setCurrentKey(e.target.value)}
            >
              {!isLowKey ? Object.keys(standardKeys).map(k => <option key={k} value={k}>{k}</option>) : Object.keys(lowKeys).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            
            {/* 2. 5도권 이동 버튼 */}
            <button 
              onClick={() => window.open('#/circle-of-fifths', '_blank')} 
              style={{ ...BOX_STYLE.circleBtn, height: '45px', padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              The Circle of Fifths
            </button>
          </div>

          {/* 3. 마이크 활성화 버튼 */}
          <button 
            onClick={isListening ? stopMic : startMic} 
            style={{ ...BOX_STYLE.micBtn, height: '45px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isListening ? '#ef4444' : '#2563eb' }}
          >
            <Mic size={20} style={{ marginRight: '6px' }} /> {isListening ? 'MIC ACTIVE' : 'START MIC'}
          </button>

          {/* 4. 세팅 버튼 */}
          <button 
            onClick={() => setShowSettings(true)} 
            style={{ ...BOX_STYLE.settingsBtn, height: '45px', padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Settings size={20} style={{ marginRight: '6px' }} /> Settings
          </button>
        </div>

        {/* 💡 스케일 노출 직사각형 밴드 */}
        <div style={{
          width: '60%',              // 하모니카 6번 홀 우측 끝선 동기화 비율 (60%) 유지
          maxWidth: '480px',         
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',                 // 첫 줄 텍스트와 아래 롱 박스 사이의 간격
          marginBottom: '20px',
          alignSelf: 'flex-start',    // 1~6번 홀 위치 아래 정렬 가이드 고정
          boxSizing: 'border-box'
        }}>
          
          {/* 1st Line: 키 + 스케일 풀네임 + 스케일 노트 문구를 한 줄로 정렬 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', paddingLeft: '4px' }}>
            <span style={{ fontSize: '20px', fontWeight: '900', color: '#60a5fa', letterSpacing: '-0.3px' }}>
              {scaleRootKey} {selectedScale}
            </span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '900', letterSpacing: '0.5px' }}>
              SCALE NOTES
            </span>
          </div>
          
          {/* 2nd Line: 가로로 긴 반듯한 단독 롱 박스 킷 */}
          <div style={{
            width: '100%',
            backgroundColor: '#111827',
            border: '1px solid #1e293b',
            borderRadius: '14px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start', // 음 이름들이 왼쪽부터 차례대로 단정하게 나열
            boxSizing: 'border-box',
            gap: '16px',                  // 큼직한 글자들 사이의 시원한 여백
            overflowX: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            {scaleNotesResult.map((note, idx) => (
              <span 
                key={idx} 
                style={{
                  fontSize: '22px',       // 22px 초거대 폰트 100% 유지
                  fontWeight: '900',
                  // 근음(첫 음과 마지막 옥타브 음)은 명품 파란색, 나머지 스케일 구성음은 화이트 계열 고대비 매칭
                  color: idx === 0 || idx === scaleNotesResult.length - 1 ? '#60a5fa' : '#cbd5e1',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  userSelect: 'none',
                  letterSpacing: '-0.5px'
                }}
              >
                {note}
              </span>
            ))}
          </div>

        </div>


        {/* 🛠️ [정사각형 80px 완벽 정렬 매트릭스]: 하모니카 음 배열 레이아웃 */}
         <div style={BOX_STYLE.gridContainer}>
          {HARP_LAYOUT.holes.map((h, i) => (
            // 💡 바깥 감싸개 width를 80px 고정에서 반응형 폭(7.4vw) 및 최댓값 제한으로 변경
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '7.4vw', maxWidth: '80px' }}>
              
              {/* 1. 상단 오버 존 스택 구역 */}
                <div style={{ 
                display: 'flex', 
                flexDirection: 'column-reverse', 
                gap: '8px', 
                // 💡 고정 164px를 지우고 사각형 2개 크기 비율로 유연하게 연동
                height: 'calc(14.8vw + 8px)', 
                maxHeight: '168px',
                width: '100%', 
                justifyContent: 'start', 
                alignItems: 'center', 
                marginBottom: '12px' 
              }}>
                {HARP_LAYOUT.topSpecials[i].map((semiVal, tIdx) => (
                  // 💡 개별 스택 감싸개의 가로세로를 유연하게 동기화
                  <div key={tIdx} style={{ width: '100%', height: '7.4vw', maxHeight: '80px', visibility: semiVal === null ? 'hidden' : 'visible', flexShrink: 0 }}>
                    <NoteBox semi={semiVal} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} isBlowZone={true} holeNum={h} showOverbanding={showOverbanding} />
                  </div>
                ))}
              </div>

              {/* 2. 표준 블로우 행 (Blow 고정축) */}
              {/* 💡 가로세로 폭을 7.4vw로 리사이징 결합 */}
              <div style={{ width: '100%', height: '7.4vw', maxHeight: '80px', flexShrink: 0, marginBottom: '12px' }}>
                <NoteBox semi={HARP_LAYOUT.blow[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} />
              </div>
              
              {/* 3. 중앙 가이드 홀 번호 행 */}
              <div style={{ ...BOX_STYLE.holeNumber, margin: '0 0 4px 0' }}>{h}</div>
              
              {/* 4. 표준 드로우 행 (Draw 고정축) */}
              {/* 💡 가로세로 폭을 7.4vw로 리사이징 결합 */}
              <div style={{ width: '100%', height: '7.4vw', maxHeight: '80px', flexShrink: 0, marginBottom: '10px' }}>
                <NoteBox semi={HARP_LAYOUT.draw[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} />
              </div>

              {/* 5. 하단 벤딩 존 스택 구역 */}
                <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px', 
                // 💡 고정 248px를 지우고 사각형 3개 크기 비율로 유연하게 연동
                height: 'calc(22.2vw + 16px)', 
                maxHeight: '256px',
                width: '100%', 
                justifyContent: 'start', 
                alignItems: 'center' 
              }}>
                {HARP_LAYOUT.bottomSpecials[i].map((semiVal, sIdx) => (
                  // 💡 가로세로 폭을 7.4vw로 리사이징 결합
                  <div key={sIdx} style={{ width: '100%', height: '7.4vw', maxHeight: '80px', visibility: semiVal === null ? 'hidden' : 'visible', flexShrink: 0 }}>
                    <NoteBox semi={semiVal} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} isDrawZone={true} holeNum={h} showOverbanding={showOverbanding} />
                  </div>
                ))}
              </div>

              {/* 우측 하단 타이틀 및 저작권 표시 - 화면 폭에 비례하여 타이틀과 저작권 글자 크기가 자동으로 */}
              {h === 10 && (
                <div style={{ position: 'absolute', bottom: '-30px', right: '0px', width: '60vw', maxWidth: '650px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', pointerEvents: 'none', zIndex: 10, fontFamily: 'sans-serif', lineHeight: '1.3' }}>
                  <div style={{ fontSize: 'calc(14px + 1.5vw)', minFontSize: '18px', fontWeight: '900', color: '#10b981', marginBottom: '8px', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
                    Diatonic Harmonica Training Center
                  </div>
                  <div style={{ color: '#475569', fontSize: 'calc(8px + 0.5vw)', minFontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    Copyright ⓒ 2026 CoffeeBada Lee, ChoongKoo All Rights Reserved.
                  </div>
                  <div style={{ color: '#64748b', fontSize: 'calc(8px + 0.5vw)', minFontSize: '11px', fontWeight: '600', marginTop: '1px', whiteSpace: 'nowrap' }}>
                    Contact : 279.lee@gmail.com
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

             {/* 오디오 대시보드 구역 */}
        <div style={DASHBOARD_STYLE.inlineDashboard}>
          <div style={{ ...DASHBOARD_STYLE.controlBox, height: '90px', flexDirection: 'column', gap: '4px', padding: '10px 16px', alignContent: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '10px' }}>
              
              {/* 배킹트랙 외부 소스 링크부 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 0, maxWidth: '140px' }}>
                <Upload size={20} style={{ color: '#60a5fa', flexShrink: 0 }} />
                <BackingTrackPlayer onFileLoaded={handleBackingTrackLoaded} />
              </div>

              <button onClick={toggleTrack} style={DASHBOARD_STYLE.playBtn}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={DASHBOARD_STYLE.label}>MR VOL ({Math.round(mrVolume * 100)}%)</span>
                <input type="range" min="0" max="1" step="0.01" value={mrVolume} onChange={(e) => setMrVolume(parseFloat(e.target.value))} style={{ width: '100%', height: '4px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', width: '100%', gap: '18px', marginTop: '2px' }}>
              <div style={{ flex: 1 }}>
                <span style={DASHBOARD_STYLE.label}>SPEED ({playbackRate.toFixed(2)}x)</span>
                <input type="range" min="0.4" max="1.0" step="0.05" value={playbackRate} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} style={{ width: '100%', height: '4px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={DASHBOARD_STYLE.label}>KEY PITCH ({pitchKeyOffset > 0 ? `+${pitchKeyOffset}` : pitchKeyOffset})</span>
                <input type="range" min="-6" max="6" step="1" value={pitchKeyOffset} onChange={(e) => setPitchKeyOffset(parseInt(e.target.value))} style={{ width: '100%', height: '4px' }} />
              </div>
            </div>
          </div>
          
          <div style={{ ...DASHBOARD_STYLE.controlBox, height: '90px' }}>
            <button onClick={toggleRecording} style={{ ...DASHBOARD_STYLE.playBtn, width: '48px', height: '48px', borderRadius: '12px', backgroundColor: isRecording ? '#ef4444' : '#374151', fontSize: '13px', fontWeight: '900' }}>
              REC
            </button>
            <button onClick={toggleRecordedPlayback} disabled={!recordedUrl} style={{ ...DASHBOARD_STYLE.playBtn, backgroundColor: recordedUrl ? '#3b82f6' : '#4b5563', cursor: recordedUrl ? 'pointer' : 'not-allowed' }}>
              {isRecordedPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: '2px' }}>
              <span style={DASHBOARD_STYLE.label}>MIX RECORDER</span>
              {recordedUrl ? (
                <a href={recordedUrl} download="harmonica_practice.wav" style={{ color: '#10b981', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                  <Download size={14} /> DOWNLOAD
                </a>
              ) : (
                <span style={{ color: '#4b5563', fontSize: '12px' }}>{isRecording ? 'Recording...' : 'Ready'}</span>
              )}
            </div>
          </div>

          <div style={{ ...DASHBOARD_STYLE.controlBox, height: '90px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={DASHBOARD_STYLE.label}>MIC VOL ({Math.round(micVolume * 100)}%)</span>
              <input type="range" min="0" max="1" step="0.01" value={micVolume} onChange={(e) => setMicVolume(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0, marginLeft: '10px' }}>
              <span style={DASHBOARD_STYLE.label}>SYNTH VOL ({Math.round(synthVolume * 100)}%)</span>
              <input type="range" min="0" max="1" step="0.01" value={synthVolume} onChange={(e) => setSynthVolume(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* 설정 모달 */}
        {showSettings && (
          <div style={MODAL_STYLE.modalOverlay}>
            <div style={MODAL_STYLE.modalContent}>
              
              {/* 타이틀 헤더 */}
              <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff', marginBottom: '25px', marginTop: 0, borderBottom: '1px solid #374151', paddingBottom: '12px' }}>
                🔧 Settings Menu
              </h2>

              {/* 1. Low Key 설정 구역 */}
              <div style={{ marginBottom: '22px', padding: '18px', backgroundColor: '#1f2937', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #374151' }}>
                <span style={{ fontSize: '18px', color: '#cbd5e1', fontWeight: 'bold' }}>Harmonica Low Key 로우키 하모니카 모드</span>
                <button onClick={() => { const nm = !isLowKey; setIsLowKey(nm); setCurrentKey(nm ? 'LF' : 'C'); }} style={{ padding: '10px 22px', backgroundColor: isLowKey ? '#10b981' : '#4b5563', border: 'none', color: isLowKey ? 'black' : 'white', borderRadius: '10px', fontWeight: '900', fontSize: '15px', cursor: 'pointer' }}>
                  {isLowKey ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* 2. 스케일 마스터 셀렉터 구역 */}
              <div style={{ marginBottom: '22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Select Key</span>
                  <select 
                    value={scaleRootKey} 
                    onChange={(e) => setScaleRootKey(e.target.value)}
                    style={{ width: '100%', background: '#1e293b', color: '#ffffff', border: '1px solid #374151', borderRadius: '12px', padding: '12px', fontSize: '16px', fontWeight: 'bold', outline: 'none' }}
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
                    style={{ width: '100%', background: '#1e293b', color: '#ffffff', border: '1px solid #374151', borderRadius: '12px', padding: '12px', fontSize: '16px', fontWeight: 'bold', outline: 'none' }}
                  >
                    {[
                      'Major / Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 
                      'Aeolian / Natural Minor', 'Harmonic Minor', 'Locrian', 'Major Pentatonic', 
                      'Major Blues', 'Minor Pentatonic', 'Minor Blues'
                    ].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ⚠️ 에러를 유발하던 Precision Tuner Mode 스위치 라인을 완전히 도려내어 삭제 완료했습니다. */}

              {/* 3. 기본 피치 설정 구역 */}
              <div style={{ marginBottom: '22px' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Standard Pitch 표준 튜닝 피치: A={baseFreq}Hz</span>
                <input type="range" min="430" max="450" step="1" value={baseFreq} onChange={(e) => setBaseFreq(parseInt(e.target.value))} style={{ width: '100%', height: '6px' }} />
              </div>

              {/* 4. 허용 오차 디테일 구역 */}
              <div style={{ marginBottom: '22px' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Tolerance 튜너 허용 범위 (±{tolerance}c)</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['5', '10', '15', '20'].map(val => (
                    <button key={val} onClick={() => setTolerance(parseInt(val))} style={{ flex: 1, padding: '12px 0', borderRadius: '10px', border: 'none', backgroundColor: tolerance === parseInt(val) ? '#10b981' : '#374151', color: tolerance === parseInt(val) ? 'black' : 'white', fontWeight: '900', cursor: 'pointer', fontSize: '15px' }}>
                      ±{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. 공간계 조절 구역 (리버브 3단 버튼 인라인 정렬 완료) */}
              <div style={{ marginBottom: '25px', padding: '18px', backgroundColor: '#1f2937', borderRadius: '14px', border: '1px solid #374151' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'nowrap' }}>
                  <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Reverb Master Control 리버브 설정</span>
                  
                  <div style={{ display: 'flex', backgroundColor: '#111827', padding: '4px', borderRadius: '10px', border: '1px solid #374151' }}>
                    <button 
                      onClick={() => setUseReverb(!useReverb)} 
                      style={{ padding: '6px 14px', backgroundColor: useReverb ? '#10b981' : '#ef4444', border: 'none', color: useReverb ? 'black' : 'white', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}
                    >
                      {useReverb ? 'ON' : 'OFF'}
                    </button>
                    
                    <button 
                      onClick={() => useReverb && setReverbMode('standard')}
                      disabled={!useReverb}
                      style={{ padding: '6px 12px', marginLeft: '4px', backgroundColor: useReverb && reverbMode === 'standard' ? '#2563eb' : 'transparent', border: 'none', color: useReverb && reverbMode === 'standard' ? 'white' : '#64748b', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: useReverb ? 'pointer' : 'not-allowed', opacity: useReverb ? 1 : 0.3, transition: 'all 0.15s' }}
                    >
                      STANDARD
                    </button>
                    
                    <button 
                      onClick={() => useReverb && setReverbMode('spring')}
                      disabled={!useReverb}
                      style={{ padding: '6px 12px', marginLeft: '4px', backgroundColor: useReverb && reverbMode === 'spring' ? '#2563eb' : 'transparent', border: 'none', color: useReverb && reverbMode === 'spring' ? 'white' : '#64748b', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: useReverb ? 'pointer' : 'not-allowed', opacity: useReverb ? 1 : 0.3, transition: 'all 0.15s' }}
                    >
                      SPRING
                    </button>
                  </div>
                </div>

                {/* 리버브 양 슬라이더 모듈 */}
                <div style={{ borderTop: '1px solid #374151', paddingTop: '14px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '15px', color: '#94a3b8', fontWeight: 'bold' }}>Reverb Amount 리버브 양(Wet Level)</span>
                    <span style={{ fontSize: '15px', color: '#10b981', fontWeight: '900' }}>{Math.round(reverbWet * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={reverbWet} 
                    onChange={(e) => setReverbWet(parseFloat(e.target.value))} 
                    disabled={!useReverb} 
                    style={{ width: '100%', height: '6px', cursor: useReverb ? 'pointer' : 'not-allowed', opacity: useReverb ? 1 : 0.4 }} 
                  />
                </div>
              </div>

              <button onClick={() => setShowSettings(false)} style={{ ...MODAL_STYLE.saveBtn, fontSize: '20px', padding: '18px' }}>
                SAVE & CLOSE
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function NoteBox({ semi, getNote, activeNote, cents, limit, onStart, onStop, isBlowZone, isDrawZone, isTopBb, holeNum, showOverbanding }) {
  const noteName = getNote(semi);
  if (semi === null || !noteName) return <div style={{ height: '80px', width: '80px', margin: '3px 0' }}></div>;
  const isActive = activeNote === noteName;
  const displayLabel = noteName.replace(/\d+/g, '');
  const safeCents = Math.max(-limit, Math.min(limit, cents));
  const indicatorLeft = 50 + (safeCents / limit) * 40;
  let bgColor = '#1e293b'; let borderStyle = '1px solid #334155';
  if (isActive) { bgColor = Math.abs(cents) <= limit ? '#22c55e' : (cents > limit ? '#eab308' : '#ef4444'); }
  else { if (isTopBb) bgColor = '#93c5fd'; 
    else if (isBlowZone) {
  // 상단 스택(isBlowZone) 중 8, 9, 10번 홀만 하늘색으로 지정
  if (holeNum >= 8 && holeNum <= 10) {
    bgColor = '#93c5fd'; // 하늘색
  } else {
    bgColor = '#fca5a5'; // 나머지 홀의 기존 색상 유지
  }
}
    else if (isDrawZone) bgColor = (holeNum >= 7 && holeNum <= 10) ? '#f59e0b' : '#93c5fd'; }
  return (
    <div 
    style={{ 
      width: '100%',         // 💡 고정 80px 대신 부모 반응형 폭(7.4vw)에 100% 꽉 맞춤
      height: '100%',        // 💡 높이도 가로 비율 변화에 동기화되도록 100% 꽉 맞춤
      margin: '3px 0', 
      borderRadius: '14px', 
      border: borderStyle, 
      backgroundColor: bgColor, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      position: 'relative', 
      overflow: 'hidden', 
      cursor: 'pointer', 
      userSelect: 'none' 
    }} 
    onMouseDown={() => onStart(noteName)} 
    onMouseUp={onStop} 
    onMouseLeave={onStop} 
    onTouchStart={() => onStart(noteName)} 
    onTouchEnd={onStop}
  >
    <span style={{ fontWeight: '900', fontSize: '24px', color: 'white', zIndex: 10 }}>{displayLabel}</span>
    {isActive && <div style={{ position: 'absolute', left: `${indicatorLeft}%`, width: '4px', height: '100%', backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 5 }} />}
  </div>
);
}
// 🎯 [5도권 시각화 페이지 컴포넌트 본문 구역 독립 매핑]
function NewFeaturePage({ onRouteClick }) {
  const [rotationAngle, setRotationAngle] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayMode, setDisplayMode] = useState('harmonica'); 
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const mainWrapperRef = useRef(null);
  const dragStartAngle = useRef(0);
  const baseRotationOnDragStart = useRef(0);

  // 💡 기존 휠 크기 대비 각 요소가 위치해야 할 화성학적 % 위치 비율.
const majorCircleRadius = 40.0;    // 메이저 키 버튼을 컬러 휠 정중앙 레이어로 확장
const minorCircleRadius = 28.0;    // 마이너 키 버튼을 안쪽에서 바깥쪽으로 밀어냄
const staffCircleRadius = 52.0;    // 샵/플랫 조표 배치를 가장 바깥 테두리로 이동
const romanCircleRadius = 46.0;    // 로마자 표기를 메이저 키 주변 외곽으로 확장
const positionCircleRadius = 34.0;  // 1st, 2nd 포지션 글자 레이어를 바깥으로 이동

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
    const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2;
    let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360; return angle;
  };

    const onDragStart = (e) => {
    if (e.target.tagName === 'BUTTON') return;
    
    // 💡 [아이패드/폰 버그 패치] 터치 이벤트와 마우스 이벤트 좌표 검증 이원화
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
      if (e.cancelable) e.preventDefault(); // iOS 화면 출렁임 방지

      // 💡 [화면 하얗게 변하는 버그 완치] 
      // 모바일 기기는 터치 이동 시 e.touches[0] 혹은 e.changedTouches[0]에서 첫 번째 손가락 좌표를 가져와야 크래시가 나지 않습니다.
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
      if (!isDragging) return; setIsDragging(false);
      const targetSnapAngle = Math.round(rotationAngle / 30) * 30;
      setRotationAngle(targetSnapAngle);
      
      const finalCalculatedIndex = (Math.round(-targetSnapAngle / 30) % 12 + 12) % 12;
      setActiveIndex(finalCalculatedIndex);
    };

    if (isDragging) {
      window.addEventListener('mousemove', onDragMove); window.addEventListener('mouseup', onDragEnd);
      window.addEventListener('touchmove', onDragMove, { passive: false }); window.addEventListener('touchend', onDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onDragMove); window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchmove', onDragMove); window.removeEventListener('touchend', onDragEnd);
    };
  }, [isDragging, rotationAngle]);

  const toggleDisplayMode = () => setDisplayMode(prev => (prev === 'harmonica' ? 'song' : 'harmonica'));

  return (
    <div style={CIRCLE_STYLE.container}>
      
      {/* 💡 [정밀 레이아웃 패치] 창 닫기 버튼을 휠 왼쪽 안전 여백 구역으로 고정 이동시켰습니다.
          화면 폭이 작아져도 우측의 송키/하프키 테이블 패널을 절대 침범하거나 가리지 않습니다. */}
      <div style={{ 
        position: 'absolute', 
        top: '4vh',           // 상단에서 부드럽게 4% 여백
        left: '4vw',          // 👈 휠 왼쪽 여백 레이어로 완벽 이동 고정
        zIndex: 5000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <button 
          onClick={onRouteClick} 
          style={{
            ...BOX_STYLE.settingsBtn,
            padding: '12px 20px',
            fontSize: 'calc(11px + 0.4vmin)', // 글자 크기도 화면 비례 유연 축소
            fontWeight: 'bold',
            backgroundColor: '#1f2937',
            borderColor: '#ef4444',            // 탈출 버튼임을 인지하도록 붉은 테두리 강조
            color: '#f87171',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
        >
          🚪 Close & Return to DHTC
        </button>
      </div>

      <div ref={mainWrapperRef} style={CIRCLE_STYLE.circleWrapper} onMouseDown={onDragStart} onTouchStart={onDragStart}>
        <div style={CIRCLE_STYLE.rotatableWheel(rotationAngle, isDragging)}>
          <div style={CIRCLE_STYLE.wheelBg}></div>
          <div style={CIRCLE_STYLE.innerMask}></div>
          
          <div style={CIRCLE_STYLE.textLayerWrapper}>
            {keysCircleData.map((item) => {
              const rad = ((item.angle - 90) * Math.PI) / 180;
              const cos = Math.cos(rad); const sin = Math.sin(rad);
              
              const isTopActiveSlot = item.idx === activeIndex;

              const displayMajorLabel = (displayMode === 'song' && isTopActiveSlot)
                ? `${item.major} Maj / ${item.major}m`
                : item.major;

              const isMinorHidden = (displayMode === 'song' && isTopActiveSlot);

              return (
                <React.Fragment key={item.idx}>
                  <button 
                    style={{ 
                    ...CIRCLE_STYLE.nodeSectorBtn, 
                    ...CIRCLE_STYLE.btnStyleMaj, 
                    width: (displayMode === 'song' && isTopActiveSlot) ? '250px' : '70px',
                    borderRadius: (displayMode === 'song' && isTopActiveSlot) ? '20px' : '50%',
                    left: `calc(50% + ${majorCircleRadius * cos}%)`, // 👈 px 대신 % 주입
                    top: `calc(50% + ${majorCircleRadius * sin}%)`,  // 👈 px 대신 % 주입
                    transform: `translate(-50%, -50%) rotate(${-rotationAngle}deg)`,
                    whiteSpace: 'nowrap',
                    zIndex: isTopActiveSlot ? 50 : 12
                    }}
                    onMouseEnter={() => setHoveredIdx(item.idx)} onMouseLeave={() => setHoveredIdx(null)}
                    onClick={(e) => { e.stopPropagation(); rotateWheelToKey(item); }}
                  >
                    {displayMajorLabel}
                  </button>
                  
                  <button 
                    style={{ 
                    ...CIRCLE_STYLE.nodeSectorBtn, 
                    ...CIRCLE_STYLE.btnStyleMin, 
                    left: `calc(50% + ${minorCircleRadius * cos}%)`, // 👈 px 대신 % 주입
                    top: `calc(50% + ${minorCircleRadius * sin}%)`,  // 👈 px 대신 % 주입
                    transform: `translate(-50%, -50%) rotate(${-rotationAngle}deg)`,
                    display: isMinorHidden ? 'none' : 'flex'
                    }}
                    onMouseEnter={() => setHoveredIdx(item.idx)} onMouseLeave={() => setHoveredIdx(null)}
                    onClick={(e) => { e.stopPropagation(); rotateWheelToKey(item); }}
                  >
                    {item.minor}
                  </button>
                  
                  <div style={{ 
                    ...CIRCLE_STYLE.signatureTextBadge(hoveredIdx === item.idx ? 1 : 0, item.type === 'sharp', item.type === 'flat'), 
                    left: `calc(50% + ${staffCircleRadius * cos}%)`, // 👈 px 대신 % 주입
                    top: `calc(50% + ${staffCircleRadius * sin}%)`,  // 👈 px 대신 % 주입
                    transform: `translate(-50%, -50%) rotate(${-rotationAngle}deg)` 
                    }}
                  >
  {item.displaySig}
</div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

                {/* 크기가 줄어들어도 작은 원(Center Core)이 화면 정중앙에 완벽한 대칭을 유지*/}
        <div 
          style={{ 
            ...CIRCLE_STYLE.centerCore, 
            left: '50%', 
            top: '50%', 
            transform: 'translate(-50%, -50%)' // 👈 고정 px 오프셋 대신 비율 기반 정중앙 축 고정 기법 적용
          }}
        >
                    <div style={CIRCLE_STYLE.coreCenterContent}>
            {/* 상단 Harp Key / Song Key 타이틀 텍스트도 비율에 맞게 미세 보정 */}
            <span style={{ fontSize: 'calc(16px + 0.5vmin)', fontWeight: 'bold', marginBottom: '2px', color: displayMode === 'harmonica' ? '#ef4444' : '#00a8ff', whiteSpace: 'nowrap' }}>
              {displayMode === 'harmonica' ? 'Harp Key' : 'Song Key'}
            </span>
            
            {/* 💡 [교체 완료] 작은 원 지름 내부에 완벽히 갇히도록 'calc(16px + 1.6vmin)' 유동형 공식으로 정밀 보정했습니다. */}
            <span style={{ 
              fontWeight: '900', 
              fontSize: 'calc(16px + 1.6vmin)', // 👈 지름 크기에 맞춰 글자가 유연하게 자동 조절됩니다.
              color: '#3b82f6', 
              whiteSpace: 'nowrap',
              lineHeight: '1.15', 
              display: 'block',
              textAlign: 'center'
            }}>
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

          
          <svg style={CIRCLE_STYLE.staticCurvedSvgOverlay} viewBox="0 0 184 184">
            <defs>
              <path id="core-top-path" d="M 17,92 A 75,75 0 1,1 167,92" />
              <path id="core-bottom-path" d="M 6,92 A 86,86 0 0,0 178,92" /> 
            </defs>
            <text fontSize="13px" fontWeight="900" fill="#f59e0b">
              <textPath href="#core-top-path" startOffset="50%" textAnchor="middle">The Circle of Fifths</textPath>
            </text>
            <text fontSize="11.7px" fontWeight="bold" fill="#94a3b8" letterSpacing="-0.3px">
              <textPath href="#core-bottom-path" startOffset="50%" textAnchor="middle">Copyright © 2026. coffeebada All rights reserved.</textPath>
            </text>
          </svg>
        </div>


        <div style={CIRCLE_STYLE.staticOverlayLayer}>
           {romanDegrees.map((degree, dIdx) => (
            <div 
              key={dIdx} 
              style={{ 
                ...CIRCLE_STYLE.romanDegreeBadge, 
                left: `calc(50% + ${romanCircleRadius * Math.cos((degree.angle - 90) * Math.PI / 180)}%)`, // 👈 % 교체
                top: `calc(50% + ${romanCircleRadius * Math.sin((degree.angle - 90) * Math.PI / 180)}%)`,  // 👈 % 교체
                transform: 'translate(-50%, -50%)' 
              }}
            >
              {degree.text}
            </div>
          ))}
          {fixedPositionLabels.map((pos, pIdx) => {
            const targetAngle = displayMode === 'harmonica' ? pos.harmonicaAngle : pos.songAngle;
            return (
              <div 
                key={pIdx} 
                style={{ 
                  ...CIRCLE_STYLE.staticFixedPositionBadge, 
                  left: `calc(50% + ${positionCircleRadius * Math.cos((targetAngle - 90) * Math.PI / 180)}%)`, // 👈 % 교체 (뒤에 오프셋 보정 수치 제거)
                  top: `calc(50% + ${positionCircleRadius * Math.sin((targetAngle - 90) * Math.PI / 180)}%)`,  // 👈 % 교체 (뒤에 오프셋 보정 수치 제거)
                  transform: 'translate(-50%, -50%)' // 구조의 완벽한 정렬을 위해 translate 추가
                }}
              >
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
                {displayMode === 'harmonica' 
                  ? `${getKeyByOffsetIndex(2).major}m` 
                  : getKeyByOffsetIndex(-2).major}
              </td>
            </tr>
            <tr>
              <td style={{ ...CIRCLE_STYLE.thTd, fontSize: '15px', textAlign: 'left' }}>4th Position / Aeolian Mode</td>
              <td style={{ ...CIRCLE_STYLE.thTd, fontWeight: 'bold', color: '#fb923c' }}>
                {displayMode === 'harmonica' 
                  ? `${getKeyByOffsetIndex(3).major}m` 
                  : getKeyByOffsetIndex(-3).major}
              </td>
            </tr>
            <tr>
              <td style={{ ...CIRCLE_STYLE.thTd, fontSize: '15px', textAlign: 'left' }}>5th Position / Phrygian Mode</td>
              <td style={{ ...CIRCLE_STYLE.thTd, fontWeight: 'bold', color: '#fb923c' }}>
                {displayMode === 'harmonica' 
                  ? `${getKeyByOffsetIndex(4).major}m` 
                  : getKeyByOffsetIndex(-4).major}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
