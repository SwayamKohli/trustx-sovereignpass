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
    p1Solution: 'Zero passwords or SMS OTPs over the phone. Offline Argon2id recovery cards prevent SIM-swap account takeover.',
    p2Name: 'Ramesh Patel (38, Rural Citizen)',
    p2Threat: 'Target: Cyber Café & Gramin CSC Kiosk Hijack',
    p2Solution: '15-minute ephemeral shared session via QR code. Automatically self-destructs with zero tokens left on public PC.',
    p3Name: 'Priya Verma (29, Fintech Prosumer)',
    p3Threat: 'Target: Infostealer Malware & Cookie Replay',
    p3Solution: 'RFC 9449 DPoP hardware-bound session token + Automatic Biometric Step-Up on ₹50,000+ transfers.',
    p4Name: 'Enterprise Treasury (Corporate Account)',
    p4Threat: 'Target: Autonomous AI Agent Prompt Injection',
    p4Solution: 'AgentShield Capability Gateway enforces cryptographically bound recipient and ₹500 amount ceiling at kernel level.',
    bankingTitle: 'Sovereign Banking Operations',
    bankingSubtitle: 'Test real-world banking actions with contextual risk and step-up enforcement:',
    accountBalance: 'Account Balance',
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
    p1Solution: 'कोई पासवर्ड या एसएमएस ओटीपी नहीं। फोन पर कोई कोड बोलने का जोखिम खत्म। ऑफलाइन कोड से सुरक्षित रिकवरी।',
    p2Name: 'रमेश पटेल (38 वर्ष, ग्रामीण नागरिक)',
    p2Threat: 'लक्ष्य: कॉमन सर्विस सेंटर (CSC) व साइबर कैफे कियोस्क सुरक्षा',
    p2Solution: 'क्यूआर कोड द्वारा 15 मिनट का सुरक्षित अस्थायी सत्र। समय समाप्त होते ही कंप्यूटर से सभी डेटा स्वतः नष्ट।',
    p3Name: 'प्रिया वर्मा (29 वर्ष, डिजिटल बैंकिंग)',
    p3Threat: 'लक्ष्य: मालवेयर और चोरी किए गए कुकी रीप्ले से सुरक्षा',
    p3Solution: 'DPoP हार्डवेयर कुंजी बाइंडिंग और ₹50,000+ के बड़े लेनदेन पर स्वचालित टच आईडी स्टेप-अप प्रमाणीकरण।',
    p4Name: 'कॉर्पोरेट ट्रेजरी (एंटरप्राइज खाता)',
    p4Threat: 'लक्ष्य: स्वायत्त एआई एजेंट प्रॉम्ट-इंजेक्शन से सुरक्षा',
    p4Solution: 'एजेंटशील्ड क्षमता गेटवे: पासकी द्वारा हस्ताक्षरित टोकन बिजली बोर्ड व ₹500 की अधिकतम सीमा को बाध्य करता है।',
    bankingTitle: 'सॉवरेन बैंकिंग लेनदेन',
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
    deviceBinding: 'डिवाइस हार्डवेयर बाइंडिंग',
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

let currentLang: Language = (typeof localStorage !== 'undefined' ? (localStorage.getItem('trustx_lang') as Language) : 'en') || 'en';

export function getLanguage(): Language {
  return currentLang;
}

export function setLanguage(lang: Language): void {
  currentLang = lang;
  if (typeof localStorage !== 'undefined') localStorage.setItem('trustx_lang', lang);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('trustx-lang-changed', { detail: lang }));
}

export function t(): TranslationSchema {
  return translations[currentLang] || translations.en;
}

