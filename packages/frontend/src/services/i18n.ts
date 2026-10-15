// TrustX SovereignPass — Indian Multi-Lingual Inclusion & Target Persona Localization
// Supports English (Default) and हिन्दी (Hindi) for national linguistic accessibility.

export type Language = 'en' | 'hi';

export const translations = {
  en: {
    brandSubtitle: 'SovereignPass',
    navDemo: 'Demo arena',
    navAgent: 'AgentShield',
    navCrypto: 'Crypto Lab',
    navAccount: 'My account',
    navSignIn: 'Sign in',
    navCreateAccount: 'Create account',
    navRecover: 'Recover account',
    navSharedTerminal: 'Use a shared terminal',
    navAdminSOC: 'Admin SOC',
    accessEyebrow: 'Access you can trust',
    heroTitle1: 'Your identity.',
    heroTitle2: 'Your device.',
    heroTitle3: 'Your control.',
    heroDescription: 'Sign in with a passkey instead of a password. Your biometric data never leaves your device.',
    personasTitle: 'Target Citizen Personas (Indian Demographics)',
    personasSubtitle: 'Click any persona to see how TrustX protects their specific threat model:',
    p1Name: 'Sunita Sharma (62, Senior Citizen)',
    p1Threat: 'Target: Digital Arrest & SMS OTP Phishing',
    p1Solution: 'No password or SMS login fallback. Save single-use recovery codes offline; the server stores Argon2id hashes. Never share a recovery code.',
    p2Name: 'Ramesh Patel (38, Rural Citizen)',
    p2Threat: 'Target: Cyber Café & Gramin CSC Kiosk Hijack',
    p2Solution: 'Approve a 15-minute terminal session from another device. Server-side expiry and logout end access; no passkey is enrolled on the terminal.',
    p3Name: 'Priya Verma (29, Fintech Prosumer)',
    p3Threat: 'Target: Infostealer Malware & Cookie Replay',
    p3Solution: 'Browser-key proof rejects cookie-only replay. Fresh passkey approval is required for sandbox transfers of INR 10,000 or more. Not a full-device malware defense.',
    p4Name: 'Enterprise Treasury (Corporate Account)',
    p4Threat: 'Target: Autonomous AI Agent Prompt Injection',
    p4Solution: 'IntentLock verifies the exact approved recipient and amount at the backend, with session binding, expiry and single-use execution.',
    bankingTitle: 'Sandbox banking operations',
    bankingSubtitle: 'Test persisted sandbox payments and fresh passkey step-up. No real funds are transferred:',
    accountBalance: 'Synthetic account balance',
    lowRiskBtn: 'Pay Electricity Bill (₹450) · Low Risk',
    highRiskBtn: 'Transfer ₹50,000 to New Beneficiary · Step-Up Enforced',
    stepUpNotice: 'High-value transactions (≥ ₹10,000) automatically demand a live FIDO2 biometric step-up passkey verification.',
    riskTitle: 'Contextual Risk & Anomaly Engine (Req 6)',
    riskLow: 'LOW RISK',
    riskMedium: 'MEDIUM RISK',
    riskHigh: 'HIGH RISK',
    ipBaseline: 'Network IP Baseline',
    deviceBinding: 'Device Binding',
    stepUpThreshold: 'Step-Up Threshold',
    evaluatedSignals: 'Evaluated Signals',
    devicesHeading: 'Your devices',
    refreshDevices: 'Refresh devices',
    addPasskey: 'Add a passkey',
    signOut: 'Sign out',
  },
  hi: {
    brandSubtitle: 'सॉवरेनपास',
    navDemo: 'डेमो अखाड़ा',
    navAgent: 'एजेंटशील्ड',
    navCrypto: 'क्रिप्टो लैब',
    navAccount: 'मेरा खाता',
    navSignIn: 'साइन इन',
    navCreateAccount: 'नया खाता बनाएं',
    navRecover: 'खाता पुनर्प्राप्ति',
    navSharedTerminal: 'साझा कियोस्क सत्र',
    navAdminSOC: 'एडमिन एसओसी',
    accessEyebrow: 'सुरक्षित और विश्वसनीय पहचान',
    heroTitle1: 'आपकी पहचान।',
    heroTitle2: 'आपका डिवाइस।',
    heroTitle3: 'आपका नियंत्रण।',
    heroDescription: 'पासवर्ड की जगह बायोमेट्रिक पासकी का उपयोग करें। आपका बायोमेट्रिक डेटा आपके डिवाइस पर ही सुरक्षित रहता है।',
    personasTitle: 'लक्षित नागरिक श्रेणियां (भारतीय जनसांख्यिकी)',
    personasSubtitle: 'किसी भी नागरिक प्रोफ़ाइल पर क्लिक करके उनका सुरक्षा मॉडल देखें:',
    p1Name: 'सुनीता शर्मा (62 वर्ष, वरिष्ठ नागरिक)',
    p1Threat: 'लक्ष्य: "डिजिटल अरेस्ट" और फर्जी ओटीपी कॉल से सुरक्षा',
    p1Solution: 'पासवर्ड या एसएमएस से साइन इन नहीं। एक बार उपयोग वाले रिकवरी कोड ऑफलाइन सुरक्षित रखें और किसी को न बताएँ। सर्वर पर केवल Argon2id हैश रखे जाते हैं।',
    p2Name: 'रमेश पटेल (38 वर्ष, ग्रामीण नागरिक)',
    p2Threat: 'लक्ष्य: कॉमन सर्विस सेंटर (CSC) व साइबर कैफे कियोस्क सुरक्षा',
    p2Solution: 'क्यूआर से 15 मिनट का अस्थायी सत्र मंज़ूर करें। लॉगआउट या सर्वर की समय सीमा पर पहुँच समाप्त; टर्मिनल पर पासकी नहीं बनती।',
    p3Name: 'प्रिया वर्मा (29 वर्ष, डिजिटल बैंकिंग)',
    p3Threat: 'लक्ष्य: मालवेयर और चोरी किए गए कुकी रीप्ले से सुरक्षा',
    p3Solution: 'ब्राउज़र कुंजी का प्रमाण चोरी की कुकी के रीप्ले को रोकता है। ₹10,000 या अधिक के सैंडबॉक्स भुगतान पर नई पासकी मंज़ूरी चाहिए। यह पूरे डिवाइस के मालवेयर से रक्षा नहीं है।',
    p4Name: 'कॉर्पोरेट ट्रेजरी (एंटरप्राइज खाता)',
    p4Threat: 'लक्ष्य: स्वायत्त एआई एजेंट प्रॉम्ट-इंजेक्शन से सुरक्षा',
    p4Solution: 'IntentLock बैकएंड पर मंज़ूर किए गए प्राप्तकर्ता और सटीक राशि, सत्र, समय सीमा और एक बार उपयोग की जाँच करता है।',
    bankingTitle: 'सैंडबॉक्स बैंकिंग लेनदेन',
    bankingSubtitle: 'संदर्भित जोखिम स्कोर और स्टेप-अप बायोमेट्रिक प्रमाणीकरण का लाइव परीक्षण करें:',
    accountBalance: 'खाता शेष (बैलेंस)',
    lowRiskBtn: 'बिजली बिल भुगतान (₹450) · कम जोखिम (सीधा भुगतान)',
    highRiskBtn: 'नए लाभार्थी को ₹50,000 भेजें · बायोमेट्रिक स्टेप-अप अनिवार्य',
    stepUpNotice: '₹10,000 या अधिक के लेनदेन पर सिस्टम अनिवार्य रूप से लाइव फिंगरप्रिंट/टच आईडी प्रमाणीकरण मांगता है।',
    riskTitle: 'संदर्भित जोखिम और विसंगति इंजन (नियम 6)',
    riskLow: 'सुरक्षित (कम जोखिम)',
    riskMedium: 'मध्यम जोखिम',
    riskHigh: 'उच्च जोखिम',
    ipBaseline: 'नेटवर्क आईपी बेसलाइन',
    deviceBinding: 'ब्राउज़र कुंजी से बाइंडिंग',
    stepUpThreshold: 'स्टेप-अप सीमा',
    evaluatedSignals: 'जांचे गए सुरक्षा संकेत',
    devicesHeading: 'आपके पंजीकृत उपकरण और पासकी',
    refreshDevices: 'उपकरण रीफ्रेश करें',
    addPasskey: 'नई पासकी जोड़ें',
    signOut: 'साइन आउट',
  },
};

export type TranslationSchema = {
  [K in keyof (typeof translations)['en']]: string;
};

let currentLang: Language = 'en';
try { if (localStorage.getItem('trustx_lang') === 'hi') currentLang = 'hi'; } catch { /* Storage may be blocked in a shared browser. */ }

export function getLanguage(): Language {
  return currentLang;
}

export function setLanguage(lang: Language): void {
  currentLang = lang;
  try { localStorage.setItem('trustx_lang', lang); } catch { /* Language still applies for this page. */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('trustx-lang-changed', { detail: lang }));
}

export function t(): TranslationSchema {
  return translations[currentLang] || translations.en;
}

export function tr(english: string, hindi: string): string {
  return currentLang === 'hi' ? hindi : english;
}

