import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Send, Bot, User, Loader2, MapPin, Anchor } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import clsx from 'clsx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: {
    type: 'point' | 'area';
    id: string;
    name: string;
  }[];
}

export const ConciergePage = () => {
  const { points, isAuthenticated, currentUser } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'こんにちは！WeDiveコンシェルジュです。伊豆や沖縄など、あなたにぴったりのダイビングスポットをご案内します。何かお手伝いできることはありますか？'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const getConciergeResponse = httpsCallable(functions, 'getConciergeResponse');
      const response = await getConciergeResponse({ query: input });
      const aiResult = response.data as any;

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: aiResult.content || "申し訳ありません。回答を生成できませんでした。",
        suggestions: aiResult.suggestions || []
      }]);

    } catch (error) {
      console.error("Concierge failed:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "申し訳ありません。AIとの通信中にエラーが発生しました。時間を置いて再度お試しください。"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated && !import.meta.env.DEV) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm w-full">
          <Bot size={48} className="mx-auto text-ocean-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">ログインが必要です</h2>
          <p className="text-gray-500 mb-6">コンシェルジュ機能を利用するにはログインしてください。</p>
          <Link to="/" className="block w-full py-3 rounded-xl font-bold text-white bg-ocean-500 hover:bg-ocean-600 transition-colors">
            トップページへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-72px)] bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 h-16 flex items-center shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-ocean-100 rounded-xl flex items-center justify-center text-ocean-600 shadow-sm border border-ocean-200">
              <Bot size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-none">WeDive コンシェルジュ</h1>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">AI Powered</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide">
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
          {messages.map((message) => (
            <div
              key={message.id}
              className={clsx(
                "flex gap-3 animate-fade-in",
                message.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={clsx(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border transition-all",
                message.role === 'assistant'
                  ? "bg-white border-gray-100 text-ocean-600"
                  : "bg-ocean-500 border-ocean-400 text-white"
              )}>
                {message.role === 'assistant' ? <Bot size={20} /> : <User size={20} />}
              </div>
              <div className={clsx(
                "max-w-[85%] md:max-w-[75%] space-y-2.5",
                message.role === 'user' ? "items-end text-right" : "items-start"
              )}>
                <div
                  className={clsx(
                    "p-4 rounded-2xl text-sm leading-relaxed shadow-sm font-medium",
                    message.role === 'assistant'
                      ? "bg-white text-gray-800 border border-gray-200"
                      : "bg-white border-2 border-ocean-500 text-gray-900" // User requested 'bright blue frame'
                  )}
                >
                  {message.content}
                </div>

                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 opacity-0 animate-[fade-in_0.5s_ease-out_forwards]">
                    {message.suggestions.map((s) => (
                      <Link
                        key={s.id}
                        to={s.type === 'point' ? `/point/${s.id}` : `/points?area=${s.name}`}
                        className="flex items-center gap-1.5 bg-white border border-ocean-100 text-ocean-600 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-ocean-50 hover:border-ocean-300 transition-all shadow-sm group"
                      >
                        {s.type === 'point' ? <Anchor size={12} className="group-hover:rotate-12 transition-transform" /> : <MapPin size={12} />}
                        {s.name} を見る
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 animate-pulse">
              <div className="w-9 h-9 bg-ocean-50 rounded-xl flex items-center justify-center text-ocean-300 border border-ocean-100">
                <Bot size={20} />
              </div>
              <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-ocean-200 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-ocean-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-ocean-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0 z-10 backdrop-blur-lg bg-white/90">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="伊豆で初心者におすすめのポイントは？"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 pl-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-ocean-500 focus:bg-white focus:border-transparent transition-all shadow-inner"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-ocean-600 text-white rounded-xl flex items-center justify-center hover:bg-ocean-700 disabled:opacity-50 disabled:bg-gray-300 transition-all shadow-lg shadow-ocean-100 hover:scale-105 active:scale-95"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
          <div className="flex items-center justify-center gap-4 mt-3">
            <button
              type="button"
              onClick={() => setInput('初心者におすすめのポイント教えて')}
              className="text-[10px] font-bold text-gray-400 hover:text-ocean-500 transition-colors bg-gray-50 px-2 py-1 rounded"
            >
              # 初心者向け
            </button>
            <button
              type="button"
              onClick={() => setInput('カメが見たい')}
              className="text-[10px] font-bold text-gray-400 hover:text-ocean-500 transition-colors bg-gray-50 px-2 py-1 rounded"
            >
              # カメに会いたい
            </button>
            <button
              type="button"
              onClick={() => setInput('沖縄の絶景ポイントは？')}
              className="text-[10px] font-bold text-gray-400 hover:text-ocean-500 transition-colors bg-gray-50 px-2 py-1 rounded"
            >
              # 沖縄・絶景
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
