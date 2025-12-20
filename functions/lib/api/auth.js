"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.basicAuth = void 0;
const https_1 = require("firebase-functions/v2/https");
const path = require("path");
/**
 * Basic Authentication Wrapper for Hosting
 *
 * Routes access to index.html based on BASIC_AUTH_USER/PASS environment variables.
 * If these are not set, it serves the file without authentication.
 */
exports.basicAuth = (0, https_1.onRequest)({
    region: "asia-northeast1",
    memory: "256MiB",
    minInstances: 0
}, (req, res) => {
    const user = process.env.BASIC_AUTH_USER;
    const pass = process.env.BASIC_AUTH_PASS;
    // If no auth is configured, just serve index.html directly
    if (!user || !pass) {
        res.sendFile(path.join(__dirname, "../../../dist/index.html"));
        return;
    }
    const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
    const [login, password] = Buffer.from(b64auth, "base64").toString().split(":");
    if (login === user && password === pass) {
        // Auth Success: Serve the SPA index.html
        res.sendFile(path.join(__dirname, "../../../dist/index.html"));
    }
    else {
        // Auth Failure: Trigger browser basic auth dialog
        res.set("WWW-Authenticate", 'Basic realm="Wedive Private Access"');
        res.status(401).send("Authentication required.");
    }
});
//# sourceMappingURL=auth.js.map