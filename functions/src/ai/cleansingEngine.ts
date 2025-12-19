import { VertexAI, SchemaType } from "@google-cloud/vertexai";
import * as logger from "firebase-functions/logger";

/**
 * High-Precision Biological Mapping Engine (Issue #49)
 */
export class CleansingEngine {
  private vertexAI: VertexAI;
  private modelFlash: any;
  private modelGrounding: any;

  constructor(
    projectId: string = process.env.GCLOUD_PROJECT!,
    location: string = process.env.LOCATION!
  ) {
    if (!location) {
      logger.error("LOCATION environment variable is not set. Vertex AI calls may fail.");
    }
    this.vertexAI = new VertexAI({ project: projectId, location });

    // Stage 1 Model: Gemini 2.0 Flash (Fast & Cheap for Filtering)
    this.modelFlash = this.vertexAI.getGenerativeModel({
      model: "gemini-2.0-flash-001",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            is_possible: { type: SchemaType.BOOLEAN },
            rarity: { type: SchemaType.STRING, enum: ["Common", "Rare", "Epic", "Legendary"] },
            confidence: { type: SchemaType.NUMBER },
            reasoning: { type: SchemaType.STRING }
          },
          required: ["is_possible", "rarity", "confidence", "reasoning"]
        }
      }
    });

    // Stage 2 Model: Gemini 2.0 Flash (with Grounding)
    this.modelGrounding = this.vertexAI.getGenerativeModel({
      model: "gemini-2.0-flash-001",
      tools: [
        { googleSearch: {} } as any
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            actual_existence: { type: SchemaType.BOOLEAN },
            evidence: { type: SchemaType.STRING },
            rarity: { type: SchemaType.STRING, enum: ["Common", "Rare", "Epic", "Legendary"] }
          },
          required: ["actual_existence", "evidence", "rarity"]
        }
      }
    });
  }

  /**
   * Batch Point-Creature Mapping Verification (Optimized with System Instructions)
   */
  async verifyBatch(point: any, creatures: any[]): Promise<any[]> {
    const isDev = process.env.GCLOUD_PROJECT === 'dive-dex-app-dev';
    try {
      if (isDev) logger.info(`[Cleansing] verifyBatch started for ${point.name} with ${creatures.length} creatures.`);

      const modelWithContext = this.vertexAI.getGenerativeModel({
        model: "gemini-2.0-flash-001",
        systemInstruction: `
          あなたは海洋生物学者およびダイビングガイドの専門家です。
          提供された生物リストの生態に基づき、特定のダイビングポイントに生息可能か、または実際に目撃例があるかを判断します。

          【生物辞書データ】
          ${creatures.map((c, i) => `ID:${c.id} - ${c.name}: ${c.description} (生息水深:${JSON.stringify(c.depthRange)})`).join('\n')}

          指示:
          1. 地形・水深・潮流の物理的制約を最優先に考慮してください。
          2. 地理的分布（日本なら伊豆、沖縄、日本海側など）の矛盾を指摘してください。
          3. 出力は必ず指定されたJSON配列形式のみで行ってください。
        `,
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const batchPrompt = `
        以下のポイント環境において、生息可能な生物を辞書から抽出してください。

        【ポイント: ${point.name}】
        エリア: ${point.area} (${point.region})
        最大水深: ${point.maxDepth}m
        地形: ${JSON.stringify(point.topography)}
        潮流: ${point.current}

        出力形式:
        [
          { "creatureId": "string", "is_possible": boolean, "rarity": "Common"|"Rare"|"Epic"|"Legendary", "confidence": float, "reasoning": "string" }
        ]
      `;

      if (isDev) logger.info(`[Cleansing] Calling Stage 1 (Batch) AI for ${point.name}...`);
      const result = await modelWithContext.generateContent(batchPrompt);
      const candidates = result.response.candidates || [];

      if (candidates.length === 0) {
        if (isDev) logger.warn(`[Cleansing] No AI candidates returned for ${point.name}`);
        return [];
      }

      const outputText = candidates[0].content.parts[0].text || "[]";
      if (isDev) logger.info(`[Cleansing] Stage 1 Raw Response: ${outputText}`);

      const jsonMatch = outputText.match(/\[[\s\S]*\]/);
      const results1 = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      if (isDev) logger.info(`[Cleansing] Stage 1 Parsed: ${results1.length} candidates found.`);

      const finalResults = [];
      for (const res of results1) {
        if (!res.is_possible || res.confidence < 0.4) {
          if (isDev) logger.debug(`[Cleansing] Skipping ${res.creatureId}: is_possible=${res.is_possible}, confidence=${res.confidence}`);
          continue;
        }

        const creature = creatures.find(c => c.id === res.creatureId);
        if (!creature) {
          if (isDev) logger.warn(`[Cleansing] Creature ID ${res.creatureId} not found in provided batch.`);
          continue;
        }

        if (isDev) logger.info(`[Cleansing] Starting Stage 2 (Grounding) for ${creature.name}...`);
        const groundedMapping = await this.verifyMapping(point, creature, res);

        if (groundedMapping) {
          const checkStatus = groundedMapping.status === 'pending' ? '✅ Approved' : '❌ Disapproved';
          if (isDev) logger.info(`[Cleansing] Result: ${checkStatus}: ${creature.name} at ${point.name} (Status: ${groundedMapping.status})`);
          finalResults.push(groundedMapping);
        } else {
          if (isDev) logger.info(`[Cleansing] ❌ Rejected during Stage 2: ${creature.name}`);
        }
      }

      return finalResults;

    } catch (error) {
      logger.error(`Batch cleansing failed for ${point.name}:`, error);
      return [];
    }
  }

  /**
   * Single Point-Creature Mapping Verification (Internal Stage 2)
   */
  async verifyMapping(point: any, creature: any, stage1Result?: any): Promise<any> {
    const isDev = process.env.GCLOUD_PROJECT === 'dive-dex-app-dev';
    try {
      // Stage 1 validation if not provided
      let s1 = stage1Result;
      if (!s1) {
        if (isDev) logger.info(`[Cleansing] Stage 1 not provided for ${creature.name}. Running single validation.`);
        const stage1Prompt = `ポイント ${point.name} に生物 ${creature.name} は生息可能か？`;
        const r1 = await this.modelFlash.generateContent(stage1Prompt);
        s1 = JSON.parse(r1.response.candidates[0].content.parts[0].text || '{"is_possible": false}');
      }

      if (!s1.is_possible) return null;

      // Stage 2: Fact Verification (Google Search Grounding)
      const groundingPrompt = `
        「${point.name}」（${point.region} ${point.area}）において、
        生物「${creature.name}」の目撃実績があるかGoogle検索で確認してください。
        回答は必ず以下のJSON形式で。
        {"actual_existence": boolean, "evidence": "string", "rarity": "Common"|"Rare"|"Epic"|"Legendary"}
      `;

      if (isDev) logger.info(`[Cleansing] Calling Stage 2 (Grounding) AI for ${creature.name}...`);
      const result2 = await this.modelGrounding.generateContent(groundingPrompt);
      const text2 = result2.response.candidates[0].content.parts[0].text;
      if (isDev) logger.info(`[Cleansing] Stage 2 Raw Response: ${text2}`);

      const jsonMatch = text2?.match(/\{[\s\S]*\}/);
      const response2 = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      if (!response2.actual_existence && s1.confidence < 0.8) {
        if (isDev) logger.info(`[Cleansing] ${creature.name} rejected: No actual existence found and confidence too low.`);
        return null;
      }

      return {
        pointId: point.id,
        creatureId: creature.id,
        status: response2.actual_existence ? 'pending' : 'rejected',
        localRarity: response2.rarity || s1.rarity || 'Rare',
        confidence: (s1.confidence + (response2.actual_existence ? 0.3 : 0)) / 1.3,
        reasoning: response2.evidence || s1.reasoning,
        method: 'flash-with-grounding'
      };
    } catch (error) {
      if (isDev) logger.error(`[Cleansing] FATAL in verifyMapping for ${creature.name}:`, error);
      return null;
    }
  }
}
