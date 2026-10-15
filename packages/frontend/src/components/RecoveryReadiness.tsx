import { useState } from 'react';
import { friendlyError, mockMode, request } from '../services/api';
import { usePolling } from '../services/usePolling';
import { tr } from '../services/i18n';
import { Dialog } from './Dialog';
import { RecoveryModal } from './RecoveryModal';
const loadStatus = () => request<{remainingCodes:number;activePasskeys:number}>('/recovery/status');
export function RecoveryReadiness({ isKiosk }: {isKiosk:boolean}) {
  const status = usePolling(loadStatus,10000);
  const [confirm,setConfirm] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [codes,setCodes] = useState<string[]>([]);
  return <section className="panel"><h2>{tr('Recovery readiness','रिकवरी की तैयारी')}</h2>
    {status.error && !mockMode && <p role="alert" className="error">{status.error}</p>}
    {status.data && <p>{tr('Unused recovery codes','बचे हुए रिकवरी कोड')}: <strong>{status.data.remainingCodes}</strong> · {tr('Active passkeys','सक्रिय पासकी')}: <strong>{status.data.activePasskeys}</strong></p>}
    <p>{tr('Keep a backup passkey and save recovery codes somewhere separate from your device. If all passkeys and codes are lost, this app deliberately cannot bypass identity verification. Contact your organization for its separately verified identity-proofing process; no such support reset is implemented here.', 'एक अतिरिक्त पासकी रखें और रिकवरी कोड डिवाइस से अलग सुरक्षित रखें। सभी पासकी और कोड खोने पर यह ऐप पहचान की जाँच को छोड़कर प्रवेश नहीं देता। संस्था की अलग पहचान-जाँच प्रक्रिया से संपर्क करें; ऐसा सहायता रीसेट यहाँ लागू नहीं है।')}</p>
    <button className="secondary" disabled={isKiosk || mockMode || busy} onClick={()=>{setConfirm(true);setError('');}}>{tr('Replace recovery codes','रिकवरी कोड बदलें')}</button>
    {isKiosk && <p className="hint">{tr('Recovery codes cannot be replaced from a shared-terminal session.', 'साझा टर्मिनल सत्र से रिकवरी कोड नहीं बदले जा सकते।')}</p>}
    {confirm && <Dialog title={tr('Replace all recovery codes?', 'सभी रिकवरी कोड बदलें?')} onClose={()=>setConfirm(false)} busy={busy}><p>{tr('This requires a fresh passkey check. All previous codes and pending recovery tickets will become invalid. You must save eight new codes immediately.', 'नई पासकी जाँच जरूरी है। सभी पुराने कोड और लंबित रिकवरी टिकट अमान्य होंगे। आठ नए कोड तुरंत सुरक्षित रखने होंगे।')}</p>{error && <p role="alert" className="error">{error}</p>}<button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const result=await request<{success:boolean;recoveryCodes:string[]}>('/recovery/rotate-codes',{});if(result.success!==true||result.recoveryCodes?.length!==8||!result.recoveryCodes.every(c=>typeof c==='string'))throw new Error('Invalid codes');setCodes(result.recoveryCodes);setConfirm(false);status.refresh();}catch(err){setError(friendlyError(err));}finally{setBusy(false);}}}>{busy ? tr('Complete the passkey prompt…','पासकी संदेश पूरा करें…') : tr('Verify and replace codes','पुष्टि करके कोड बदलें')}</button></Dialog>}
    {!!codes.length && <RecoveryModal rotation codes={codes} onSaved={()=>setCodes([])} />}
  </section>;
}
