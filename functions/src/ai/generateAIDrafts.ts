import { onCall } from "firebase-functions/v2/https";
import { VertexAI, SchemaType } from "@google-cloud/vertexai";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import * as logger from "firebase-functions/logger";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Firestore Caching Logic
 */
async function getCachedGrounding(name: string, type: string) {
  const doc = await db.collection("ai_grounding_cache").doc(`${type}_${name}`).get();
  if (doc.exists) {
    const data = doc.data();
    if (data && Date.now() - data.timestamp < CACHE_TTL_MS) {
      // Ensure the cached result is not empty/broken (must have a description)
      if (data.result && data.result.description && data.result.description.length > 10) {
        return data.result;
      }
    }
  }
  return null;
}

async function setCachedGrounding(name: string, type: string, result: any) {
  await db.collection("ai_grounding_cache").doc(`${type}_${name}`).set({
    result,
    timestamp: Date.now()
  });
}

/**
 * Verification logic for grounding
 */
function shouldGround(draft: any, keywords: string[]): boolean {
  if (draft.needs_search) return true;

  const content = JSON.stringify(draft).toLowerCase();
  const region = (draft.region || "").toLowerCase();
  const description = (draft.description || "").toLowerCase();

  // 1. Specific Hallucination Pattern: "Temperate Area + Tropical Features"
  const isTemperate = region.includes("伊豆") || region.includes("日本海") || region.includes("千葉");
  const hasTropicalFeature = description.includes("サンゴ") || description.includes("トロピカル") || description.includes("透明度30");

  if (isTemperate && hasTropicalFeature) {
    logger.info("Hallucination pattern detected (Temperate + Tropical), triggering grounding.");
    return true;
  }

  // エリア特有の不整合チェック（伊豆・赤沢などでサンゴと言い出したら強制検索）
  const izuTerms = ["伊豆", "赤沢", "富戸", "大瀬崎", "海洋公園"];
  const isIzu = izuTerms.some(term => draft.region?.includes(term) || draft.name?.includes(term) || draft.area?.includes(term));
  if (isIzu && (content.includes("サンゴ礁") || content.includes("リーフ"))) {
    logger.info(`Izu-Area inconsistency detected for ${draft.name}, forcing grounding.`);
    return true;
  }

  // 2. Keyword Check
  return keywords.some(k => content.includes(k.toLowerCase()));
}

const SPOT_KEYWORDS = ["サンゴ", "リーフ", "亀", "ウミガメ", "洞窟", "ドロップオフ", "沈没船", "遺跡", "歴史", "固有種", "透明度"];
const CREATURE_KEYWORDS = ["固有種", "絶滅危惧", "新種", "猛毒", "危険", "学名", "共生", "アジ", "サメ", "マンタ", "イソギンチャク", "クマノミ", "光沢", "色彩"];

/**
 * AI Spot Registration Assistant (with 2-Step Optimized Grounding)
 */
