import { useState } from 'react';
import { Users, ShieldAlert, ShieldCheck, ArrowRight, Sparkles, Building2, Smartphone, Cpu } from 'lucide-react';
import { t } from '../services/i18n';

interface PersonaGuideProps {
  onSelectAction?: (page: 'login' | 'phone' | 'account' | 'agent' | 'demo') => void;
}

export function PersonaGuide({ onSelectAction }: PersonaGuideProps) {
  const [selectedPersona, setSelectedPersona] = useState<number>(0);
  const strings = t();

  const personas = [
    {
      id: 0,
      icon: Users,
      name: strings.p1Name,
      threat: strings.p1Threat,
      solution: strings.p1Solution,
      actionText: 'Experience Anti-Fraud Login',
      page: 'login' as const,
      color: '#38bdf8',
    },
    {
      id: 1,
      icon: Building2,
      name: strings.p2Name,
      threat: strings.p2Threat,
      solution: strings.p2Solution,
      actionText: 'Experience Rural Kiosk Mode',
      page: 'phone' as const,
      color: '#34d399',
    },
    {
      id: 2,
      icon: Smartphone,
      name: strings.p3Name,
      threat: strings.p3Threat,
      solution: strings.p3Solution,
      actionText: 'Experience Banking & Step-Up',
      page: 'account' as const,
      color: '#f59e0b',
    },
    {
      id: 3,
      icon: Cpu,
      name: strings.p4Name,
      threat: strings.p4Threat,
      solution: strings.p4Solution,
      actionText: 'Experience AI AgentShield',
      page: 'agent' as const,
      color: '#a855f7',
    },
  ];

  const current = personas[selectedPersona];
  const IconComponent = current.icon;

  return (
    <section className="panel-container" style={{ margin: '0 0 24px 0', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '16px', background: '#090e17', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles aria-hidden="true" style={{ color: '#38bdf8', width: '18px', height: '18px' }} />
            <h2 style={{ margin: 0, fontSize: '17px', color: '#f8fafc' }}>{strings.personasTitle}</h2>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>{strings.personasSubtitle}</p>
        </div>
        <span className="badge" style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
          Target User Journeys
        </span>
      </div>

      {/* Persona selector tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        {personas.map(persona => {
          const PIcon = persona.icon;
          const isSelected = selectedPersona === persona.id;
          return (
            <button
              key={persona.id}
              onClick={() => setSelectedPersona(persona.id)}
              style={{
                background: isSelected ? 'rgba(56, 189, 248, 0.15)' : '#020617',
                border: isSelected ? `1px solid ${persona.color}` : '1px solid #1e293b',
                borderRadius: '10px',
                padding: '12px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <PIcon aria-hidden="true" style={{ width: '16px', height: '16px', color: persona.color }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>{persona.name.split('(')[0]}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.3 }}>
                {persona.threat.replace('Target: ', '').replace('लक्ष्य: ', '')}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Persona Deep Dive Card */}
      <div style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${current.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconComponent aria-hidden="true" style={{ color: current.color, width: '18px', height: '18px' }} />
            </div>
            <div>
              <strong style={{ fontSize: '15px', color: '#f8fafc' }}>{current.name}</strong>
              <div style={{ fontSize: '12px', color: current.color, fontWeight: 600 }}>{current.threat}</div>
            </div>
          </div>
          {onSelectAction && (
            <button
              onClick={() => onSelectAction(current.page)}
              style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {current.actionText} <ArrowRight aria-hidden="true" style={{ width: '14px', height: '14px' }} />
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '10px', fontSize: '13px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 12px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontWeight: 700, marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>
              <ShieldAlert aria-hidden="true" style={{ width: '14px', height: '14px' }} /> Real-World Attack Vulnerability
            </div>
            <p style={{ margin: 0, color: '#e2e8f0', fontSize: '12px' }}>{current.threat}</p>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 12px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: 700, marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>
              <ShieldCheck aria-hidden="true" style={{ width: '14px', height: '14px' }} /> TrustX SovereignPass Defense
            </div>
            <p style={{ margin: 0, color: '#e2e8f0', fontSize: '12px' }}>{current.solution}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
