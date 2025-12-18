import { VertexAI } from "@google-cloud/vertexai";

async function listModels() {
  const project = "dive-dex-app-dev";
  const locations = ["us-central1", "asia-northeast1"];

  for (const location of locations) {
    console.log(`--- Models in ${location} ---`);
    const vertexAI = new VertexAI({ project, location });
    // This is a hacky way to see what's available if there's no listModels in the light SDK
    // But usually, we can just try to see if it lists them in an error or something
    // Better: Search for the current list online.
  }
}
