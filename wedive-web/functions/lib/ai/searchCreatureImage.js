"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchCreatureImage = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
/**
 * Search Wikipedia for creature images.
 */
exports.searchCreatureImage = (0, https_1.onCall)({
    region: "asia-northeast1",
    cors: true
}, async (request) => {
    const { auth, data } = request;
    if (!auth)
        throw new Error("unauthenticated");
    const { query, lang = 'ja' } = data;
    if (!query)
        throw new Error("missing-query");
    logger.info(`🔍 Searching Wikipedia for: ${query} (${lang})`);
    try {
        const baseUrl = `https://${lang}.wikipedia.org/w/api.php`;
        const params = new URLSearchParams({
            action: "query",
            format: "json",
            prop: "pageimages|pageterms",
            piprop: "original",
            titles: query,
            pithumbsize: "500",
            redirects: "1",
            origin: "*"
        });
        const response = await fetch(`${baseUrl}?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Wikipedia API responded with status: ${response.status}`);
        }
        const json = await response.json();
        const pages = json.query?.pages || {};
        for (const pageId in pages) {
            const page = pages[pageId];
            if (pageId === "-1" || !page.original)
                continue;
            return {
                imageUrl: page.original.source,
                imageCredit: `Wikipedia (${lang})`,
                imageLicense: "CC BY-SA",
                title: page.title
            };
        }
        // Try English if Japanese failed and it's not already English
        if (lang === 'ja') {
            const enParams = new URLSearchParams({
                action: "query",
                format: "json",
                prop: "pageimages|pageterms",
                piprop: "original",
                titles: query,
                pithumbsize: "500",
                redirects: "1",
                origin: "*"
            });
            const enResponse = await fetch(`https://en.wikipedia.org/w/api.php?${enParams.toString()}`);
            if (enResponse.ok) {
                const enJson = await enResponse.json();
                const enPages = enJson.query?.pages || {};
                for (const pId in enPages) {
                    const p = enPages[pId];
                    if (pId === "-1" || !p.original)
                        continue;
                    return {
                        imageUrl: p.original.source,
                        imageCredit: "Wikipedia (en)",
                        imageLicense: "CC BY-SA",
                        title: p.title
                    };
                }
            }
        }
        return { error: "no-image-found" };
    }
    catch (error) {
        logger.error("Wikipedia Search Error:", error);
        return { error: "search-failed" };
    }
});
//# sourceMappingURL=searchCreatureImage.js.map