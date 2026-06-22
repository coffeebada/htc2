import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Play, Pause, Upload, Mic, Square, Download, Settings, X } from 'lucide-react';

// 🎯 5도권 12개 슬롯 배치 메타데이터 정의 (음악이론 기반 완전 정합)
const keysCircleData = [
  { idx: 0, major: "C",  minor: "Am",  roman: "I",   pos: "1st", angle: 0,   sharpFlat: "⚠️ Natural", type: "natural", displaySig: "♮" },
  { idx: 1, major: "G",  minor: "Em",  roman: "V",   pos: "2nd", angle: 30,  sharpFlat: "1 ♯", type: "sharp", displaySig: "1♯" },
  { idx: 2, major: "D",  minor: "Bm",  roman: "II",  pos: "3rd", angle: 60,  sharpFlat: "2 ♯", type: "sharp", displaySig: "2♯" },
  { idx: 3, major: "A",  minor: "F♯m", roman: "VI",  pos: "4th", angle: 90,  sharpFlat: "3 ♯", type: "sharp", displaySig: "3♯" },
  { idx: 4, major: "E",  minor: "C♯m", roman: "III", pos: "5th", angle: 120, sharpFlat: "4 ♯", type: "sharp", displaySig: "4♯" },
  { idx: 5, major: "B",  minor: "G♯m", roman: "VII", pos: "6th", angle: 150, sharpFlat: "5 ♯", type: "sharp", displaySig: "5♯" },
  { idx: 6, major: "G♭", minor: "E♭m", roman: "IV",  pos: "7th", angle: 180, sharpFlat: "6 ♭ / 6 ♯", type: "flat", displaySig: "6♭" },
  { idx: 7, major: "D♭", minor: "B♭m", roman: "I♭",  pos: "8th", angle: 210, sharpFlat: "5 ♭", type: "flat", displaySig: "5♭" },
  { idx: 8, major: "A♭", minor: "Fm",  roman: "V♭",  pos: "9th", angle: 240, sharpFlat: "4 ♭", type: "flat", displaySig: "4♭" },
  { idx: 9, major: "E♭", minor: "Cm",  roman: "II♭", pos: "10th", angle: 270, sharpFlat: "3 ♭", type: "flat", displaySig: "3♭" },
  { idx: 10, major: "B♭", minor: "Gm",  roman: "VI♭", pos: "11th", angle: 300, sharpFlat: "2 ♭", type: "flat", displaySig: "2♭" },
  { idx: 11, major: "F",  minor: "Dm",  roman: "III♭", pos: "12th", angle: 330, sharpFlat: "1 ♭", type: "flat", displaySig: "1♭" }
];

const romanDegrees = [
  { text: "I", angle: 0 },
  { text: "V", angle: 30 },
  { text: "IIm", angle: 60 },
  { text: "VIm", angle: 90 },
  { text: "IIIm", angle: 120 },
  { text: "VIIdim", angle: 150 },
  { text: "IV", angle: 330 }
];

// 🛠️ 하모니카-모드 표기 전용 힌트 레이블 정의
const fixedPositionLabels = [
  { text: "1st", harmonicaAngle: 0, songAngle: 0 },
  { text: "2nd", harmonicaAngle: 30, songAngle: -30 },
  { text: "12th", harmonicaAngle: -30, songAngle: 30 },
  { text: "3rd", harmonicaAngle: 60, songAngle: -60 },
  { text: "4th", harmonicaAngle: 90, songAngle: -90 },
  { text: "5th", harmonicaAngle: 120, songAngle: -120 }
];

