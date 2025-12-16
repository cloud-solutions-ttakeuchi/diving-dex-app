import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, X, Globe, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, login, logout, currentUser } = useApp();
  const { language, setLanguage, t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen font-sans text-gray-900 flex flex-col relative">
      {/* Global Loading Overlay */}

      {/* @ts-ignore */}
      {(() => {
        try {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          const { isLoading } = useApp();
          if (!isLoading) return null;
          return (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center animate-fade-in">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-cyan-700 font-bold animate-pulse">Loading...</p>
              </div>
            </div>
          );
        } catch {
          return null;
        }
      })()}

      {/* Header - Exact Replica of Pokemon Zukan */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50 h-[72px]">
        <div className="max-w-[1280px] mx-auto px-4 h-full flex items-center justify-between">
          {/* Logo Area */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <img src="/images/logo.png" alt="DiveDex Logo" className="w-14 h-14 object-contain mix-blend-multiply brightness-110 contrast-110" />
            </div>
            <span className="text-2xl font-extrabold text-gray-700 tracking-tight" style={{ fontFamily: '"M PLUS Rounded 1c", sans-serif' }}>
              <span className="text-cyan-500">Dive</span>Dex
            </span>
          </Link>

          {/* Right Navigation */}
          <div className="flex items-center gap-4">
            {/* Language Toggle (Custom addition) */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ja' : 'en')}
              className="hidden md:flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
            >
              <Globe size={14} />
              {language === 'en' ? 'JP' : 'EN'}
            </button>

            {/* Search Button - Zukan Style */}
            <Link to="/pokedex" className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-full transition-colors group">
              <Search size={18} className="text-gray-500 group-hover:text-gray-900" />
              <span className="text-sm font-bold">{t('nav.pokedex')}</span>
            </Link>

            {/* Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 top-[72px] bg-white z-40 p-6 animate-fade-in">
          <nav className="flex flex-col gap-4 text-center">
            <Link to="/" onClick={() => setIsMenuOpen(false)} className="text-xl font-bold py-4 border-b border-gray-100 hover:text-red-500">
              {t('nav.home')}
            </Link>
            <Link to="/pokedex" onClick={() => setIsMenuOpen(false)} className="text-xl font-bold py-4 border-b border-gray-100 hover:text-red-500">
              {t('nav.pokedex')}
            </Link>
            <Link to="/points" onClick={() => setIsMenuOpen(false)} className="text-xl font-bold py-4 border-b border-gray-100 hover:text-red-500">
              ポイント検索
            </Link>
            {isAuthenticated && (
              <Link to="/mypage" onClick={() => setIsMenuOpen(false)} className="text-xl font-bold py-4 border-b border-gray-100 hover:text-red-500">
                {t('nav.mypage')}
              </Link>
            )}

            {/* Admin Links */}
            {isAuthenticated && (currentUser.role === 'admin' || currentUser.role === 'moderator') && (
              <div className="py-4 border-b border-gray-100 flex flex-col gap-2">
                <div className="flex items-center justify-center gap-2 text-purple-600 font-bold mb-1">
                  <Shield size={18} /> Admin Area
                </div>
                <Link to="/admin/proposals" onClick={() => setIsMenuOpen(false)} className="text-lg font-bold text-gray-600 hover:text-purple-600">
                  提案管理
                </Link>
                {currentUser.role === 'admin' && (
                  <Link to="/admin/users" onClick={() => setIsMenuOpen(false)} className="text-lg font-bold text-gray-600 hover:text-purple-600">
                    ユーザー管理
                  </Link>
                )}
                <Link to="/admin/areas" onClick={() => setIsMenuOpen(false)} className="text-lg font-bold text-gray-600 hover:text-purple-600">
                  エリア管理
                </Link>
                <Link to="/admin/creatures" onClick={() => setIsMenuOpen(false)} className="text-lg font-bold text-gray-600 hover:text-purple-600">
                  生物管理
                </Link>
              </div>
            )}
            <button onClick={() => {
              if (isAuthenticated) { logout(); } else { login(); }
              setIsMenuOpen(false);
            }} className="text-xl font-bold py-4 border-b border-gray-100 hover:text-red-500">
              {isAuthenticated ? t('nav.logout') : t('nav.login')}
            </button>
          </nav>
        </div>
      )}

      {/* Main Content with Top Padding for Fixed Header */}
      <main className="flex-1 pt-[72px]">
        {children}
      </main>

      {/* Footer - Zukan Style (Simple) */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
        <div className="max-w-[1280px] mx-auto px-4 text-center">
          <div className="flex justify-center gap-6 mb-6 flex-wrap">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-900 font-bold">TOP</Link>
            <Link to="/pokedex" className="text-sm text-gray-500 hover:text-gray-900 font-bold">POKEDEX</Link>
            <Link to="/points" className="text-sm text-gray-500 hover:text-gray-900 font-bold">POINTS</Link>
            {isAuthenticated && (
              <Link to="/mypage" className="text-sm text-gray-500 hover:text-gray-900 font-bold">MY PAGE</Link>
            )}

          </div>
          <p className="text-xs text-gray-400 font-medium">
            © 2025 DiveDex. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};
