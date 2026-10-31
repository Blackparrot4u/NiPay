import React from 'react';
import { AlertOctagon, XCircle, ArrowRight } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';
import { STRINGS } from '../../utils/i18n';

export const DangerWarningScreen: React.FC = () => {
  const { wallet, navigateTo } = useOfflinePayment();
  const strings = STRINGS[wallet.preferredLanguage];

  const handleAbort = () => {
    navigateTo('/user/home');
  };

  const handleProceedWithRisk = () => {
    navigateTo('/user/pay-details');
  };

  return (
    <div className="fixed inset-0 z-50 bg-white p-6 flex flex-col justify-between animate-in fade-in duration-150">
      <div className="pt-8 space-y-6 max-w-md mx-auto text-center">
        {/* Stark Red Warning Shield */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-50 border-2 border-rose-600 flex items-center justify-center text-rose-600 shadow-sm">
          <AlertOctagon className="w-12 h-12" />
        </div>

        {/* Bilingual Mandated Danger Warning */}
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {strings.dangerWarningTitle}
          </h1>

          {/* English Primary Statement */}
          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl text-rose-900 font-semibold text-base leading-snug">
            "{strings.dangerWarningBody}"
          </div>

          {/* Hindi Mandatory Statement if English is active, or English if Hindi is active */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm leading-relaxed">
            {wallet.preferredLanguage === 'en' ? (
              <p>
                <span className="font-semibold block mb-1 text-slate-900">हिंदी में चेतावनी:</span>
                "यह व्यक्ति संदिग्ध हो सकता है। आपको इनकी आईडी के लिए पैसे नहीं मिल सकते हैं।"
              </p>
            ) : (
              <p>
                <span className="font-semibold block mb-1 text-slate-900">Warning in English:</span>
                "This person may be dangerous. You may not get money for their IDs."
              </p>
            )}
          </div>

          {/* Explicit rule: "Don't show which factor fired" */}
          <p className="text-xs text-slate-500 leading-relaxed px-2">
            The safety engine identified high risk indicators. To protect network integrity, specific tripwire factors are not disclosed.
          </p>
        </div>
      </div>

      {/* Two Action Buttons */}
      <div className="max-w-md mx-auto w-full space-y-2.5 pb-6">
        <button
          onClick={handleAbort}
          className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <XCircle className="w-5 h-5" />
          <span>{strings.dangerAbortBtn}</span>
        </button>

        <button
          onClick={handleProceedWithRisk}
          className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          {strings.dangerProceedBtn}
        </button>
      </div>
    </div>
  );
};
