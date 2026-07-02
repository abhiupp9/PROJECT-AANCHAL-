import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';

export default function AcronymInfo({ compact = false }) {
  const [isOpen, setIsOpen] = useState(false);

  const items = [
    { letter: 'A', title: 'AI-Powered Voice Recognition', hindi: 'आर्टिफिशियल इंटेलिजेंस आधारित आवाज़ पहचान', desc: 'Background edge-speech engine detecting safety activation triggers.' },
    { letter: 'A', title: 'Automated Emergency Alert', hindi: 'स्वचालित आपातकालीन चेतावनी प्रणाली', desc: 'Instant satellite locking and multi-channel distress message routing.' },
    { letter: 'N', title: 'Network of Local Volunteers', hindi: 'स्थानीय सहायकों और पुलिस का नेटवर्क', desc: 'Connecting you with manned police booths and volunteer safety nodes.' },
    { letter: 'C', title: 'Care-Centric Safe Corridors', hindi: 'रोशनी और सुरक्षा के आधार पर रास्तों का चयन', desc: 'Navigation routing optimized for CCTV density and lighting quality.' },
    { letter: 'H', title: 'Help & Rapid Rescue (1st H - Help)', hindi: 'तत्काल मदद और बचाव', desc: 'Emergency siren dispatch and instant local authority distress signals.' },
    { letter: 'A', title: 'Assistance for Safe Commute (2nd H - Home)', hindi: 'सुरक्षित घर पहुँचने में सहायता', desc: 'Dynamic navigation tracking and deviation detection triggers.' },
    { letter: 'L', title: 'Life & Medical Health Card (3rd H - Health)', hindi: 'जीवन और स्वास्थ्य सुरक्षा', desc: 'Secure, local encrypted Medical Shield accessible to first responders.' }
  ];

  if (compact) {
    return (
      <div style={styles.compactBox} className="glass-card">
        <button onClick={() => setIsOpen(!isOpen)} style={styles.toggleBtn}>
          <div style={styles.compactTitle}>
            <ShieldCheck size={18} color="#06b6d4" />
            <span style={{ fontSize: '0.85rem', fontWeight: '700', letterSpacing: '0.5px' }}>AANCHAL MISSION MODULES</span>
          </div>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {isOpen && (
          <div style={styles.listContainer} className="animate-slideup">
            {items.map((item, idx) => (
              <div key={idx} style={styles.compactRow}>
                <span style={styles.letterBadge}>{item.letter}</span>
                <div>
                  <div style={styles.itemTitle}>{item.title}</div>
                  <div style={styles.itemHindi}>{item.hindi}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container} className="glass-card">
      <div style={styles.header}>
        <HelpCircle size={22} color="#a855f7" className="secure-pulse" />
        <h3 style={styles.title}>Project AANCHAL (आँचल) Definition</h3>
      </div>
      <p style={styles.desc}>
        AANCHAL represents our unified 3H core framework protecting women safety, navigation, and health:
      </p>

      <div style={styles.fullList}>
        {items.map((item, idx) => (
          <div key={idx} style={styles.fullRow} className="glass-card">
            <span style={styles.largeLetterBadge}>{item.letter}</span>
            <div style={styles.rowDetails}>
              <div style={styles.rowTitle}>{item.title}</div>
              <div style={styles.rowHindi}>{item.hindi}</div>
              <p style={styles.rowDesc}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    border: '1px solid rgba(168, 85, 247, 0.15)',
    background: 'rgba(17, 20, 40, 0.4)',
    borderRadius: '16px',
    marginTop: '20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#fff',
  },
  desc: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    lineHeight: '1.4',
    marginBottom: '20px',
  },
  fullList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  fullRow: {
    display: 'flex',
    gap: '16px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
  },
  largeLetterBadge: {
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '1.4rem',
    boxShadow: '0 0 10px rgba(6, 182, 212, 0.2)',
    flexShrink: 0,
  },
  rowDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  rowTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  rowHindi: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#06b6d4',
  },
  rowDesc: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    marginTop: '6px',
  },
  compactBox: {
    padding: '14px 18px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  toggleBtn: {
    width: '100%',
    background: 'none',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    color: '#94a3b8',
  },
  compactTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '14px',
  },
  compactRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  letterBadge: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    color: '#06b6d4',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '0.85rem',
  },
  itemTitle: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  itemHindi: {
    fontSize: '0.75rem',
    color: '#94a3b8',
  }
};
