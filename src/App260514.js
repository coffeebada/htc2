import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import {
  Play, Pause, Upload, ChevronUp, ChevronDown, Mic, Square,
  Download, Settings, X, Music
} from 'lucide-react';

const standardKeys = {
  'G': { semi: 7, oct: 3 }, 'Ab': { semi: 8, oct: 3 }, 'A': { semi: 9, oct: 3 },
  'Bb': { semi: 10, oct: 3 }, 'B': { semi: 11, oct: 3 }, 'C': { semi: 0, oct: 4 },
  'Db': { semi: 1, oct: 4 }, 'D': { semi: 2, oct: 4 }, 'Eb': { semi: 3, oct: 4 },
  'E': { semi: 4, oct: 4 }, 'F': { semi: 5, oct: 4 }, 'Gb': { semi: 6, oct: 4 },
  'High G': { semi: 7, oct: 4 }
};

const lowKeys = {
  'LF': { semi: 5, oct: 3 }, 'LE': { semi: 4, oct: 3 }, 'LEb': { semi: 3, oct: 3 },
  'LD': { semi: 2, oct: 3 }, 'LDb': { semi: 1, oct: 3 }, 'LC': { semi: 0, oct: 3 },
  'LB': { semi: 11, oct: 2 }, 'LBb': { semi: 10, oct: 2 }, 'LA': { semi: 9, oct: 2 },
  'LAb': { semi: 8, oct: 2 }, 'LG': { semi: 7, oct: 2 }, 'LGb': { semi: 6, oct: 2 },
  'LLF': { semi: 5, oct: 2 }
};

