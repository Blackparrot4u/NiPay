import React, { useState } from 'react';
import { MapPin, Download, AlertTriangle, Layers, Calendar, Search } from 'lucide-react';

export const FlowMapPage: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [showBlackoutView, setShowBlackoutView] = useState(false);
  const [exported, setExported] = useState(false);

  const mockClusters = [
    {
      region: 'Western Border District 04',
      date: '2026-10-31',
      clusterSize: '142 Handshakes',
      idsNotReturned: 18,
      status: 'SUSPICIOUS_CLUSTER',
      details: 'High offline velocity without online gateway contact for 12 days.'
    },
    {
      region: 'Central Metro Transit Line #2',
      date: '2026-10-30',
      clusterSize: '890 Handshakes',
      idsNotReturned: 3,
      status: 'NOMINAL',
      details: 'Rapid commuter station offline handovers with normal 4-hour settlement cadence.'
    },
    {
      region: 'Highland Remote Grid #09',
      date: '2026-10-28',
      clusterSize: '64 Handshakes',
      idsNotReturned: 29,
      status: 'BLACKOUT_SURVEY',
      details: 'Extended cellular blackout zone. Expected return within 38-day grace period.'
    }
  ];

  const handleExport = () => {
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>ID Flow Map & Offline Trail Analytics</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Trace hop-by-hop handovers of 20-character server IDs across geographic clusters, blackout dates, and unreturned tokens.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors self-start"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{exported ? 'Export Generated!' : 'Export Trail for Authorities'}</span>
        </button>
      </div>

      {/* Control bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Display View:</span>
          <button
            onClick={() => setShowBlackoutView(false)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              !showBlackoutView ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Cluster Graph
          </button>
          <button
            onClick={() => setShowBlackoutView(true)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              showBlackoutView ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Regional Blackout View
          </button>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <span>IDs Not Returned: <strong className="text-rose-700 font-bold">50 pts</strong></span>
        </div>
      </div>

      {/* Visual Map / Topology Grid Representation */}
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-800">Visual P2P Handshake Mesh & Chain of Custody</span>
          <span className="text-slate-400 font-mono text-[11px]">Server Verified Graph</span>
        </div>

        {/* SVG Mesh representation */}
        <div className="relative h-48 bg-white border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center p-4">
          <svg className="w-full h-full" viewBox="0 0 600 160" fill="none">
            {/* Grid background */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#F1F5F9" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="600" height="160" fill="url(#grid)" />

            {/* Connecting lines */}
            <line x1="80" y1="80" x2="220" y2="40" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 4" />
            <line x1="220" y1="40" x2="380" y2="100" stroke="#CBD5E1" strokeWidth="2" />
            <line x1="380" y1="100" x2="520" y2="70" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="4 4" />

            {/* Nodes */}
            <circle cx="80" cy="80" r="14" fill="#0F172A" />
            <text x="80" y="84" textAnchor="middle" fill="white" fontSize="9" fontFamily="monospace">MINE#1</text>
            <text x="80" y="108" textAnchor="middle" fill="#64748B" fontSize="10">Bank Mint</text>

            <circle cx="220" cy="40" r="14" fill="#2563EB" />
            <text x="220" y="44" textAnchor="middle" fill="white" fontSize="9" fontFamily="monospace">P2P#1</text>
            <text x="220" y="20" textAnchor="middle" fill="#64748B" fontSize="10">Devendra (Pixel 8)</text>

            <circle cx="380" cy="100" r="14" fill="#7C3AED" />
            <text x="380" y="104" textAnchor="middle" fill="white" fontSize="9" fontFamily="monospace">P2P#2</text>
            <text x="380" y="128" textAnchor="middle" fill="#64748B" fontSize="10">Rajesh Fruit Stall</text>

            <circle cx="520" cy="70" r="14" fill="#10B981" />
            <text x="520" y="74" textAnchor="middle" fill="white" fontSize="9" fontFamily="monospace">SYNC</text>
            <text x="520" y="98" textAnchor="middle" fill="#10B981" fontSize="10">Settled (Ledger)</text>
          </svg>
        </div>
      </div>

      {/* Clusters Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                <th className="py-2.5 px-4">Region / Grid</th>
                <th className="py-2.5 px-4">Date Window</th>
                <th className="py-2.5 px-4">P2P Density</th>
                <th className="py-2.5 px-4">Unreturned Points</th>
                <th className="py-2.5 px-4">Threat Assessment</th>
                <th className="py-2.5 px-4">Operational Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {mockClusters.map((cluster, i) => (
                <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{cluster.region}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{cluster.date}</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{cluster.clusterSize}</td>
                  <td className="py-3 px-4 font-mono font-bold text-rose-700">{cluster.idsNotReturned} pts</td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs">{cluster.details}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      cluster.status === 'SUSPICIOUS_CLUSTER'
                        ? 'bg-rose-100 text-rose-800'
                        : cluster.status === 'BLACKOUT_SURVEY'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {cluster.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