export const generateSpotDraft = onCall({ region: "asia-northeast1" }, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new Error("unauthenticated");

  const spotName = data.spotName;
  if (!spotName) throw new Error("missing-spot-name");

  // 1. Check Cache
  const cached = await getCachedGrounding(spotName, "spot");
  if (cached) return cached;

  const vertexAI = new VertexAI({
    project: process.env.GCLOUD_PROJECT || "wedive-app",
    location: "us-central1"
  });

  const spotSchema = {
    type: SchemaType.OBJECT,
    properties: {
      name: { type: SchemaType.STRING },
      region: { type: SchemaType.STRING },
      zone: { type: SchemaType.STRING },
      area: { type: SchemaType.STRING },
      level: { type: SchemaType.STRING, enum: ["初級", "中級", "上級"] },
      max_depth: { type: SchemaType.NUMBER },
      entry: { type: SchemaType.STRING, enum: ["ビーチ", "ボート", "エントリー容易"] },
      flow: { type: SchemaType.STRING, enum: ["なし", "弱", "強", "ドリフト"] },
      terrain: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      latitude: { type: SchemaType.NUMBER },
      longitude: { type: SchemaType.NUMBER },
      description: { type: SchemaType.STRING },
      tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      is_verified: { type: SchemaType.BOOLEAN },
      sources: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      needs_search: { type: SchemaType.BOOLEAN }
    },
    required: ["name", "region", "area", "description", "level"]
  };

  try {
    // --- Step 1: Internal Draft (Search OFF) ---
    const modelInternal = vertexAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const promptInternal = `
      あなたはダイビングスポットの専門家です。スポット名「${spotName}」について、あなたの内部知識だけでドラフトを作成してください。
      【重要】その海域にその地形や特徴が「本当に存在するか」を批判的に検討してください。
      もし情報の確証がない場合、または最新の海況、最大水深、正確な位置情報、歴史的背景、あるいは「サンゴ」「沈没船」などの事実確認が重要な要素が含まれる場合は、必ず 'needs_search' を true に設定してください。
    `;

    const resultInternal = await modelInternal.generateContent({
      contents: [{ role: "user", parts: [{ text: promptInternal }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: spotSchema }
    });

    const draftText = resultInternal.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!draftText) throw new Error("empty-ai-response");
    let finalResult = JSON.parse(draftText);

    // --- Step 2: Conditional Grounding (Search ON) ---
    if (shouldGround(finalResult, SPOT_KEYWORDS)) {
      logger.info(`Grounding required for spot: ${spotName}`);
      const modelGrounded = vertexAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        tools: [{ googleSearch: {} }] as any
      });

      const promptGrounded = `
        現在、ダイビングスポット「${spotName}」について以下のドラフトを作成しました。
        ---
        ${JSON.stringify(finalResult)}
        ---

        Google検索を使用して、上記の内容が事実（場所、水深、地形、安全性）に基づいているか徹底的に検証してください。
        【最重要】
        1. 「description（説明文）」は絶対に空にしないでください。検索結果とあなたの知識を組み合わせ、ダイバーにそのスポットの魅力を伝える詳細な文章（日本語）を記述してください。もし検索で新しい情報が見つからなくても、内部知識を使って豊かな説明を維持してください。
        2. 正確な座標（latitude, longitude）が見つかった場合は必ず更新してください。
        3. 実在しないスポットや、名前が似ているだけの無関係な場所の情報と混同しないよう注意してください。
      `;

      const resultGrounded = await modelGrounded.generateContent({
        contents: [{ role: "user", parts: [{ text: promptGrounded }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: spotSchema }
      });

      const groundedText = resultGrounded.response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (groundedText) {
        const step1Description = finalResult.description;
        finalResult = JSON.parse(groundedText);

        // Fallback: If grounded step cleared the description, restore it from Step 1
        if (!finalResult.description && step1Description) {
          finalResult.description = step1Description;
        }

        const groundingMetadata = resultGrounded.response.candidates?.[0]?.groundingMetadata;
        if (groundingMetadata?.searchEntryPoint?.renderedContent) {
          finalResult.is_verified = true;
          const sources: string[] = [];
          groundingMetadata.groundingChunks?.forEach((chunk: any) => {
            if (chunk.web?.uri) sources.push(chunk.web.uri);
          });
          finalResult.sources = [...new Set(sources)];
          logger.info(`Grounding successful for spot ${spotName}. Sources: ${finalResult.sources.join(", ")}`);
        }
      }
    } else {
      finalResult.is_verified = false; // Step 1 result is not grounded
      finalResult.sources = [];
    }

    // cleanup internal field
    delete finalResult.needs_search;

    // 3. Set Cache
    await setCachedGrounding(spotName, "spot", finalResult);
    return finalResult;
  } catch (error) {
    logger.error("AI Grounding Error (Spot):", error);
    throw new Error("generation-failed");
  }
});

/**
 * AI Creature Registration Assistant (with 2-Step Optimized Grounding)
 */
