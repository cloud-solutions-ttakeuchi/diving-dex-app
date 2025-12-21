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

  // --- Feature Flags and Configuration ---
  const useVertexSearch = process.env.USE_VERTEX_AI_SEARCH === "true";
  const dataStoreIds = process.env.VERTEX_AI_CONCIERGE_DATA_STORE_IDS;
  const projectId = process.env.GCLOUD_PROJECT;

  const vertexAI = new VertexAI({
    project: projectId,
    location: "us-central1"
  });

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
  let promptBody = "";
  const tools: Tool[] = [{ googleSearch: {} } as any];

  // 1. Determine RAG Version
  if (useVertexSearch && dataStoreIds && projectId) {
    // --- Managed RAG (Version A) ---
    const ids = dataStoreIds.split(",").map(id => id.trim()).filter(id => id.length > 0);
    logger.info(`[Concierge] Using Managed RAG with ${ids.length} DataStore(s): ${dataStoreIds}`);

    ids.forEach(id => {
      tools.push({
        vertexAiSearch: {
          datastore: `projects/${projectId}/locations/global/collections/default_collection/dataStores/${id}`
        }
      } as any);
    });

    promptBody = `
あなたはWeDiveのダイビングコンシェルジュです。
${userContext}

提供されたデータベース（Vertex AI Search）およびGoogle検索を併用し、ユーザーの質問に日本語で親身に回答してください。

【ユーザーの質問】
${query}

【回答のルール】
- ユーザーの経験本数や好みに基づいて、最適なスポットや生物を提案してください。
- 具体的かつ魅力的なスポット名を挙げて推奨してください。
- データベースに情報がない場合でも、Google検索を使用して正確な情報を提供し、回答の根拠（引用元）を示してください。
- 回答は読みやすく、ダイバーがワクワクするようなトーンにしてください。`;
  } else {
    // --- Legacy RAG (Version B) / Fallback ---
    logger.info("[Concierge] Using Legacy RAG (Firestore limit 15)");

    const spotsSnapshot = await db.collection("points")
      .where("status", "==", "approved")
      .limit(15)
      .get();

    const context = spotsSnapshot.docs.map(doc => {
      const d = doc.data();
      return `スポット名: ${d.name} (${d.area}), レベル: ${d.level}, 特徴: ${d.features}, 深度: ${d.maxDepth}m, 説明: ${d.description}`;
    }).join("\n---\n");

    promptBody = `
あなたはWeDiveのダイビングコンシェルジュです。
${userContext}

以下のデータベース情報を参考にして、ユーザーの質問に日本語で親身に回答してください。

【ユーザーの質問】
${query}

【データベースからの情報】
${context}

【回答のルール】
- ユーザーのスキルレベルや好みに合わせ、データベースから1〜2つのスポットを具体的に選んで推奨してください。
- 回答は簡潔かつ魅力的にしてください。`;
  }

  const model = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    tools: tools.length > 0 ? tools : undefined
  });

  try {
    const response = await model.generateContent(promptBody);
    const candidate = response.response.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || "申し訳ありません。回答を生成できませんでした。";
    const groundingMetadata = candidate?.groundingMetadata;

    return {
      content,
      suggestions: [],
      method: useVertexSearch ? "managed-rag" : "legacy-rag",
      groundingMetadata: groundingMetadata || null
    };
  } catch (error) {
    logger.error("Concierge Error:", error);
    throw new Error("generation-failed");
  }
});
