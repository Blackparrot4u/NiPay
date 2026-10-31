import React, { useState } from 'react';
import { ArrowLeft, AlertTriangle, Smartphone, FileText, CheckCircle2, Clock } from 'lucide-react';
import { useOfflinePayment } from '../../context/OfflinePaymentContext';

export const ReportAppealScreen: React.FC = () => {
  const { appeals, fileUserAppeal, navigateTo } = useOfflinePayment();

  const [reportType, setReportType] = useState<'LOST_PHONE' | 'PAYMENT_ISSUE' | 'APPEAL_FLAG'>('PAYMENT_ISSUE');
  const [details, setDetails] = useState('');
  const [docName, setDocName] = useState('ticket_proof_receipt_test.pdf');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fileUserAppeal(`[${reportType}] ${details}`, docName);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setDetails('');
    }, 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <button
          onClick={() => navigateTo('/user/home')}
          className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-bold text-slate-900">Report Problem or File Appeal</h2>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs">
        <button
          type="button"
          onClick={() => setReportType('LOST_PHONE')}
          className={`py-1.5 rounded-lg font-medium transition-all ${
            reportType === 'LOST_PHONE' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
          }`}
        >
          Lost Phone
        </button>
        <button
          type="button"
          onClick={() => setReportType('PAYMENT_ISSUE')}
          className={`py-1.5 rounded-lg font-medium transition-all ${
            reportType === 'PAYMENT_ISSUE' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
          }`}
        >
          Payment Issue
        </button>
        <button
          type="button"
          onClick={() => setReportType('APPEAL_FLAG')}
          className={`py-1.5 rounded-lg font-medium transition-all ${
            reportType === 'APPEAL_FLAG' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
          }`}
        >
          Appeal Flag
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Detailed Description / समस्या का विवरण</label>
          <textarea
            rows={3}
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="Explain what happened (e.g. transfer stuck, phone misplaced, reason for tripwire appeal)..."
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none"
            required
          />
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <span className="font-semibold text-slate-700 block">Supporting Document Attached:</span>
          <span className="font-mono text-[11px] text-blue-600 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
            {docName}
          </span>
        </div>

        {submitted && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Appeal submitted to Review Queue. 48-hour deadline timer started.</span>
          </div>
        )}

        <button
          type="submit"
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
        >
          Submit Report / Appeal
        </button>
      </form>

      {/* Status Tracker */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Appeal Status Tracker</h3>
        <div className="space-y-2">
          {appeals.map(a => (
            <div key={a.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold font-mono text-slate-900">{a.id}</span>
                <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{a.deadlineHoursRemaining}h remaining</span>
                </span>
              </div>
              <p className="text-slate-600 text-[11px] line-clamp-2">{a.reason}</p>
              <div className="text-[10px] text-slate-400 font-mono pt-1">
                Submitted: {a.submittedAt} · Status: {a.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