export const generateCreatureDraft = onCall({ region: "asia-northeast1" }, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new Error("unauthenticated");

  const creatureName = data.creatureName;
  if (!creatureName) throw new Error("missing-name");

  // 1. Check Cache
  const cached = await getCachedGrounding(creatureName, "creature");
  if (cached) return cached;

  const vertexAI = new VertexAI({
    project: process.env.GCLOUD_PROJECT || "wedive-app",
    location: "us-central1"
  });

  const creatureSchema = {
    type: SchemaType.OBJECT,
    properties: {
      name: { type: SchemaType.STRING },
      scientific_name: { type: SchemaType.STRING },
      category: { type: SchemaType.STRING, enum: ["魚類", "軟骨魚類", "爬虫類", "甲殻類", "軟体動物", "刺胞動物", "哺乳類", "その他"] },
      rarity: { type: SchemaType.STRING, enum: ["Common (★1)", "Rare (★2)", "Epic (★3)", "Legendary (★4)"] },
      description: { type: SchemaType.STRING },
      size: { type: SchemaType.STRING },
      depth_min: { type: SchemaType.NUMBER },
      depth_max: { type: SchemaType.NUMBER },
      seasons: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING, enum: ["春", "夏", "秋", "冬"] } },
      special_traits: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      temp_min: { type: SchemaType.NUMBER },
      temp_max: { type: SchemaType.NUMBER },
      search_tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      is_verified: { type: SchemaType.BOOLEAN },
      needs_search: { type: SchemaType.BOOLEAN }
    },
    required: ["name", "scientific_name", "category", "rarity", "description"]
  };

  try {
    // --- Step 1: Internal Draft ---
    const modelInternal = vertexAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const promptInternal = `
      海洋生物「${creatureName}」について、あなたの内部知識だけで詳細情報を生成してください。
      【重要】その生物の「正確な学名」「生息域（水深・水温）」「特有の生態」が事実に基づいているか批判的に検討してください。
      もし確証がない場合や、間違いやすい情報が含まれる場合は、必ず 'needs_search' を true に設定してください。
    `;

    const resultInternal = await modelInternal.generateContent({
      contents: [{ role: "user", parts: [{ text: promptInternal }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: creatureSchema }
    });

    const draftText = resultInternal.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!draftText) throw new Error("empty-ai-response");
    let finalResult = JSON.parse(draftText);

    // --- Step 2: Conditional Grounding ---
    if (shouldGround(finalResult, CREATURE_KEYWORDS)) {
      logger.info(`Grounding required for creature: ${creatureName}`);
      const modelGrounded = vertexAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        tools: [{ googleSearch: {} }] as any
      });

      const promptGrounded = `
        海洋生物「${creatureName}」について以下のドラフトを確認してください:
        ---
        ${JSON.stringify(finalResult)}
        ---

        Google検索で最新の学名や生態情報を確認し、ドラフトを修正・補完してください。
        【最重要】
        - 「description（説明文）」は絶対に空にせず、ダイビングでの遭遇シーンや見分け方、特徴などを200文字以上の詳細な日本語で記述してください。
        - 検索結果に乏しい場合でも、ドラフトの内容を破棄せず、あなたの知識と統合して返してください。
      `;
      const resultGrounded = await modelGrounded.generateContent({
        contents: [{ role: "user", parts: [{ text: promptGrounded }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: creatureSchema }
      });

      const groundedText = resultGrounded.response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (groundedText) {
        const step1Description = finalResult.description;
        finalResult = JSON.parse(groundedText);

        // Fallback
        if (!finalResult.description && step1Description) {
          finalResult.description = step1Description;
        }

        const groundingMetadata = resultGrounded.response.candidates?.[0]?.groundingMetadata;

        if (groundingMetadata?.searchEntryPoint?.renderedContent) {
          finalResult.is_verified = true;
          const sources: string[] = [];
          groundingMetadata.groundingChunks?.forEach((chunk: any) => {
            if (chunk.web?.uri) sources.push(chunk.web.uri);
          });
          finalResult.sources = [...new Set(sources)];
          logger.info(`Grounding successful for creature ${creatureName}. Sources: ${finalResult.sources.join(", ")}`);
        }
      }
    } else {
      finalResult.is_verified = false;
    }

    delete finalResult.needs_search;

    // 3. Set Cache
    await setCachedGrounding(creatureName, "creature", finalResult);
    return finalResult;
  } catch (error) {
    logger.error("AI Grounding Error (Creature):", error);
    throw new Error("generation-failed");
  }
});