const HARP_LAYOUT = {
  holes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  blow: [0, 4, 7, 12, 16, 19, 24, 28, 31, 36],
  draw: [2, 7, 11, 14, 17, 21, 23, 26, 29, 33],
  topSpecial: [3, 8, 12, 15, 18, 22, null, 27, 30, 35],
  bottomSpecials: [
    [1], [6, 5], [10, 9, 8], [13], [], [20], [25], [29], [32], [37]
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

const BOX_STYLE = {
  container: { backgroundColor: '#050a14', width: '1920px', height: '1080px', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', boxSizing: 'border-box', overflow: 'hidden', position: 'relative' },
  contentWrapper: { width: '1080px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' },
  selectBox: { background: '#1e293b', color: '#60a5fa', border: '2px solid #334155', borderRadius: '14px', padding: '8px 20px', fontSize: '20px', fontWeight: '900', outline: 'none' },
  micBtn: { padding: '12px 24px', borderRadius: '14px', color: 'white', fontWeight: 'bold', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' },
  settingsBtn: { backgroundColor: '#1f2937', color: 'white', padding: '12px 20px', borderRadius: '14px', cursor: 'pointer', border: '1px solid #374151', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' },
  circleBtn: { backgroundColor: '#4f46e5', color: 'white', padding: '12px 20px', borderRadius: '14px', cursor: 'pointer', border: 'none', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center' },
  gridContainer: { display: 'flex', gap: '8px', padding: '10px 0', width: '100%', justifyContent: 'space-between', marginBottom: '25px', boxSizing: 'border-box' },
  holeNumber: { width: '90px', height: '60px', border: '2px solid #475569', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '26px', color: '#94a3b8', backgroundColor: '#1e293b', margin: '8px 0', userSelect: 'none' }
};

const DASHBOARD_STYLE = {
  inlineDashboard: { width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '55px', backgroundColor: '#111827', padding: '16px', borderRadius: '24px', border: '1px solid #374151', boxSizing: 'border-box' },
  controlBox: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#1f2937', padding: '12px 18px', borderRadius: '18px', border: '1px solid #374151', minWidth: 0, boxSizing: 'border-box', width: '100%', height: '70px' },
  playBtn: { border: 'none', backgroundColor: '#22c55e', color: 'white', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '3px' }
};

const MODAL_STYLE = {
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
  modalContent: { backgroundColor: '#111827', width: '480px', borderRadius: '24px', padding: '35px', border: '1px solid #374151', color: 'white' },
  saveBtn: { width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: '#10b981', color: 'black', fontWeight: '900', fontSize: '18px', cursor: 'pointer', marginTop: '12px' }
};

const CIRCLE_STYLE = {
  container: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '80px', width: '1920px', height: '1080px', boxSizing: 'border-box', backgroundColor: '#050a14', color: 'white', fontFamily: 'sans-serif' },
  circleWrapper: { position: 'relative', width: '920px', height: '920px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  rotatableWheel: (angle, isDragging) => ({ position: 'absolute', width: '740px', height: '740px', borderRadius: '50%', zIndex: 10, transform: `rotate(${angle}deg)`, cursor: isDragging ? 'grabbing' : 'grab', overflow: 'visible', transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)' }),
  wheelBg: { width: '100%', height: '100%', borderRadius: '50%', position: 'absolute', background: 'conic-gradient(#e51c23 0deg 30deg, #f57c00 30deg 60deg, #ffb74d 60deg 90deg, #fdd835 90deg 120deg, #aeea00 120deg 150deg, #4caf50 150deg 180deg, #00b0ff 180deg 210deg, #00e5ff 210deg 240deg, #2979ff 240deg 270deg, #3f51b5 270deg 300deg, #673ab7 300deg 330deg, #e91e63 330deg 360deg)', transform: 'rotate(-15deg)', zIndex: 1 },
  innerMask: { position: 'absolute', width: '448px', height: '448px', backgroundColor: '#050a14', borderRadius: '50%', top: '146px', left: '146px', zIndex: 2, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.45)' }, 
  centerCore: { position: 'absolute', width: '180px', height: '180px', backgroundColor: '#111827', borderRadius: '50%', zIndex: 30, border: '2px solid #374151', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', overflow: 'visible' },
  coreCenterContent: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 35, textAlign: 'center', width: '170px' },
  staticCurvedSvgOverlay: { position: 'absolute', top: '-2px', left: '-2px', width: '184px', height: '184px', zIndex: 32 },
  textLayerWrapper: { position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 5 },
  nodeSectorBtn: { position: 'absolute', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, margin: 0, zIndex: 12 },
  btnStyleMaj: { width: '70px', height: '50px', fontSize: '30px', fontWeight: '900', color: '#ffffff', textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, -2px -1px 0 #000, 2px 1px 0 #000, 0px -2px 0 #000, 0px 2px 0 #000, 0px 3px 5px rgba(0,0,0,0.9)' },
  btnStyleMin: { width: '60px', height: '40px', fontSize: '18px', fontWeight: '800', color: '#a3b8cc', textShadow: '0px 1px 3px rgba(0,0,0,0.8)' },
  signatureTextBadge: (opacity, isSharp, isFlat) => ({ position: 'absolute', zIndex: 11, fontSize: opacity === 1 ? '34px' : '28px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: opacity, color: isSharp ? '#ef4444' : (isFlat ? '#3b82f6' : '#64748b'), transition: 'opacity 0.15s ease, transform 0.4s' }),
  
  // 🌟 [수정 완료]: 가독성을 해치는 그림자(textShadow) 효과를 완벽 지우고 나란한조 글씨체 톤 테마(#a3b8cc) 일체화
  romanDegreeBadge: { position: 'absolute', zIndex: 8, fontSize: '26px', fontWeight: '900', color: '#a3b8cc', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  
  staticOverlayLayer: { position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 20, pointerEvents: 'none' },
  staticFixedPositionBadge: { position: 'absolute', zIndex: 25, width: '380px', height: '30px', fontSize: '18px', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', textShadow: '0px 2px 4px rgba(0, 0, 0, 0.65)' },
  tablePanel: { width: '520px' }, // 모드 이름이 늘어남에 따른 표 가로 확장 폭 마진 보정
  clickablePanelTitle: { fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #374151', padding: '0 16px', borderRadius: '12px', backgroundColor: '#111827', height: '55px', border: '1px solid #374151', boxSizing: 'border-box', cursor: 'pointer' },
  dynamicTitleValue: (isBlue) => ({ fontSize: '22px', fontWeight: '900', letterSpacing: '-0.3px', color: isBlue ? '#3b82f6' : '#10b981' }),
  table: { width: '100%', borderCollapse: 'collapse', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' },
  thTd: { border: '1px solid #374151', padding: '16px 14px', textAlign: 'center', fontSize: '18px', color: '#cbd5e1' },
  headerTheme: (isGreen) => ({ backgroundColor: isGreen ? '#10b981' : '#2563eb', color: 'white', fontWeight: 'bold', fontSize: '20px' }),
  bgGray: { backgroundColor: '#1f2937', fontWeight: 'bold', fontSize: '18px', color: '#94a3b8' }
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
    shifter.current = new Tone.PitchShift(0).connect(mrGain.current);

    stdVerb.current = new Tone.Reverb({ decay: 2.5, wet: 0 }).connect(mixedBus.current);
    springSlap.current = new Tone.FeedbackDelay({ delayTime: "32n", feedback: 0.2, wet: 0 });
    toneFilter.current = new Tone.Filter(4500, "highpass");
    springVerb.current = new Tone.Reverb({ decay: 3.5, wet: 0 }).connect(mixedBus.current);

    springSlap.current.chain(toneFilter.current, springVerb.current);

    micGain.current = new Tone.Gain(micVolume).connect(mixedBus.current);
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
      await Tone.start();
      if (!micInput.current) {
        micInput.current = new Tone.UserMedia();
        await micInput.current.open();
        analyser.current = Tone.getContext().createAnalyser();
        analyser.current.fftSize = 2048;
        micInput.current.connect(analyser.current);
        micInput.current.connect(micGain.current);
      }
      setIsListening(true);
      isListeningRef.current = true;

      const updateLoop = () => {
        if (!analyser.current || !isListeningRef.current) return;
        const buf = new Float32Array(2048);
        analyser.current.getFloatTimeDomainData(buf);
        const freq = autoCorrelate(buf, Tone.getContext().sampleRate);

        if (freq !== -1) {
          const n = 12 * Math.log2(freq / baseFreq) + 69;
          const roundedN = Math.round(n);
          const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
          const detectedNoteName = names[roundedN % 12] + (Math.floor(roundedN / 12) - 1);

          setActiveNote(detectedNoteName);
          setCentsOff(Math.floor((n - roundedN) * 100));
        } else {
          if (!synth.current || synth.current.envelope.value === 0) setActiveNote(null);
        }
        animationFrameRef.current = requestAnimationFrame(updateLoop);
      };
      updateLoop();
    } catch (err) { alert("Mic access denied."); }
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
    if (Math.sqrt(rms / SIZE) < 0.01) return -1;

    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
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
    return sampleRate / maxpos;
  }

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const targetFile = files; 
      setFileName(targetFile.name);
      const url = URL.createObjectURL(targetFile);
      if (trackPlayer.current) trackPlayer.current.dispose();
      trackPlayer.current = new Tone.Player({ url, fadeIn: 0.1, fadeOut: 0.1 }).connect(shifter.current);
    }
  };

  const toggleTrack = async () => {
    if (!trackPlayer.current) return alert("Upload MR file first!");
    await Tone.start();
    if (isPlaying) { trackPlayer.current.stop(); setIsPlaying(false); }
    else { trackPlayer.current.start(); setIsPlaying(true); }
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
   return (
    <div style={BOX_STYLE.container}>
      <div style={BOX_STYLE.contentWrapper}>

        {/* 상단 버튼 그룹 */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#94a3b8' }}>Harp Key</span>
            <select style={BOX_STYLE.selectBox} value={currentKey} onChange={(e) => setCurrentKey(e.target.value)}>
              {!isLowKey ? Object.keys(standardKeys).map(k => <option key={k} value={k}>{k}</option>) : Object.keys(lowKeys).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            
            <button onClick={() => window.open('#/circle-of-fifths', '_blank')} style={BOX_STYLE.circleBtn}>
              The Circle of Fifths
            </button>
          </div>

          <button onClick={isListening ? stopMic : startMic} style={{...BOX_STYLE.micBtn, backgroundColor: isListening ? '#ef4444' : '#2563eb'}}>
            <Mic size={22} /> {isListening ? 'MIC ACTIVE' : 'START MIC'}
          </button>

          <button onClick={() => setShowSettings(true)} style={BOX_STYLE.settingsBtn}>
            <Settings size={22} /> Settings
          </button>
        </div>

        {/* 메인 하모니카 그리드 레이아웃 */}
        <div style={BOX_STYLE.gridContainer}>
          {HARP_LAYOUT.holes.map((h, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {h === 10 ? (
                <NoteBox semi={46} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} isTopBb={true} showOverbanding={showOverbanding} />
              ) : (
                <div style={{ height: '90px', width: '90px', margin: '3px 0' }}></div>
              )}

              <NoteBox semi={HARP_LAYOUT.topSpecial[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} isBlowZone={true} holeNum={h} showOverbanding={showOverbanding} />
              <NoteBox semi={HARP_LAYOUT.blow[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} />
              <div style={BOX_STYLE.holeNumber}>{h}</div>
              <NoteBox semi={HARP_LAYOUT.draw[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} />

              <div style={{ display: 'flex', flexDirection: 'column', minHeight: '280px', gap: '4px' }}>
                {HARP_LAYOUT.bottomSpecials[i].map((semiVal, sIdx) => (
                  <NoteBox key={sIdx} semi={semiVal} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} isDrawZone={true} holeNum={h} showOverbanding={showOverbanding} />
                ))}
              </div>

              {h === 10 && (
                <div style={{ position: 'absolute', bottom: '-5px', right: '0px', width: '650px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', pointerEvents: 'none', zIndex: 10, fontFamily: 'sans-serif', lineHeight: '1.4' }}>
                  <div style={{ fontSize: '38px', fontWeight: '900', color: '#10b981', marginBottom: '18px', letterSpacing: '-0.5px' }}>
                    Harmonica Training Room
                  </div>
                  <div style={{ color: '#475569', fontSize: '14px', fontWeight: '600' }}>
                    Copyright ⓒ 2026 CoffeeBada Lee, Choong-Koo All Rights Reserved.
                  </div>
                  <div style={{ color: '#64748b', fontSize: '14px', fontWeight: '600', marginTop: '2px' }}>
                    Contact : 279.lee@gmail.com
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 오디오 대시보드 */}
        <div style={DASHBOARD_STYLE.inlineDashboard}>
          <div style={DASHBOARD_STYLE.controlBox}>
            <label style={{ cursor: 'pointer', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexShrink: 0 }}>
              <Upload size={22} />
              <span style={{ fontSize: '14px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>{fileName}</span>
              <input type="file" onChange={handleFileUpload} hidden accept="audio/*" />
            </label>
            <button onClick={toggleTrack} style={DASHBOARD_STYLE.playBtn}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <div style={{ flex: 1, minWidth: 0, marginLeft: '8px' }}>
              <span style={DASHBOARD_STYLE.label}>MR VOL</span>
              <input type="range" min="0" max="1" step="0.01" value={mrVolume} onChange={(e) => setMrVolume(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
          
          <div style={DASHBOARD_STYLE.controlBox}>
            <button onClick={toggleRecording} style={{ ...DASHBOARD_STYLE.playBtn, backgroundColor: isRecording ? '#ef4444' : '#374151' }}>
              {isRecording ? <Square size={16} /> : <Mic size={16} />}
            </button>
            <button onClick={toggleRecordedPlayback} disabled={!recordedUrl} style={{ ...DASHBOARD_STYLE.playBtn, backgroundColor: recordedUrl ? '#3b82f6' : '#4b5563', cursor: recordedUrl ? 'pointer' : 'not-allowed' }}>
              {isRecordedPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: '6px' }}>
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

          <div style={DASHBOARD_STYLE.controlBox}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={DASHBOARD_STYLE.label}>MIC VOL</span>
              <input type="range" min="0" max="1" step="0.01" value={micVolume} onChange={(e) => setMrVolume(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0, marginLeft: '10px' }}>
              <span style={DASHBOARD_STYLE.label}>SYNTH VOL</span>
              <input type="range" min="0" max="1" step="0.01" value={synthVolume} onChange={(e) => setSynthVolume(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* 설정 모달 */}
        {showSettings && (
          <div style={MODAL_STYLE.modalOverlay}>
            <div style={MODAL_STYLE.modalContent}>
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#1f2937', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #374151' }}>
                <span style={{ fontSize: '15px', color: '#cbd5e1', fontWeight: 'bold' }}>Harmonica Low Key</span>
                <button onClick={() => { const nm = !isLowKey; setIsLowKey(nm); setCurrentKey(nm ? 'LF' : 'C'); }} style={{ padding: '8px 18px', backgroundColor: isLowKey ? '#10b981' : '#4b5563', border: 'none', color: isLowKey ? 'black' : 'white', borderRadius: '8px', fontWeight: '900', cursor: 'pointer' }}>
                  {isLowKey ? 'ON' : 'OFF'}
                </button>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '15px', color: '#94a3b8' }}>Standard Pitch: A={baseFreq}Hz</span>
                <input type="range" min="430" max="450" step="1" value={baseFreq} onChange={(e) => setBaseFreq(parseInt(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '15px', color: '#94a3b8' }}>Tolerance (±{tolerance}c)</span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '5px' }}>
                  {['5', '10', '15', '20'].map(val => <button key={val} onClick={() => setTolerance(parseInt(val))} style={{ flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', backgroundColor: tolerance === parseInt(val) ? '#10b981' : '#374151', color: 'white', cursor: 'pointer', fontSize: '14px' }}>±{val}</button>)}
                </div>
              </div>
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#1f2937', borderRadius: '12px', border: '1px solid #374151' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '15px', color: '#94a3b8' }}>Reverb Type</span>
                  <div>{['standard', 'spring'].map(m => <button key={m} onClick={() => setReverbMode(m)} style={{ padding: '6px 10px', marginLeft: '6px', backgroundColor: m === reverbMode ? '#10b981' : '#374151', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{m.toUpperCase()}</button>)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', color: '#cbd5e1', fontWeight: 'bold' }}>Reverb Power</span>
                  <button onClick={() => setUseReverb(!useReverb)} style={{ padding: '8px 18px', backgroundColor: useReverb ? '#10b981' : '#ef4444', border: 'none', color: useReverb ? 'black' : 'white', borderRadius: '8px', fontWeight: '900', cursor: 'pointer' }}>
                    {useReverb ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} style={MODAL_STYLE.saveBtn}>SAVE & CLOSE</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteBox({ semi, getNote, activeNote, cents, limit, onStart, onStop, isBlowZone, isDrawZone, isTopBb, holeNum, showOverbanding }) {
  const noteName = getNote(semi);
  if (semi === null || !noteName) return <div style={{ height: '90px', width: '90px', margin: '3px 0' }}></div>;
  const isActive = activeNote === noteName;
  const displayLabel = noteName.replace(/\d+/g, '');
  const safeCents = Math.max(-limit, Math.min(limit, cents));
  const indicatorLeft = 50 + (safeCents / limit) * 40;
  const isOverblowCell = isBlowZone && (holeNum >= 1 && holeNum <= 6);
  const isOverdrawCell = isDrawZone && (holeNum >= 7 && holeNum <= 10) && (semi === 25 || semi === 29 || semi === 32 || semi === 37);
  const hideContent = !showOverbanding && (isOverblowCell || isOverdrawCell);
  let bgColor = '#1e293b'; let borderStyle = '1px solid #334155';
  if (isActive && !hideContent) { bgColor = Math.abs(cents) <= limit ? '#22c55e' : (cents > limit ? '#eab308' : '#ef4444'); }
  else if (hideContent) { bgColor = 'transparent'; borderStyle = '1px solid transparent'; }
  else { if (isTopBb) bgColor = '#93c5fd'; else if (isOverblowCell) bgColor = '#fca5a5'; else if (isBlowZone) bgColor = '#93c5fd'; else if (isDrawZone) bgColor = (holeNum >= 7 && holeNum <= 10) ? '#f59e0b' : '#93c5fd'; }
  return (
    <div style={{ width: '90px', height: '90px', margin: '3px 0', borderRadius: '14px', border: borderStyle, backgroundColor: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', cursor: hideContent ? 'default' : 'pointer', userSelect: 'none' }} onMouseDown={() => !hideContent && onStart(noteName)} onMouseUp={onStop} onMouseLeave={onStop}>
      <span style={{ fontWeight: '900', fontSize: '24px', color: hideContent ? 'transparent' : 'white', zIndex: 10 }}>{displayLabel}</span>
      {isActive && !hideContent && <div style={{ position: 'absolute', left: `${indicatorLeft}%`, width: '4px', height: '100%', backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 5 }} />}
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

  const majorCircleRadius = 298.0; const minorCircleRadius = 181.0;
  const staffCircleRadius = 412.0; const romanCircleRadius = 345.0; const positionCircleRadius = 245.5;

  const currentSelectedKey = keysCircleData[activeIndex];

  // 🛠️ 5도권 링 상의 상대 오프셋 인덱스를 안전하게 계산하는 래퍼 함수
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
    const clientX = e.clientX || (e.touches && e.touches.clientX);
    const clientY = e.clientY || (e.touches && e.touches.clientY);
    setIsDragging(true);
    dragStartAngle.current = getMouseAngle(clientX, clientY);
    baseRotationOnDragStart.current = rotationAngle;
  };

  useEffect(() => {
    const onDragMove = (e) => {
      if (!isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches.clientX);
      const clientY = e.clientY || (e.touches && e.touches.clientY);
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
      <div style={{ position: 'absolute', top: '30px', left: '420px', zIndex: 5000 }}>
        <button onClick={onRouteClick} style={BOX_STYLE.settingsBtn}>Close & Return</button>
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

              // 12시 방향일 때 메이저 노드 "C Maj / Cm" 형태로 완전 결합
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
                      left: `calc(50% + ${majorCircleRadius * cos}px)`, 
                      top: `calc(50% + ${majorCircleRadius * sin}px)`, 
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
                      left: `calc(50% + ${minorCircleRadius * cos}px)`, 
                      top: `calc(50% + ${minorCircleRadius * sin}px)`, 
                      transform: `translate(-50%, -50%) rotate(${-rotationAngle}deg)`,
                      display: isMinorHidden ? 'none' : 'flex'
                    }}
                    onMouseEnter={() => setHoveredIdx(item.idx)} onMouseLeave={() => setHoveredIdx(null)}
                    onClick={(e) => { e.stopPropagation(); rotateWheelToKey(item); }}
                  >
                    {item.minor}
                  </button>
                  
                  <div style={{ ...CIRCLE_STYLE.signatureTextBadge(hoveredIdx === item.idx ? 1 : 0, item.type === 'sharp', item.type === 'flat'), left: `calc(50% + ${staffCircleRadius * cos}px)`, top: `calc(50% + ${staffCircleRadius * sin}px)`, transform: `translate(-50%, -50%) rotate(${-rotationAngle}deg)` }}>
                    {item.displaySig}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div style={{ ...CIRCLE_STYLE.centerCore, left: 'calc(50% - 90px)', top: 'calc(50% - 90px)' }}>
          <div style={CIRCLE_STYLE.coreCenterContent}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: displayMode === 'harmonica' ? '#ef4444' : '#00a8ff' }}>
              {displayMode === 'harmonica' ? 'Harp Key' : 'Song Key'}
            </span>
            <span style={{ fontWeight: '900', fontSize: displayMode === 'harmonica' ? '39px' : '20px', color: '#3b82f6' }}>
              {displayMode === 'harmonica' ? currentSelectedKey.major : `${currentSelectedKey.major} Maj / ${currentSelectedKey.major}m`}
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
            <div key={dIdx} style={{ ...CIRCLE_STYLE.romanDegreeBadge, left: `calc(50% + ${romanCircleRadius * Math.cos((degree.angle - 90) * Math.PI / 180)}px)`, top: `calc(50% + ${romanCircleRadius * Math.sin((degree.angle - 90) * Math.PI / 180)}px)`, transform: 'translate(-50%, -50%)' }}>
              {degree.text}
            </div>
          ))}
          {fixedPositionLabels.map((pos, pIdx) => {
            const targetAngle = displayMode === 'harmonica' ? pos.harmonicaAngle : pos.songAngle;
            return (
              <div key={pIdx} style={{ ...CIRCLE_STYLE.staticFixedPositionBadge, left: `calc(50% + ${positionCircleRadius * Math.cos((targetAngle - 90) * Math.PI / 180)}px - 190px)`, top: `calc(50% + ${positionCircleRadius * Math.sin((targetAngle - 90) * Math.PI / 180)}px - 15px)` }}>
                {pos.text}
              </div>
            );
          })}
        </div>
      </div>

      {/* 우측 포지션 정보 테이블 패널 */}
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
            {/* 🛠️ [요청 반영 완료]: 모드 레이블 명칭 수정 및 도수 정밀 수학적 연산 매핑 연동 */}
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
              {/* 🎯 3rd 포지션 = 2도m (5도권 시계방향으로 2칸 전진한 Major 키의 마이너 포맷 추출) */}
              <td style={{ ...CIRCLE_STYLE.thTd, fontWeight: 'bold', color: '#fb923c' }}>{getKeyByOffsetIndex(2).major}m</td>
            </tr>
            <tr>
              <td style={{ ...CIRCLE_STYLE.thTd, fontSize: '15px', textAlign: 'left' }}>4th Position / Aeolian Mode</td>
              {/* 🎯 4th 포지션 = 6도m (5도권 시계방향으로 3칸 전진한 Major 키의 마이너 포맷 추출) */}
              <td style={{ ...CIRCLE_STYLE.thTd, fontWeight: 'bold', color: '#fb923c' }}>{getKeyByOffsetIndex(3).major}m</td>
            </tr>
            <tr>
              <td style={{ ...CIRCLE_STYLE.thTd, fontSize: '15px', textAlign: 'left' }}>5th Position / Phrygian Mode</td>
              {/* 🎯 5th 포지션 = 3도m (5도권 시계방향으로 4칸 전진한 Major 키의 마이너 포맷 추출) */}
              <td style={{ ...CIRCLE_STYLE.thTd, fontWeight: 'bold', color: '#fb923c' }}>{getKeyByOffsetIndex(4).major}m</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
