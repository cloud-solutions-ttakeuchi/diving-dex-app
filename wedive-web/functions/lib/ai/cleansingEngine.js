"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleansingEngine = void 0;
const vertexai_1 = require("@google-cloud/vertexai");
const logger_1 = require("../utils/logger");
/**
 * High-Precision Biological Mapping Engine (Issue #49)
 */
class CleansingEngine {
    constructor(projectId = process.env.GCLOUD_PROJECT, location = process.env.LOCATION) {
        if (!projectId) {
            logger_1.logger.error("GCLOUD_PROJECT environment variable is not set. Vertex AI calls will fail.");
        }
        if (!location) {
            logger_1.logger.error("LOCATION environment variable is not set. Vertex AI calls may fail.");
        }
        this.vertexAI = new vertexai_1.VertexAI({ project: projectId, location });
        // Stage 1 Model: Gemini 2.0 Flash (Fast & Cheap for Filtering)
        this.modelFlash = this.vertexAI.getGenerativeModel({
            model: "gemini-2.0-flash-001",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: vertexai_1.SchemaType.OBJECT,
                    properties: {
                        is_possible: { type: vertexai_1.SchemaType.BOOLEAN },
                        rarity: { type: vertexai_1.SchemaType.STRING, enum: ["Common", "Rare", "Epic", "Legendary"] },
                        confidence: { type: vertexai_1.SchemaType.NUMBER },
                        reasoning: { type: vertexai_1.SchemaType.STRING }
                    },
                    required: ["is_possible", "rarity", "confidence", "reasoning"]
                }
            }
        });
        // Stage 2 Model: Gemini 2.0 Flash (with Grounding)
        this.modelGrounding = this.vertexAI.getGenerativeModel({
            model: "gemini-2.0-flash-001",
            tools: [
                { googleSearch: {} }
            ],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: vertexai_1.SchemaType.OBJECT,
                    properties: {
                        actual_existence: { type: vertexai_1.SchemaType.BOOLEAN },
                        evidence: { type: vertexai_1.SchemaType.STRING },
                        rarity: { type: vertexai_1.SchemaType.STRING, enum: ["Common", "Rare", "Epic", "Legendary"] }
                    },
                    required: ["actual_existence", "evidence", "rarity"]
                }
            }
        });
    }
    /**
     * Batch Point-Creature Mapping Verification (Optimized with System Instructions)
     */
    async verifyBatch(point, creatures) {
        try {
            logger_1.logger.info(`[Cleansing] verifyBatch started for ${point.name} with ${creatures.length} creatures.`);
            const modelWithContext = this.vertexAI.getGenerativeModel({
                model: "gemini-2.0-flash-001",
                systemInstruction: `
          あなたは海洋生物学者およびダイビングガイドの専門家です。
          提供された生物リストの生態に基づき、特定のダイビングポイントに生息可能か、または実際に目撃例があるかを判断します。

          【生物辞書データ】
          ${creatures.map((c) => `ID:${c.id} - ${c.name}: ${c.description} (生息水深:${JSON.stringify(c.depthRange)})`).join('\n')}

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
            logger_1.logger.debug(`[Cleansing] Calling Stage 1 (Batch) AI for ${point.name}...`);
            const result = await modelWithContext.generateContent(batchPrompt);
            const candidates = result.response.candidates || [];
            if (candidates.length === 0) {
                logger_1.logger.warn(`[Cleansing] No AI candidates returned for ${point.name}`);
                return [];
            }
            const outputText = candidates[0].content.parts[0].text || "[]";
            logger_1.logger.debug(`[Cleansing] Batch Prompt for ${point.name}: ${batchPrompt}`);
            const jsonMatch = outputText.match(/\[[\s\S]*\]/);
            const results1 = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
            logger_1.logger.info(`[Cleansing] Batch success: ${results1.length} items parsed.`);
            const finalResults = [];
            for (const res of results1) {
                if (!res.is_possible || res.confidence < 0.4) {
                    logger_1.logger.debug(`[Cleansing] Skipping ${res.creatureId}: is_possible=${res.is_possible}, confidence=${res.confidence}`);
                    continue;
                }
                const creature = creatures.find(c => c.id === res.creatureId);
                if (!creature) {
                    logger_1.logger.warn(`[Cleansing] Creature ID ${res.creatureId} not found in provided batch.`);
                    continue;
                }
                logger_1.logger.info(`[Cleansing] Starting Stage 2 (Grounding) for ${creature.name}...`);
                const groundedMapping = await this.verifyMapping(point, creature, res);
                if (groundedMapping) {
                    const checkStatus = groundedMapping.status === 'pending' ? '✅ Approved' : '❌ Disapproved';
                    logger_1.logger.info(`[Cleansing] Result: ${checkStatus}: ${creature.name} at ${point.name} (Status: ${groundedMapping.status})`);
                    finalResults.push(groundedMapping);
                }
                else {
                    logger_1.logger.info(`[Cleansing] ❌ Rejected during Stage 2: ${creature.name}`);
                }
            }
            return finalResults;
        }
        catch (error) {
            logger_1.logger.error(`Batch cleansing failed for ${point.name}:`, error);
            return [];
        }
    }
    /**
     * Single Point-Creature Mapping Verification (Internal Stage 2)
     */
    async verifyMapping(point, creature, stage1Result) {
        try {
            logger_1.logger.info(`[Cleansing] Stage 2 Grounding started for ${creature.name} at ${point.name}`);
            // Stage 1 validation if not provided
            let s1 = stage1Result;
            if (!s1) {
                logger_1.logger.info(`[Cleansing] Stage 1 not provided for ${creature.name}. Running single validation.`);
                const stage1Prompt = `ポイント ${point.name} に生物 ${creature.name} は生息可能か？`;
                const r1 = await this.modelFlash.generateContent(stage1Prompt);
                s1 = JSON.parse(r1.response.candidates[0].content.parts[0].text || '{"is_possible": false}');
            }
            if (!s1.is_possible)
                return null;
            // Stage 2: Fact Verification (Google Search Grounding)
            const groundingPrompt = `
        「${point.name}」（${point.region} ${point.area}）において、
        生物「${creature.name}」の目撃実績があるかGoogle検索で確認してください。
        回答は必ず以下のJSON形式で。
        {"actual_existence": boolean, "evidence": "string", "rarity": "Common"|"Rare"|"Epic"|"Legendary"}
      `;
            logger_1.logger.info(`[Cleansing] Calling Stage 2 (Grounding) AI for ${creature.name}...`);
            const result2 = await this.modelGrounding.generateContent(groundingPrompt);
            const text2 = result2.response.candidates[0].content.parts[0].text;
            logger_1.logger.debug(`[Cleansing] Stage 2 Raw Response: ${text2}`);
            const jsonMatch = text2?.match(/\{[\s\S]*\}/);
            const response2 = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
            if (!response2.actual_existence && s1.confidence < 0.8) {
                logger_1.logger.info(`[Cleansing] ${creature.name} rejected: No actual existence found and confidence too low.`);
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
        }
        catch (error) {
            logger_1.logger.error(`[Cleansing] Error in verifyMapping for ${creature.name}:`, error);
            return null;
        }
    }
}
exports.CleansingEngine = CleansingEngine;
//# sourceMappingURL=cleansingEngine.js.map