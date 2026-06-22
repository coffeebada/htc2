import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Play, Pause, Upload, Mic, Square, Download, Settings, X } from 'lucide-react';

// 🎯 하모니카 1~10번 홀 적층형 레이아웃 및 세미톤 완벽 매핑
const HARP_LAYOUT = {
  holes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  blow: [0, 4, 7, 12, 16, 19, 24, 28, 31, 36],
  draw: [2, 7, 11, 14, 17, 21, 23, 26, 29, 33],
  topSpecial: [3, 8, 12, 15, 18, 22, null, 27, 30, 35],
  bottomSpecials: [
    [1],        // 1번 홀
    [6, 5],     // 2번 홀
    [10, 9, 8], // 3번 홀
    [13],       // 4번 홀
    [],         // 5번 홀 (단독 비움 유지)
    [20],       // 6번 홀
    [25],       // 7번 홀
    [29],       // 8번 홀
    [32],       // 9번 홀
    [37]        // 10번 홀
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
  const [showOverbanding, setShowOverbanding] = useState(false);

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
      toneFilter.current?.dispose();
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

  const toggleRecordedPlayback = () => {
    if (!audioPlaybackRef.current) return;
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

        {/* 상단 버튼 그룹 (동일 높이 분할 배분 완료) */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#94a3b8' }}>Harp Key</span>
            <select style={BOX_STYLE.selectBox} value={currentKey} onChange={(e) => setCurrentKey(e.target.value)}>
              {!isLowKey ? Object.keys(standardKeys).map(k => <option key={k} value={k}>{k}</option>) : Object.keys(lowKeys).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <button onClick={isListening ? stopMic : startMic} style={{...BOX_STYLE.micBtn, backgroundColor: isListening ? '#ef4444' : '#2563eb', padding: '12px 35px'}}>
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
              {/* 🎯 10번홀 독립 레이어 Bb(46) 노드 배치 */}
              {h === 10 ? (
                <NoteBox semi={46} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} isTopBb={true} showOverbanding={showOverbanding} />
              ) : (
                <div style={{ height: '90px', width: '90px', margin: '3px 0' }}></div>
              )}

              {/* 상단 오버블로우 파트 */}
              <NoteBox semi={HARP_LAYOUT.topSpecial[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} isBlowZone={true} holeNum={h} showOverbanding={showOverbanding} />

              <NoteBox semi={HARP_LAYOUT.blow[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} />
              <div style={BOX_STYLE.holeNumber}>{h}</div>
              <NoteBox semi={HARP_LAYOUT.draw[i]} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} showOverbanding={showOverbanding} />

              {/* 하단 밴딩 및 오버드로우 파트 (5번 홀 단독 비움 반영 완료) */}
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: '280px', gap: '4px' }}>
                {HARP_LAYOUT.bottomSpecials[i].map((semiVal, sIdx) => (
                  <NoteBox key={sIdx} semi={semiVal} getNote={getNoteName} activeNote={activeNote} cents={centsOff} limit={tolerance} onStart={handleNoteStart} onStop={handleNoteStop} isDrawZone={true} holeNum={h} showOverbanding={showOverbanding} />
                ))}
              </div>

              {/* 10번 홀 오른쪽 끝선 하단 집약 폼 (타이틀 + 카피라이터) */}
              {h === 10 && (
                <div style={{
                  position: 'absolute',
                  bottom: '-5px',
                  right: '0px',
                  width: '650px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  pointerEvents: 'none',
                  zIndex: 10,
                  fontFamily: 'sans-serif',
                  lineHeight: '1.4'
                }}>
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

        {/* 인라인 3분할 오디오 대시보드 */}
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
            <div style={{ flex: 1, minWidth: 0, marginLeft: '8px' }}><span style={DASHBOARD_STYLE.label}>MR VOL</span><input type="range" min="0" max="1" step="0.01" value={mrVolume} onChange={(e) => setMrVolume(parseFloat(e.target.value))} style={{ width: '100%' }} /></div>
          </div>

          <div style={{ ...DASHBOARD_STYLE.controlBox, justifyContent: 'center' }}>
            <button onClick={isRecording ? async () => { const rec = await recorder.current.stop(); const blobUrl = URL.createObjectURL(rec); setRecordedUrl(blobUrl); setIsRecording(false); setIsRecordedPlaying(false); } : () => { Tone.start(); setRecordedUrl(null); recorder.current.start(); setIsRecording(true); }} style={{ backgroundColor: isRecording ? '#ef4444' : '#374151', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '14px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {isRecording ? <Square size={14} /> : <Mic size={14} />} {isRecording ? "STOP" : "REC"}
            </button>

            {recordedUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid #4b5563', overflow: 'hidden' }}>
                <audio ref={audioPlaybackRef} src={recordedUrl} onEnded={() => setIsRecordedPlaying(false)} style={{ display: 'none' }} />
                <button onClick={toggleRecordedPlayback} style={{ border: 'none', backgroundColor: '#3b82f6', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isRecordedPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <a href={recordedUrl} download="harmonica_session.wav" style={{ color: '#10b981', display: 'flex', alignItems: 'center', flexShrink: 0 }}><Download size={22} /></a>
              </div>
            )}
          </div>

          <div style={DASHBOARD_STYLE.controlBox}>
            <Mic size={22} color="#94a3b8" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, marginLeft: '8px' }}><span style={DASHBOARD_STYLE.label}>MIC VOL</span><input type="range" min="0" max="1" step="0.01" value={micVolume} onChange={(e) => setMicVolume(parseFloat(e.target.value))} style={{ width: '100%' }} /></div>
            {isListening && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '55px', flexShrink: 0, marginLeft: '6px' }}>
                <span style={{ color: '#10b981', fontWeight: '900', fontSize: '18px' }}>{activeNote || '---'}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{centsOff}¢</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {showSettings && (
        <div style={MODAL_STYLE.modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={MODAL_STYLE.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', margin: 0, color: '#10b981' }}>Settings</h2>
              <X size={28} style={{ pointerEvents: 'none', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowSettings(false)} />
            </div>

            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#1f2937', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #374151' }}>
              <span style={{ fontSize: '15px', color: '#cbd5e1', fontWeight: 'bold' }}>Show Overbends</span>
              <button
                onClick={() => setShowOverbanding(!showOverbanding)}
                style={{ padding: '8px 18px', backgroundColor: showOverbanding ? '#10b981' : '#4b5563', border: 'none', color: showOverbanding ? 'black' : 'white', borderRadius: '8px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.15s ease' }}
              >
                {showOverbanding ? 'ON' : 'OFF'}
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '15px', color: '#94a3b8' }}>Standard Pitch: A={baseFreq}Hz</span>
              <input type="range" min="430" max="450" step="1" value={baseFreq} onChange={(e) => setBaseFreq(parseInt(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <button style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: isLowKey ? '#7c2d12' : '#2563eb', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }} onClick={() => { const nm = !isLowKey; setIsLowKey(nm); setCurrentKey(nm ? 'LF' : 'C'); }}>
                {isLowKey ? 'LOW KEY MODE' : 'STANDARD KEY MODE'}
              </button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '15px', color: '#94a3b8' }}>Tolerance (±{tolerance}c)</span>
              <div style={{ display: 'flex', gap: '6px', marginTop: '5px' }}>
                {['5', '10', '15', '20'].map(val => <button key={val} onClick={() => setTolerance(parseInt(val))} style={{ flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', backgroundColor: tolerance === parseInt(val) ? '#10b981' : '#374151', color: 'white', cursor: 'pointer', fontSize: '14px' }}>±{val}</button>)}
              </div>
            </div>
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#1f2937', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '15px', color: '#94a3b8' }}>Reverb Type</span>
                <div>{['standard', 'spring'].map(m => <button key={m} onClick={() => setReverbMode(m)} style={{ padding: '6px 10px', marginLeft: '6px', backgroundColor: m === reverbMode ? '#10b981' : '#374151', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{m.toUpperCase()}</button>)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', color: '#94a3b8' }}>Power</span>
                <button onClick={() => setUseReverb(!useReverb)} style={{ padding: '6px 14px', backgroundColor: useReverb ? '#10b981' : '#ef4444', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>{useReverb ? 'ON' : 'OFF'}</button>
              </div>
            </div>
            <button onClick={() => setShowSettings(false)} style={MODAL_STYLE.saveBtn}>SAVE & CLOSE</button>
          </div>
        </div>
      )}
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

  const isOverblowCell = isBlowZone && (holeNum === 1 || holeNum === 2 || holeNum === 3 || holeNum === 4 || holeNum === 5 || holeNum === 6);
  const isOverdrawCell = isDrawZone && (holeNum >= 7 && holeNum <= 10) && (semi === 25 || semi === 29 || semi === 32 || semi === 37);

  // 🎯 [핵심 보정] 최상단 10번홀 Bb(isTopBb)은 스위치 오프 상태(hideContent) 조건에서 완벽하게 제외하여 무조건 노출
  const hideContent = !showOverbanding && (isOverblowCell || isOverdrawCell);

  let bgColor = '#1e293b';
  let borderStyle = '1px solid #334155';

  if (isActive && !hideContent) {
    bgColor = Math.abs(cents) <= limit ? '#22c55e' : (cents > limit ? '#eab308' : '#ef4444');
  } else if (hideContent) {
    bgColor = 'transparent';
    borderStyle = '1px solid transparent';
  } else {
    // 🎯 [핵심 컬러 매핑] 최상단 Bb(isTopBb)일 때, 바로 아래 B 사각형과 완벽히 매치되는 스카이 블루 컬러(#93c5fd) 할당
    if (isTopBb) {
      bgColor = '#93c5fd';
    } else if (isOverblowCell) {
      bgColor = '#fca5a5';
    } else if (isBlowZone) {
      bgColor = '#93c5fd';
    } else if (isDrawZone) {
      bgColor = (holeNum >= 7 && holeNum <= 10) ? '#f59e0b' : '#93c5fd';
    }
  }

  const cellStyle = {
    width: '90px', height: '90px', margin: '3px 0', borderRadius: '14px', border: borderStyle,
    backgroundColor: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', cursor: hideContent ? 'default' : 'pointer', userSelect: 'none',
    transition: 'background-color 0.15s ease, border 0.15s ease'
  };

  return (
    <div style={cellStyle} onMouseDown={() => !hideContent && onStart(noteName)} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={(e) => { if (e.cancelable) e.preventDefault(); if (!hideContent) onStart(noteName); }} onTouchEnd={onStop}>
      <span style={{ fontWeight: '900', fontSize: '24px', color: hideContent ? 'transparent' : ((isActive || isBlowZone || isDrawZone || isTopBb) ? 'black' : '#94a3b8'), zIndex: 10, pointerEvents: 'none' }}>
        {displayLabel}
      </span>
      {isActive && !hideContent && (
        <div style={{ position: 'absolute', left: `${indicatorLeft}%`, width: '4px', height: '100%', backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 5, pointerEvents: 'none', transition: 'left 0.05s ease-out' }}></div>
      )}
    </div>
  );
}

const BOX_STYLE = {
  container: { backgroundColor: '#050a14', width: '1920px', height: '1080px', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', boxSizing: 'border-box', overflow: 'hidden' },
  contentWrapper: { width: '1080px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' },
  selectBox: { background: '#1e293b', color: '#60a5fa', border: '2px solid #334155', borderRadius: '14px', padding: '8px 20px', fontSize: '20px', fontWeight: '900', outline: 'none' },
  micBtn: { padding: '12px 24px', borderRadius: '14px', color: 'white', fontWeight: 'bold', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' },
  settingsBtn: { backgroundColor: '#1f2937', color: 'white', padding: '12px 20px', borderRadius: '14px', cursor: 'pointer', border: '1px solid #374151', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' },
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
