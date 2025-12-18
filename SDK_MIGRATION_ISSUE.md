# Issue: SDK Migration to Google Gen AI (@google/genai) and Gemini 3.0 Integration

## Background
The current Vertex AI SDK (`@google-cloud/vertexai`) for Node.js is officially deprecated as of **September 24, 2025**. To leverage the latest Gemini 3.0 series features (Thinking Mode, Agentic Workflows, etc.) and maintain long-term stability, we must migrate to the new **Google Gen AI SDK**.

## Objectives
- [ ] Migrate `functions/package.json` to use `@google/genai` (or the latest unified SDK).
- [ ] Refactor `generateAIDrafts.ts` and other AI functions to use the new SDK syntax.
- [ ] Upgrade models from `gemini-2.0-flash-exp` to `gemini-3-flash-preview` (once stable).
- [ ] Standardize use of the `global` endpoint where required for preview models.

## Tasks
1. **SDK Upgrade**: 
   - Uninstall `@google-cloud/vertexai`.
   - Install `@google/genai`.
2. **Code Refactoring**:
   - Update `VertexAI` initialization to the new `GoogleGenAI` constructor.
   - Adjust `generateContent` calls to match the new SDK signature.
   - Update `responseSchema` handling (modern SDKs have improved structured output support).
3. **Model Selection**:
   - Evaluate `gemini-3-flash` vs `gemini-3-pro` based on cost vs reasoning performance.
4. **Verification**:
   - Ensure "Google Search Grounding" still works correctly with the new SDK tools interface.

## References
- Google Cloud Vertex AI SDK Deprecation Date: **2025-09-24**
- Recommended SDK: **Gen AI SDK**
- Gemini 3.0 Series Status: **Preview** (Agentic capabilities optimized)