export default function App() {
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
  const [mrVolume, setMrVolume] = useState(0.8);
  const [micVolume, setMicVolume] = useState(0.8);
  const [synthVolume, setSynthVolume] = useState(0.5);
  const [useReverb, setUseReverb] = useState(true);
  const [reverbMode, setReverbMode] = useState('standard');
  const [reverbWet, setReverbWet] = useState(0.3);
  const [recordings, setRecordings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

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

  // 🎯 [누락 복구] 누락되었던 핵심 레이아웃 구조와 음정 연동 로직을 빈틈없이 재생성했습니다.
  const layoutData = {
    holes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    blow: [0, 4, 7, 12, 16, 19, 24, 28, 31, 36],       // C4 E4 G4 C5 E5 G5 C6 E6 G6 C7
    draw: [2, 7, 11, 14, 17, 21, 23, 26, 29, 33],       // D4 G4 B4 D5 F5 A5 B5 D6 F6 A6
    overBlow: [3, 8, 12, 15, 18, 22, null, 28, 31, 38], // Eb4 Ab4 C5 Eb5 Gb5 Bb5 / Eb6 Gb6 B6
    bends: [
      [-1],           // 1번홀: Db4 (총 2칸)
      [-1, -2],       // 2번홀: Gb4, F4 (총 3칸)
      [-1, -2, -3],   // 3번홀: Bb4, A4, Ab4 (총 4칸)
      [-1],           // 4번홀: Db5 (총 2칸)
      [],             // 5번홀: 공란 (총 1칸)
      [-2],           // 6번홀: Ab5 (총 2칸)
      [-1],           // 7번홀: Db6 (총 2칸)
      [1],            // 8번홀 마시는 파트: Eb6 오버드로우 추가 (총 2칸)
      [1],            // 9번홀 마시는 파트: Gb6 오버드로우 추가 (총 2칸)
      [2]             // 10번홀 마시는 파트: B6 오버드로우 추가 (총 2칸)
    ]
  };

  const topSpecialSemi = 46;

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
    micGain.current = new Tone.Gain(micVolume);
    micGain.current.connect(stdVerb.current);
    micGain.current.connect(springSlap.current);
    synthGain.current = new Tone.Gain(synthVolume).connect(mixedBus.current);
    return () => { synth.current?.dispose(); trackPlayer.current?.dispose(); };
  }, []);

  useEffect(() => {
    if (!stdVerb.current || !springVerb.current) return;
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
      synth.current = new Tone.MonoSynth({ oscillator: { type: "triangle8" } });
      synth.current.connect(synthGain.current);
    }
    synth.current.triggerAttack(note);
    setActiveNote(note);
  };

  const handleNoteStop = () => { if (synth.current) synth.current.triggerRelease(); if (!isListening) setActiveNote(null); };

  const startMic = async () => {
    try {
      await Tone.start();
      if (!micInput.current) {
        micInput.current = new Tone.UserMedia();
        await micInput.current.open();
        analyser.current = Tone.getContext().createAnalyser();
        micInput.current.connect(analyser.current);
        micInput.current.connect(micGain.current);
      }
      setIsListening(true);
      const updateLoop = () => {
        if (!analyser.current || !isListening) return;
        const buf = new Float32Array(2048);
        analyser.current.getFloatTimeDomainData(buf);
        const freq = autoCorrelate(buf, Tone.getContext().sampleRate);
        if (freq !== -1) {
          const n = 12 * (Math.log2(freq / (baseFreq * Math.pow(2, -4.75)))) + 0;
          const roundedN = Math.round(n);
          const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
          setActiveNote(names[((roundedN % 12) + 12) % 12] + Math.floor(roundedN / 12));
          setCentsOff(Math.floor((n - roundedN) * 100));
        } else { setActiveNote(null); }
        requestAnimationFrame(updateLoop);
      };
      updateLoop();
    } catch (err) { alert("Mic access denied."); }
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
    for (let i = 0; i < sliced.length; i++) for (let j = 0; j < sliced.length - i; j++) c[i] = c[i] + sliced[j] * sliced[j + i];
    let d = 0; while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < sliced.length; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    return sampleRate / maxpos;
  }

  const handleFileUpload = (e) => {
    const file = e.target.files;
    if (file) {
      setFileName(file.name);
      const url = URL.createObjectURL(file);
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

  const styles = {
    container: { backgroundColor: '#050a14', minHeight: '100vh', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', fontFamily: 'sans-serif', overflow: 'hidden' },
    contentWrapper: { width: '98%', maxWidth: '1400px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' },
    gridContainer: { display: 'flex', gap: '1.7vw', padding: '20px 0', width: '100%', justifyContent: 'center', flexWrap: 'nowrap', position: 'relative' },
    bottomDashboard: { position: 'fixed', bottom: '10px', width: '98%', maxWidth: '1200px', backgroundColor: '#111827', borderRadius: '20px', border: '1px solid #374151', padding: '12px 15px', zIndex: 1000, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', boxShadow: '0 -10px 25px rgba(0,0,0,0.5)' },
    controlBox: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1f2937', padding: '10px 15px', borderRadius: '18px', border: '1px solid #374151' },
    label: { fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '2px' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
    modalContent: { backgroundColor: '#111827', width: '90%', maxWidth: '480px', borderRadius: '24px', padding: '30px', border: '1px solid #374151' },
    mainSelect: { background: '#1e293b', color: '#60a5fa', border: '2px solid #334155', borderRadius: '12px', padding: '8px 24px', fontSize: '22px', fontWeight: '900', cursor: 'pointer', outline: 'none', textAlign: 'center' },
    keyLabel: { fontSize: '20px', fontWeight: 'bold', color: '#94a3b8', marginRight: '12px' },
    cell: (isActive, cents, limit) => ({
      width: 'calc(9.5vw - 8px)', maxWidth: '75px', height: 'calc(9.5vw - 8px)', maxHeight: '75px', margin: '2px 0', borderRadius: '12px', border: '1px solid #334155',
      backgroundColor: isActive ? (Math.abs(cents) <= limit ? '#22c55e' : (cents > limit ? '#eab308' : '#ef4444')) : '#1e293b',
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: '0.1s ease', flexShrink: 0
    }),
    holeNumber: { width: 'calc(9.5vw - 8px)', maxWidth: '75px', height: 'calc(11vw - 8px)', maxHeight: '90px', border: '2px solid #475569', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#94a3b8', fontSize: 'min(20px, 3.5vw)', margin: '6px 0', backgroundColor: '#1e293b', flexShrink: 0 },
    copyright: { position: 'absolute', bottom: '20px', right: '0', textAlign: 'right', opacity: 0.3, pointerEvents: 'none', width: 'auto', paddingRight: '15px' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.contentWrapper}>
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <h1 style={{ fontSize: 'min(38px, 7vw)', fontWeight: '900', color: '#10b981', margin: '0 0 5px 0', letterSpacing: '-1px' }}>Harmonica Training Room</h1>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={styles.keyLabel}>Harp Key</span>
            <select style={styles.mainSelect} value={currentKey} onChange={(e) => setCurrentKey(e.target.value)}>
              {!isLowKey ? (
                Object.keys(standardKeys).map(k => <option key={k} value={k}>{k}</option>)
              ) : (
                Object.keys(lowKeys).map(k => <option key={k} value={k}>{k}</option>)
              )}
            </select>
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '20px', padding: '0 10px' }}>
          <button onClick={startMic} style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', backgroundColor: isListening ? '#065f46' : '#2563eb', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', cursor: 'pointer' }}>
            <Mic size={20} /> {isListening ? 'MIC ACTIVE' : 'START MIC'}
          </button>
          <button onClick={() => setShowSettings(true)} style={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: 'white', padding: '10px 15px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={22} /> <span style={{fontWeight:'bold'}}>Settings</span>
          </button>
        </div>

        <div style={styles.gridContainer}>
          {layoutData.holes.map((h, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>

              {/* 10번 홀 최상단 Bb 칸 정밀 매핑 */}
              {h === 10 ? (
                <NoteBox semi={topSpecialSemi} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} styles={styles} />
              ) : (
                <div style={{ height: 'calc(9.5vw - 8px)', width: 'calc(9.5vw - 8px)', maxWidth: '75px', maxHeight: '75px', margin: '2px 0' }}></div>
              )}

              <NoteBox semi={layoutData.overBlow[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} styles={styles} />
              <NoteBox semi={layoutData.blow[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} styles={styles} />
              <div style={styles.holeNumber}>{h}</div>
              <NoteBox semi={layoutData.draw[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} styles={styles} />

              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'min(120px, 15vw)' }}>
                {layoutData.bends[i].map((b, bi) => <NoteBox key={bi} semi={layoutData.draw[i] + b} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} styles={styles} />)}
              </div>
            </div>
          ))}
          <div style={styles.copyright}>
            <div style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 'bold', lineHeight: '1.4' }}>
              CoffeeBada 2026 (Lee, Choong-Koo 279.lee@gmail.com)<br/> All Rights Reserved - International Copyright Secured
            </div>
          </div>
        </div>
      </div>

      <div style={styles.bottomDashboard}>
        <div style={styles.controlBox}>
          <label style={{ cursor: 'pointer', color: '#60a5fa' }}><Upload size={22} /><input type="file" onChange={handleFileUpload} hidden accept="audio/*" /></label>
          <button onClick={toggleTrack} style={{ border: 'none', backgroundColor: isPlaying ? '#ef4444' : '#22c55e', color: 'white', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer' }}>
            {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
          </button>
          <div style={{flex: 1}}><span style={styles.label}>MR VOL</span><input type="range" min="0" max="1" step="0.01" value={mrVolume} onChange={(e) => setMrVolume(parseFloat(e.target.value))} style={{width:'100%'}} /></div>
        </div>

        <div style={{...styles.controlBox, justifyContent: 'center', gap: '5px'}}>
          <button onClick={isRecording ? async () => { const rec = await recorder.current.stop(); setRecordings([{id: Date.now(), url: URL.createObjectURL(rec)}, ...recordings]); setIsRecording(false); } : () => { Tone.start(); recorder.current.start(); setIsRecording(true); }}
                  style={{ backgroundColor: isRecording ? '#ef4444' : '#374151', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '12px', fontWeight: '900', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            {isRecording ? <Square size={14} fill="white" /> : <Mic size={14} />} {isRecording ? "STOP" : "MIX REC"}
          </button>
          {recordings.length > 0 && <a href={recordings.url} download="session.wav" style={{color: '#10b981'}}><Download size={22}/></a>}
        </div>

        <div style={styles.controlBox}>
          <Mic size={20} color="#94a3b8" />
          <div style={{flex: 1}}><span style={styles.label}>MIC VOL</span><input type="range" min="0" max="1" step="0.01" value={micVolume} onChange={(e) => setMicVolume(parseFloat(e.target.value))} style={{width:'100%'}} /></div>
          {isListening && <span style={{ color: '#10b981', fontWeight: '900', fontSize:'16px', minWidth: '40px', textAlign: 'center' }}>{activeNote || '---'}</span>}
        </div>
      </div>

      {showSettings && (
        <div style={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#10b981', margin: 0 }}>Settings</h2>
              <X size={32} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowSettings(false)} />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <span style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 'bold' }}>Standard Pitch: A={baseFreq}Hz</span>
              <input type="range" min="430" max="450" step="1" value={baseFreq} onChange={(e) => setBaseFreq(parseInt(e.target.value))} style={{ width: '100%', marginTop: '10px' }} />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <span style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Key Category Mode</span>
              <button
                style={{ width: '100%', padding: '15px', borderRadius: '12px', border: 'none', backgroundColor: isLowKey ? '#7c2d12' : '#2563eb', color: 'white', fontWeight: '900', fontSize: '16px' }}
                onClick={() => {
                  const nextMode = !isLowKey;
                  setIsLowKey(nextMode);
                  setCurrentKey(nextMode ? 'LF' : 'C');
                }}
              >
                {isLowKey ? 'LOW KEY MODE ACTIVE' : 'STANDARD KEY MODE ACTIVE'}
              </button>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <span style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 'bold' }}>Tolerance (±{tolerance}c)</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                {['5', '10', '15', '20'].map(val => (
                  <button key={val} onClick={() => setTolerance(val)} style={{ flex: 1, padding: '12px 0', borderRadius: '10px', border: 'none', backgroundColor: tolerance === val ? '#10b981' : '#374151', color: tolerance === val ? 'black' : 'white', fontWeight: '900' }}>±{val}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '25px', padding: '20px', backgroundColor: '#1f2937', borderRadius: '18px', border: '1px solid #374151' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <span style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 'bold' }}>Reverb Type</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {['standard', 'spring'].map(m => (
                    <button key={m} onClick={() => setReverbMode(m)} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', backgroundColor: m === reverbMode ? '#10b981' : '#374151', color: m === reverbMode ? 'black' : 'white', fontWeight: 'bold', fontSize: '14px' }}>{m.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8' }}>Power</span>
                <button onClick={() => setUseReverb(!useReverb)} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: useReverb ? '#10b981' : '#ef4444', color: 'white', fontWeight: 'bold' }}>{useReverb ? 'ON' : 'OFF'}</button>
              </div>
              <input type="range" min="0" max="1" step="0.01" value={reverbWet} onChange={(e) => setReverbWet(parseFloat(e.target.value))} style={{ width: '100%', marginTop: '10px' }} />
            </div>

            <button onClick={() => setShowSettings(false)} style={{ width: '100%', padding: '20px', borderRadius: '16px', border: 'none', backgroundColor: '#10b981', color: 'black', fontWeight: '900', fontSize: '20px', cursor: 'pointer' }}>SAVE & CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteBox({ semi, getNote, activeNote, cents, limit, onStart, onStop, styles }) {
  const noteName = getNote(semi);
  if (!noteName) return <div style={{ height: 'calc(9.5vw - 8px)', width: 'calc(9.5vw - 8px)', maxWidth: '75px', maxHeight: '75px', margin: '2px 0' }}></div>;
  const isActive = activeNote === noteName;
  const displayLabel = noteName.replace(/\d/, '');

  return (
    <div style={styles.cell(isActive, cents, limit)} onMouseDown={() => onStart(noteName)} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={() => onStart(noteName)} onTouchEnd={onStop}>
      <span style={{ fontWeight: '900', fontSize: 'min(18px, 3vw)', color: isActive ? 'black' : '#94a3b8', zIndex: 10, pointerEvents: 'none' }}>{displayLabel}</span>
      {isActive && <div style={{ position: 'absolute', left: `${50 + cents}%`, width: '3px', height: '100%', backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 5, pointerEvents: 'none' }}></div>}
    </div>
  );
}
