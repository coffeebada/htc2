import React from 'react';

function BackingTrackPlayer({ onFileLoaded }) {

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]; // 첫 번째 파일 안전 추출
    if (!file) return;

    const isAudioType = file.type.startsWith('audio/');
    const isAudioExtension = /\.(mp3|m4a|wav|aac|mp4)$/i.test(file.name);

    if (!isAudioType && !isAudioExtension) {
      alert('지원하지 않는 파일 형식입니다. 오디오 파일(mp3, m4a 등)을 선택해 주세요.');
      return;
    }

    const fileURL = URL.createObjectURL(file);
    // 화성학 변조 엔진 연동을 위해 가상 URL과 파일명을 상위 컴포넌트로 전송
    onFileLoaded(fileURL, file.name);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      <label 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#374151',
          color: '#cbd5e1',
          padding: '6px 14px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '700',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          border: '1px solid #4b5563',
          transition: 'background-color 0.15s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}
      >
        File Select
        <input 
          type="file" 
          accept="audio/*, .mp3, .m4a, .wav, .aac, audio/mp3, audio/x-m4a, audio/mpeg" 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
        />
      </label>
    </div>
  );
}

export default BackingTrackPlayer;
