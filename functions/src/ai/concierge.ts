import { onCall } from "firebase-functions/v2/https";
import { VertexAI, Tool } from "@google-cloud/vertexai";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Diving Concierge (RAG)
 * Recommends diving spots based on user query and Firestore data.
 * Version A: Managed RAG (Vertex AI Search)
 * Version B: Legacy RAG (Firestore limit 15)
 */
export const getConciergeResponse = onCall({
  region: "asia-northeast1",
  cors: ["https://wedive.app", "https://we-dive.web.app", "http://localhost:5173"]
}, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new Error("unauthenticated");

  const query = data.query;
  if (!query) throw new Error("missing-query");

  const sessionId = data.sessionId;
  let historyInput = data.history || [];

  // --- Feature Flags and Configuration ---
  const useVertexSearch = process.env.USE_VERTEX_AI_SEARCH === "true";
  const dataStoreIds = process.env.VERTEX_AI_CONCIERGE_DATA_STORE_IDS;
  const projectId = process.env.GCLOUD_PROJECT;

  const vertexAI = new VertexAI({
    project: projectId,
    location: "us-central1"
  });

  // --- Session Management (Restore History if sessionId provided) ---
  if (sessionId && historyInput.length === 0) {
    try {
      const sessionDoc = await db.collection("concierge_sessions").doc(sessionId).get();
      if (sessionDoc.exists) {
        historyInput = sessionDoc.data()?.messages || [];
      }
    } catch (e) {
      logger.warn(`[Concierge] Failed to restore session ${sessionId}:`, e);
    }
  }

  // --- User Context Acquisition ---
  let userContext = "";
  if (auth.uid) {
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.data();
    if (userData) {
      const logsCount = userData.logs?.length || 0;
      const favoriteCreatures = (userData.favoriteCreatureIds || []).join(", ") || "未登録";
      userContext = `
【ユーザーのプロフィール】
- 経験本数: ${logsCount}本
- お気に入りの生物: ${favoriteCreatures}
- ユーザーランク: ${userData.role || "user"}
`;
    }
  }

  const tools: Tool[] = [{ googleSearch: {} } as any];
  let legacyContext = "";

  // 1. Determine RAG Data Sources
  if (useVertexSearch && dataStoreIds && projectId) {
    const ids = dataStoreIds.split(",").map(id => id.trim()).filter(id => id.length > 0);
    logger.info(`[Concierge] Using Managed RAG with ${ids.length} DataStore(s): ${dataStoreIds}`);

    ids.forEach(id => {
      tools.push({
        vertexAiSearch: {
          datastore: `projects/${projectId}/locations/global/collections/default_collection/dataStores/${id}`
        }
      } as any);
    });
  } else {
    logger.info("[Concierge] Using Legacy RAG (Firestore limit 15)");
    const spotsSnapshot = await db.collection("points")
      .where("status", "==", "approved")
      .limit(15)
      .get();

    legacyContext = spotsSnapshot.docs.map(doc => {
      const d = doc.data();
      return `スポット名: ${d.name} (${d.area}), レベル: ${d.level}, 特徴: ${d.features}, 深度: ${d.maxDepth}m, 説明: ${d.description}`;
    }).join("\n---\n");
  }

  const systemPrompt = `
あなたはWeDiveのダイビングコンシェルジュとして、ユーザーに親身に寄り添い、最適なダイビング体験を提案するバディです。
${userContext}

【知識ソース】
1. Managed RAG (Vertex AI Search):
   - 独自のダイビングスポット、生物図解、エリア情報を参照します。
   - 特に「wedive-users-ds」というデータストアが利用可能な場合、そこにはこのユーザーの過去のダイビング記録（ログ）が含まれています。必要に応じて参照し、「以前行かれたOOというポイントの近くでおすすめはありますか？」や「以前OOを見たいとおっしゃっていましたね」といった、非常にパーソナライズされた会話を心がけてください。
2. Google検索:
   - 内部データベースにない最新の情報や天候、詳細な目撃情報を補完するために活用してください。
${legacyContext ? `3. スポット情報（直接提供）:\n${legacyContext}` : ""}

【チャットのルール】
- 文脈の理解: 履歴を参照し、「それ」「そこ」「もっと」といった代名詞や文脈を理解した回答を行ってください。
- パーソナライズ: ユーザーの経験本数や好みに合わせ、ビギナーなら安全な場所、ベテランならマニアックな場所などを提案してください。
- トーン: 丁寧でありつつ、ダイバー同士のようなワクワク感を共有できる明るいトーンで話してください。
- 引用: 回答の根拠となった情報源がある場合は、適宜示してください。
`;

  const model = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    tools: tools,
    systemInstruction: {
      role: "system",
      parts: [{ text: systemPrompt }]
    }
  });

  try {
    const chat = model.startChat({
      history: historyInput.map((m: any) => ({
        role: m.role,
        parts: Array.isArray(m.parts) ? m.parts : [{ text: m.parts }]
      }))
    });

    const result = await chat.sendMessage(query);
    const candidate = result.response.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || "申し訳ありません。回答を生成できませんでした。";
    const groundingMetadata = candidate?.groundingMetadata;

    // --- Session Persistence ---
    if (sessionId) {
      const updatedHistory = await chat.getHistory();
      await db.collection("concierge_sessions").doc(sessionId).set({
        messages: updatedHistory,
        updatedAt: new Date().toISOString(),
        userId: auth.uid
      }, { merge: true });
    }

    return {
      content,
      suggestions: [],
      method: useVertexSearch ? "managed-rag" : "legacy-rag",
      groundingMetadata: groundingMetadata || null,
      sessionId: sessionId
    };
  } catch (error) {
    logger.error("Concierge Error:", error);
    throw new Error("generation-failed");
  }
});
