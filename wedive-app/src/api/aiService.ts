import axios from 'axios';

export interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface AiResponse {
  content: string;
  sessionId?: string;
}

// Firebase Cloud FunctionsのベースURL（.env.localで管理）
const API_BASE_URL = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL;

export const aiService = {
  sendMessage: async (query: string, history: Message[] = []): Promise<AiResponse> => {
    try {
      // ブラウザでのローカル開発時(localhost:8081)は、
      // サーバー側のCORS制限でエラーになる可能性が高いため、
      // タイムアウトやエラーをキャッチしてデモ応答を返します。

      const response = await axios.post(`${API_BASE_URL}/getConciergeResponse`, {
        data: {
          query,
          history: history.length > 0 ? history : undefined
        }
      }, { timeout: 5000 });

      if (response.data && response.data.result) {
        return {
          content: response.data.result.content,
          sessionId: response.data.result.sessionId
        };
      }

      throw new Error('No result');
    } catch (error) {
      console.warn('AI Service (Mock Response Mode):', error);

      // 開発中のためのダミー応答
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        content: `【デモモード】「${query}」についてですね。現在はローカル開発中のためモック応答を返しています。本番環境ではGemini AIが回答します。`
      };
    }
  }
};
