export interface LocaleStrings {
  // Danger Warning (Full-screen local language mandate)
  dangerWarningTitle: string;
  dangerWarningBody: string;
  dangerWarningSub: string;
  dangerAbortBtn: string;
  dangerProceedBtn: string;

  // Blocked States
  batteryLowTitle: string;
  batteryLowDesc: string;
  walletExpiredTitle: string;
  walletExpiredDesc: string;
  selfLockTitle: string;
  selfLockDesc: string;

  // Login Lock
  alreadyActiveTitle: string;
  alreadyActiveDesc: string;
  fileCancelBtn: string;

  // Payment Confirmation
  holdUntilBeep: string;
  matchingCodeNotice: string;
  moveMoneyAdvice: string;
  pointBucketNote: string;
}

export const STRINGS: Record<'en' | 'hi', LocaleStrings> = {
  en: {
    dangerWarningTitle: 'Security Caution / सुरक्षा चेतावनी',
    dangerWarningBody: 'This person may be dangerous. You may not get money for their IDs.',
    dangerWarningSub: 'Our offline checker noticed an anomalous risk signature. If you proceed, these IDs may be rejected or held during server settlement.',
    dangerAbortBtn: 'Cancel & Refuse Payment',
    dangerProceedBtn: 'I Understand the Risk — Proceed',

    batteryLowTitle: 'Battery Critical (< 3%)',
    batteryLowDesc: 'Offline payments are suspended to prevent cryptographic key corruption during hardware power loss. Charge device to resume.',
    walletExpiredTitle: 'Monthly Cycle Expired',
    walletExpiredDesc: 'Grace period has ended. Connect to the internet to download signed monthly rules and renew points.',
    selfLockTitle: 'App Needs Attention',
    selfLockDesc: 'Wallet is self-locked due to an integrity flag. Please contact support or upload verification documents when online.',

    alreadyActiveTitle: 'Already Active on Another Device',
    alreadyActiveDesc: 'This wallet is currently active on session Google Pixel 8 (IMEI ending in 4102). Only one active hardware session is permitted.',
    fileCancelBtn: 'File Session Cancellation Report',

    holdUntilBeep: 'Hold phones close until the confirmation beep...',
    matchingCodeNotice: 'Verify this 2-digit security code with the recipient:',
    moveMoneyAdvice: 'Advice: Move received points to your bank account soon for permanent ledger settlement.',
    pointBucketNote: 'Send bucket max: 2,000 pts. Receive bucket max: 10,000 pts. 1 pt = ₹1 test money.'
  },
  hi: {
    dangerWarningTitle: 'सुरक्षा चेतावनी (Security Warning)',
    dangerWarningBody: 'यह व्यक्ति संदिग्ध हो सकता है। आपको इनकी आईडी के लिए पैसे नहीं मिल सकते हैं।',
    dangerWarningSub: 'सिस्टम ने जोखिम का संकेत पाया है। यदि आप आगे बढ़ते हैं, तो सर्वर जांच के दौरान ये आईडी रोकी (held) या अस्वीकार की जा सकती हैं।',
    dangerAbortBtn: 'भुगतान रद्द करें (Cancel Payment)',
    dangerProceedBtn: 'मुझे जोखिम स्वीकार है — आगे बढ़ें',

    batteryLowTitle: 'बैटरी बेहद कम (< 3%)',
    batteryLowDesc: 'हार्डवेयर बंद होने से डेटा सुरक्षित रखने के लिए ऑफलाइन भुगतान रोक दिया गया है। फोन चार्ज करें।',
    walletExpiredTitle: 'मासिक चक्र समाप्त हो गया',
    walletExpiredDesc: 'अनुग्रह अवधि समाप्त हो चुकी है। नए हस्ताक्षरित नियम डाउनलोड करने के लिए इंटरनेट से जुड़ें।',
    selfLockTitle: 'वॉलेट को ध्यान देने की आवश्यकता है',
    selfLockDesc: 'सुरक्षा कारणों से ऐप लॉक है। ऑनलाइन होने पर सत्यापन दस्तावेज अपलोड करें या सहायता केंद्र से संपर्क करें।',

    alreadyActiveTitle: 'अन्य डिवाइस पर पहले से सक्रिय है',
    alreadyActiveDesc: 'यह वॉलेट वर्तमान में किसी अन्य डिवाइस पर सक्रिय है। सुरक्षा के लिए एक समय में केवल एक ही डिवाइस की अनुमति है।',
    fileCancelBtn: 'सत्र रद्दीकरण रिपोर्ट दर्ज करें',

    holdUntilBeep: 'बीप की आवाज आने तक दोनों फोन पास रखें...',
    matchingCodeNotice: 'प्राप्तकर्ता की स्क्रीन पर यह 2-अंकों का कोड मिलाएं:',
    moveMoneyAdvice: 'सलाह: बैंक खाते में सुरक्षित रखने के लिए प्राप्त पॉइंट को जल्द से जल्द मुख्य खाते में ले जाएं।',
    pointBucketNote: 'भेजने की सीमा: 2,000 पॉइंट। प्राप्त सीमा: 10,000 पॉइंट।'
  }
};
