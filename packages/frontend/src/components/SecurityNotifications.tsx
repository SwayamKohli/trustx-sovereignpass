import { request, mockMode } from '../services/api';
import { usePolling } from '../services/usePolling';
import { tr } from '../services/i18n';
type Events={events:{id:string;type:string;timestamp:string}[];delivery:string};
const load=()=>mockMode?Promise.resolve({events:[],delivery:'PREVIEW'}):request<Events>('/devices/security-events');
export function SecurityNotifications(){
  const events=usePolling(load,5000);
  return <section className="panel"><h2>{tr('Security change notifications','सुरक्षा बदलाव की सूचनाएँ')}</h2><p className="hint">{tr('Authenticated in-app history only. Email/SMS alerts are not configured. Recovery tickets and secrets are never shown here.','केवल इस ऐप में प्रमाणित इतिहास। ईमेल/SMS सूचनाएँ उपलब्ध नहीं हैं। रिकवरी टिकट या निजी कोड यहाँ नहीं दिखते।')}</p>
    {events.error&&<p role="alert" className="error">{events.error}</p>}
    <ul className="audit-feed bounded-feed">{events.data?.events.map(e=><li key={e.id}><strong>{e.type.replaceAll('_',' ')}</strong><time>{e.timestamp}</time></li>)}</ul>
    {events.data?.events.length===0&&<p>{tr('No security changes recorded for this account.','इस खाते में अभी कोई सुरक्षा बदलाव दर्ज नहीं है।')}</p>}
  </section>;
}
