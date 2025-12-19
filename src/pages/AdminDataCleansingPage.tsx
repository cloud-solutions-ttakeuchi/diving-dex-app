import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft,
  Database,
  CheckCircle,
  Layers,
  Settings,
  ShieldCheck,
  ChevronRight,
  Download,
  AlertTriangle,
  History,
  LayoutDashboard,
  FileSearch
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CleansingDashboard } from '../admin/components/DataCleansing/Dashboard';
import { ReviewListView } from '../admin/components/DataCleansing/ReviewListView';
import clsx from 'clsx';

export const AdminDataCleansingPage = () => {
  const { currentUser, pointCreatures } = useApp();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'review'>('dashboard');

  if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') {
    return <div className="p-8 text-center">Access Denied. Admins Only.</div>;
  }

  const pendingCount = pointCreatures.filter(pc => pc.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-slate-200/60 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigate('/admin/areas')}
              className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-ocean-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-ocean-100">
                <ShieldCheck size={28} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">DATA CLEANSING OPS</h1>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Biological Mapping Center</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                <History size={16} className="text-indigo-500" />
              </div>
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">History</span>
            </div>
            <button
              onClick={() => { }}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              <Download size={18} /> EXPORT SEED
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar / Tabs */}
          <aside className="lg:w-80 flex flex-col gap-8">
            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm p-3">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={clsx(
                  "w-full flex items-center justify-between p-5 rounded-[1.75rem] transition-all mb-2",
                  activeTab === 'dashboard'
                    ? "bg-slate-900 text-white shadow-xl shadow-slate-200"
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-4">
                  <LayoutDashboard size={20} />
                  <span className="font-black tracking-tight">Dashboard</span>
                </div>
                <ChevronRight size={16} opacity={activeTab === 'dashboard' ? 1 : 0.3} />
              </button>

              <button
                onClick={() => setActiveTab('review')}
                className={clsx(
                  "w-full flex items-center justify-between p-5 rounded-[1.75rem] transition-all",
                  activeTab === 'review'
                    ? "bg-slate-900 text-white shadow-xl shadow-slate-200"
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-4">
                  <FileSearch size={20} />
                  <span className="font-black tracking-tight">Review Engine</span>
                </div>
                {pendingCount > 0 && (
                  <div className={clsx(
                    "px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest",
                    activeTab === 'review' ? "bg-ocean-500 text-white" : "bg-ocean-50 text-ocean-600"
                  )}>
                    {pendingCount}
                  </div>
                )}
              </button>
            </div>

            <div className="bg-amber-50 rounded-[2.5rem] border border-amber-100 p-8 space-y-4">
              <div className="flex items-center gap-2 text-amber-700 font-black text-xs uppercase tracking-widest">
                <AlertTriangle size={16} /> Notice
              </div>
              <p className="text-xs text-amber-600 font-medium leading-relaxed">
                紐付けデータはAIによって推論されています。承認前に必ず信頼度スコアと根拠を確認し、必要に応じて実際の目撃情報を参照してください。
              </p>
            </div>
          </aside>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {activeTab === 'dashboard' ? (
              <CleansingDashboard />
            ) : (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">AI</div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Mapping Review Engine</h2>
                </div>
                <ReviewListView />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
