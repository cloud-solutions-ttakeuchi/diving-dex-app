import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { VertexAI } from "@google-cloud/vertexai";
import * as logger from "firebase-functions/logger";

// Cloud Firestore triggers

/**
 * Automatic Multilingual Translation Trigger
 * Activates when a point's description is updated.
 */
export const onPointUpdateTranslate = onDocumentUpdated({
  document: "points/{pointId}",
  region: "asia-northeast1"
}, async (event) => {
  const newData = event.data?.after.data();
  const oldData = event.data?.before.data();

  // Only translate if description changed
  if (!newData || !oldData || newData.description === oldData.description) {
    return;
  }

  const vertexAI = new VertexAI({
    project: process.env.GCLOUD_PROJECT,
    location: "asia-northeast1"
  });

  const model = vertexAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: `あなたはダイビング専門の翻訳者です。
ダイビング特有の専門用語を正しく反映した自然な文章を作成してください。
例:
- 「中性浮力」 -> "neutral buoyancy"
- 「根」 -> "reef" or "rock formation"
- 「透視度」 -> "visibility"
- 「ドロップオフ」 -> "drop-off"
各言語（英語、簡体字中国語、韓国語）で自然な翻訳を生成してください。`
  });

  const prompt = `以下のダイビングスポットの説明文を、英語(en)、中国語(zh)、韓国語(ko)に翻訳してください。
結果は以下のJSON形式で返してください:
{
  "en": "...",
  "zh": "...",
  "ko": "..."
}

原文:
${newData.description}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (responseText) {
      const translations = JSON.parse(responseText.replace(/```json|```/g, '').trim());

      // Save translations back to Firestore (e.g., in a 'translations' field or subcollection)
      await event.data?.after.ref.update({
        translations: translations,
        lastTranslatedAt: new Date().toISOString()
      });

      logger.info(`Translated point ${event.params.pointId} successfully.`);
    }
  } catch (error) {
    logger.error("Translation Error:", error);
  }
});
