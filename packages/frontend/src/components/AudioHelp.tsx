import { useEffect, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import { getLanguage, tr } from '../services/i18n';

// Static instructions only. Never pass usernames, recovery codes, tokens or account data.
export function AudioHelp({ instructions }: { instructions: string }) {
  const language = getLanguage();
  const [voice, setVoice] = useState<SpeechSynthesisVoice>();
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    function update() { setVoice(synth.getVoices().find(v => v.localService && v.lang.toLowerCase().startsWith(language))); }
    update(); synth.addEventListener('voiceschanged', update);
    return () => { synth.removeEventListener('voiceschanged', update); synth.cancel(); };
  }, [language, supported]);
  useEffect(() => { if (supported) window.speechSynthesis.cancel(); setSpeaking(false); setError(''); }, [instructions, supported]);
  function read() {
    if (!voice || !supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(instructions);
    utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setError(tr('Audio could not play. Read the instructions below.', 'आवाज़ नहीं चल सकी। नीचे दिए निर्देश पढ़ें।')); };
    setSpeaking(true); setError(''); window.speechSynthesis.speak(utterance);
  }
  return <details className="audio-help"><summary><Volume2 aria-hidden="true" />{tr('Listen to instructions', 'निर्देश सुनें')}</summary>
    <p>{instructions}</p>
    {voice ? <div className="actions"><button type="button" className="secondary" onClick={read} disabled={speaking}><Volume2 aria-hidden="true" />{tr('Read aloud', 'सुनाएँ')}</button><button type="button" className="secondary" disabled={!speaking} onClick={() => { window.speechSynthesis.cancel(); setSpeaking(false); }}><Square aria-hidden="true" />{tr('Stop reading', 'सुनाना बंद करें')}</button></div>
      : <p className="hint">{tr('No offline voice for this language is available in this browser. Install a system voice or use the written instructions. No audio service is contacted.', 'इस ब्राउज़र में इस भाषा की ऑफलाइन आवाज़ उपलब्ध नहीं है। सिस्टम में आवाज़ जोड़ें या लिखित निर्देश पढ़ें। किसी ऑनलाइन आवाज़ सेवा का उपयोग नहीं होता।')}</p>}
    <p className="hint">{tr('Optional spoken guidance, not voice authentication. Private codes and account data are never read aloud.', 'ये केवल बोलकर बताए गए निर्देश हैं, आवाज़ से पहचान नहीं। निजी कोड या खाते की जानकारी नहीं सुनाई जाती।')}</p>
    {error && <p role="alert" className="error">{error}</p>}
  </details>;
}
