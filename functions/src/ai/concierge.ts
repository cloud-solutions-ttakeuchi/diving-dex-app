import { onCall } from "firebase-functions/v2/https";
import { VertexAI } from "@google-cloud/vertexai";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Diving Concierge (RAG)
 * Recommends diving spots based on user query and Firestore data.
 */
export const getConciergeResponse = onCall({
  region: "asia-northeast1",
  cors: ["https://wedive.app", "https://we-dive.web.app", "http://localhost:5173"]
}, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new Error("unauthenticated");

  const query = data.query;
  if (!query) throw new Error("missing-query");

  // 1. Simple Grounding (Keyword-ish search in Firestore)
  // In a production app, you might use Vector Search.
  // Here we'll fetch recently active/popular spots for context.
  const spotsSnapshot = await db.collection("points")
    .where("status", "==", "approved")
    .limit(15)
    .get();

  const context = spotsSnapshot.docs.map(doc => {
    const d = doc.data();
    return `スポット名: ${d.name} (${d.area}), レベル: ${d.level}, 特徴: ${d.features}, 深度: ${d.maxDepth}m, 説明: ${d.description}`;
  }).join("\n---\n");

  const vertexAI = new VertexAI({
    project: process.env.GCLOUD_PROJECT || "dive-dex-app-dev",
    location: "us-central1"
  });

  const model = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
  });

  const prompt = `あなたはWeDiveのダイビングコンシェルジュです。
以下のデータベース情報を参考にして、ユーザーの質問に日本語で親身に回答してください。

【ユーザーの質問】
${query}

【データベースからの情報】
${context}

【回答のルール】
- データベースにある具体的なスポット名を1〜2つ挙げて推奨してください。
- ユーザーのスキルレベル（初心者など）に合わせたアドバイスを添えてください。
- 回答は簡潔かつ魅力的にしてください。`;

  try {
    const result = await model.generateContent(prompt);
    const content = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "申し訳ありません。回答を生成できませんでした。";

    // Detect if we should suggest specific IDs back to UI
    // (Simplified: just returning text for now)
    return {
      content,
      suggestions: []
    };
  } catch (error) {
    logger.error("Concierge Error:", error);
    throw new Error("generation-failed");
  }
});
