import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { CURRENT_TERMS_VERSION } from '../constants';

export const TermsAgreementModal = () => {
  const { currentUser, updateUser, isAuthenticated, logout, deleteAccount } = useApp();
  const [isAgreed, setIsAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  // Check if user has agreed to the CURRENT version
  // If not logged in, or already agreed to LATEST, or on legal pages, don't show
  const hasAgreedToLatest = currentUser?.agreedTermsVersion === CURRENT_TERMS_VERSION;

  if (isLoading || !isAuthenticated || !currentUser || hasAgreedToLatest || ['/terms', '/privacy'].includes(location.pathname)) return null;

  // Detect if "New User" flow or "Update" flow
  // "Update" (Existing User) if:
  // 1. Status is 'active' or 'suspended'
  // 2. OR Legacy user (no status) who has agreed to previous versions
  // "New" (Registration) only if:
  // 1. Status is 'provisional'
  // 2. OR (Fallback) has createdAt but no agreed version (caught in previous bug fix)
  const isNewUser = currentUser.status === 'provisional' || (!currentUser.status && !!currentUser.createdAt && !currentUser.agreedTermsVersion);

  const handleAgree = async () => {
    setIsLoading(true);
    try {
      await updateUser({
        isTermsAgreed: true, // Keep legacy flag true
        agreedAt: new Date().toISOString(),
        agreedTermsVersion: CURRENT_TERMS_VERSION,
        status: 'active' // Activate user
      });
    } catch (e) {
      console.error('Failed to agree terms', e);
      alert('エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisagree = async () => {
    let confirmed = false;
    if (isNewUser) {
      if (window.confirm('会員登録を中止し、ログアウトしますか？')) confirmed = true;
    } else {
      if (window.confirm('退会すると、すべてのデータ（ログ、お気に入り等）が削除され復元できません。\n本当によろしいですか？')) confirmed = true;
    }

    if (confirmed) {
      setIsLoading(true);
      try {
        await deleteAccount();
      } catch (e) {
        console.error("Disagree action failed", e);
      } finally {
        // Determine if we should really turn off loading.
        // If logged out, this component unmounts.
        // If not (e.g. error handled in AppContext but state didn't update yet), we MUST turn off loading to unfreeze UI.
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-6">
          <Shield size={48} className="mx-auto text-ocean-600 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isNewUser ? '会員登録' : '利用規約の更新'}
          </h2>
          <p className="text-sm text-gray-500">
            {isNewUser
              ? 'サービスをご利用いただくには、以下の利用規約への同意が必要です。'
              : 'サービスを引き続きご利用いただくには、最新の利用規約への同意が必要です。'
            }
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <Link to="/terms" target="_blank" className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex justify-between items-center group">
            <span className="font-bold text-gray-700">利用規約</span>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600" />
          </Link>
          <Link to="/privacy" target="_blank" className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex justify-between items-center group">
            <span className="font-bold text-gray-700">プライバシーポリシー</span>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600" />
          </Link>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-3 p-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-gray-300 text-ocean-600 focus:ring-ocean-500"
              checked={isAgreed}
              onChange={e => setIsAgreed(e.target.checked)}
            />
            <span className="text-sm font-bold text-gray-700">
              上記の内容を確認し、同意します
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleAgree}
            disabled={!isAgreed || isLoading}
            className="w-full py-3 bg-gray-50 text-gray-900 border border-gray-300 rounded-xl font-bold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isLoading ? '処理中...' : (isNewUser ? '同意して登録' : '同意して続ける')}
          </button>

          <button
            onClick={handleDisagree}
            disabled={isLoading}
            className="w-full py-2 text-gray-400 hover:text-red-500 text-sm font-medium transition-colors"
          >
            {isNewUser ? '同意せずログアウト' : '同意せず退会する'}
          </button>

          {import.meta.env.DEV && (
            <button
              onClick={() => logout()}
              className="w-full py-2 text-gray-300 hover:text-gray-500 text-xs transition-colors"
            >
              強制ログアウト (デバッグ用 - Dev Only)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
