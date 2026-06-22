export const styles = {
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
