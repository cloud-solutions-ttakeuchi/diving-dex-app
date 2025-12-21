# Immediate startup log (bypassing logging config to ensure it's seen)
print("🚀 Starting Cleansing Pipeline Script...", flush=True)

import json
import os
import argparse
import time
import logging
from typing import List, Dict, Any
from datetime import datetime, timezone
from google import genai
from google.genai import types
import firebase_admin
from firebase_admin import credentials, firestore
import sys

# --- Logging Configuration ---
log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# --- Configuration ---
PROJECT_ID = (
    os.environ.get("GOOGLE_CLOUD_PROJECT") or
    os.environ.get("GCLOUD_PROJECT") or
    os.environ.get("VITE_FIREBASE_PROJECT_ID")
)
LOCATION = os.environ.get("LOCATION") or os.environ.get("AI_AGENT_LOCATION")

if not PROJECT_ID:
    print("❌ FATAL: PROJECT_ID is not set. Checked: GOOGLE_CLOUD_PROJECT, GCLOUD_PROJECT, VITE_FIREBASE_PROJECT_ID", flush=True)
    sys.exit(1)

if not LOCATION:
    print("❌ FATAL: LOCATION is not set. Checked: LOCATION, AI_AGENT_LOCATION", flush=True)
    sys.exit(1)

print(f"ℹ️ Configured with PROJECT_ID={PROJECT_ID}, LOCATION={LOCATION}, LOG_LEVEL={log_level}", flush=True)

class CleansingPipeline:
    def __init__(self):
        self.model_name = "gemini-2.0-flash-001"
        # Use us-central1 as default for AI if not specified,
        # as gemini-2.0-flash and caching are more likely to be available there.
        self.ai_location = os.environ.get("AI_LOCATION") or "us-central1"
        self.project_id = PROJECT_ID

        logger.info(f"🤖 Initializing GenAI Client (AI_LOCATION={self.ai_location})")
        self.client = genai.Client(
            vertexai=True,
            project=self.project_id,
            location=self.ai_location
        )
        self.cache = None

        # Initialize Firestore
        if not firebase_admin._apps:
            firebase_admin.initialize_app(options={'projectId': PROJECT_ID})
        self.db = firestore.client()

    def load_data(self, filters: Dict[str, Any]):
        """Fetch points and creatures from Firestore based on hierarchy-aware filters."""
        logger.info("📡 Fetching data from Firestore...")

        # 1. Load Creatures (All for context cache)
        creatures_ref = self.db.collection('creatures')
        self.creatures = [doc.to_dict() | {"id": doc.id} for doc in creatures_ref.stream()]

        # 2. Load hierarchy-aware Master data if needed (small collections)
        areas_dict = {doc.id: doc.to_dict() for doc in self.db.collection('areas').stream()}
        zones_dict = {doc.id: doc.to_dict() for doc in self.db.collection('zones').stream()}

        # 3. Load Points and filter in-memory for robustness
        points_ref = self.db.collection('points')
        if filters.get('pointId'):
            # Specific point: direct access
            doc = points_ref.document(filters['pointId']).get()
            raw_points = [doc.to_dict() | {"id": doc.id}] if doc.exists else []
        else:
            # Load all and filter hierarchically
            raw_points = [doc.to_dict() | {"id": doc.id} for doc in points_ref.stream()]

        self.points = []
        for p in raw_points:
            # Direct hierarchy filters check
            if filters.get('area') and p.get('areaId') != filters['area']:
                continue
            if filters.get('zone') and p.get('zoneId') != filters['zone']:
                continue
            if filters.get('region') and p.get('regionId') != filters['region']:
                continue

            self.points.append(p)

        logger.info(f"📊 Loaded {len(self.creatures)} creatures and {len(self.points)} target points.")
        logger.info(f"🔎 Applied Filters: {json.dumps(filters, indent=2)}")

    def create_context_cache(self):
        """Creates a context cache for biological data to save token costs."""
        logger.info("💾 Creating Context Cache for Biological Dictionary...")
        system_instruction = (
            "あなたは海洋生物学者です。提供された生物リストの生態に基づき、"
            "特定のダイビングポイントに生息しているか判定します。出力は必ずJSON形式で。"
        )

        creatures_context = "\n".join([
            f"ID:{c['id']} - {c['name']}: {c.get('description', '')} (水深:{json.dumps(c.get('depthRange'))})"
            for c in self.creatures
        ])

        try:
            self.cache = self.client.caches.create(
                model=self.model_name,
                config=types.CreateCachedContentConfig(
                    display_name=f"bio_cache_{datetime.now(timezone.utc).strftime('%Y%m%d%H')}",
                    system_instruction=system_instruction,
                    contents=[creatures_context],
                    ttl="86400s",
                )
            )
            logger.info(f"✅ Context Cache created: {self.cache.name}")
        except Exception as e:
            logger.warning(f"⚠️ Context Caching not available or failed: {e}. Proceeding without cache (higher token cost).")
            self.cache = None

    def cleanup_cache(self):
        """Deletes the context cache to free up resources immediately."""
        if self.cache:
            try:
                logger.info(f"🧹 Deleting Context Cache: {self.cache.name}")
                self.client.caches.delete(name=self.cache.name)
                self.cache = None
            except Exception as e:
                logger.warning(f"⚠️ Failed to delete cache: {e}")

    def _safe_json_parse(self, text: str):
        """Clean and parse JSON from AI response, with basic truncation recovery."""
        try:
            # Remove Markdown code blocks if present
            clean_text = text.strip()
            if clean_text.startswith("```"):
                lines = clean_text.splitlines()
                if lines[0].startswith("```json"):
                    clean_text = "\n".join(lines[1:-1])
                else:
                    clean_text = "\n".join(lines[1:-1])

            # Attempt to parse
            try:
                return json.loads(clean_text)
            except json.JSONDecodeError as e:
                # If nested in a list and truncated, try to close it
                if clean_text.startswith("[") and not clean_text.endswith("]"):
                    logger.warning("🔍 Attempting to recover from truncated JSON array...")
                    # Find the last complete object
                    last_brace = clean_text.rfind("}")
                    if last_brace != -1:
                        recovered = clean_text[:last_brace+1] + "]"
                        try:
                            return json.loads(recovered)
                        except: pass

                # If nested in an object and truncated, try to close it
                if clean_text.startswith("{") and not clean_text.endswith("}"):
                    logger.warning("🔍 Attempting to recover from truncated JSON object...")
                    last_quote = clean_text.rfind('"')
                    if last_quote != -1:
                        # This is very naive but might handle some cases
                        recovered = clean_text[:last_quote] + '": "truncated"}'
                        try:
                            return json.loads(recovered)
                        except: pass

                raise e
        except Exception as e:
            logger.error(f"Failed to parse JSON: {e}\nRaw Text Preview: {text[:500]}... [Total Length: {len(text)}]")
            return None

    def run_stage1_batch(self, point) -> List[Dict[str, Any]]:
        """Stage 1: Batch physical constraint filtering via Cache."""
        response_schema = {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "creature_id": {"type": "STRING"},
                    "is_possible": {"type": "BOOLEAN"},
                    "rarity": {"type": "STRING"},
                    "confidence": {"type": "NUMBER"},
                    "reasoning": {"type": "STRING"}
                },
                "required": ["creature_id", "is_possible", "rarity", "confidence", "reasoning"]
            }
        }

        # Incorporate filters into instructions to focus the AI
        filter_instr = ""
        if point.get('specific_creature_name'):
             filter_instr = f"- 今回の判定対象は「{point['specific_creature_name']}」1種類のみです。他の生物は一切リストに含めないでください。"
        else:
             filter_instr = "- ポイントの環境に合致する生物をリストから漏れなく抽出してください。"

        prompt = f"""
        あなたは海洋生物学者です。ダイビングポイント「{point['name']}」の環境条件に基づき、提供された生物リストの中から生息可能なものを【IDを正確に保持したまま】抽出してください。

        【ポイント情報】
        - 名前: {point['name']}
        - 最大水深: {point.get('maxDepth', 40)}m
        - 地形: {json.dumps(point.get('topography', []))}

        【指示】
        {filter_instr}
        - IDを一切変更せず、そのまま使用してください（例：c12345）。
        - 生息可能（is_possible=true）な生物のみをリストアップしてください。
        - 期待される希少度(rarity)、確信度(confidence: 0.0-1.0)、理由(reasoning)を含めてください。
        - **理由(reasoning)は100文字以内で簡潔に記述してください。**
        - 出力形式は以下のJSON配列のみとし、それ以外のテキスト（Markdownの装飾等）は含めないでください。

        [
          {{
            "creature_id": "c12345",
            "is_possible": true,
            "rarity": "Common",
            "confidence": 0.9,
            "reasoning": "〇〇は浅瀬の岩場に生息するため、このポイントに適しています。"
          }}
        ]
        """

        logger.debug(f"Stage 1 Prompt for {point['name']}: {prompt}")
        try:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
                max_output_tokens=8192,
            )
            # Use cache only if available
            if self.cache:
                config.cached_content = self.cache.name

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config
            )
            text = getattr(response, 'text', '') or response.candidates[0].content.parts[0].text
            result = self._safe_json_parse(text)
            return result if isinstance(result, list) else []
        except Exception as e:
            # Check if it is a cache expiration error
            error_msg = str(e)
            if "expired" in error_msg.lower() and self.cache:
                logger.warning(f"⚠️ Cache expired during processing. Re-creating cache to maintain cost efficiency...")
                self.create_context_cache()
                # Retry with the newly created cache (if creation succeeded)
                return self.run_stage1_batch(point)

            logger.warning(f"⚠️ Stage 1 Error for {point['name']}: {e}")
            return []

    def run_stage2_grounding(self, point, creature) -> Dict[str, Any]:
        """Stage 2: Factual verification via Google Search Tool."""
        response_schema = {
            "type": "OBJECT",
            "properties": {
                "actual_existence": {"type": "BOOLEAN"},
                "evidence": {"type": "STRING"},
                "rarity": {"type": "STRING"}
            },
            "required": ["actual_existence", "evidence", "rarity"]
        }

        prompt = f"""
        「{point['name']}」（{point.get('region','')}, {point.get('area','')}）において、
        生物「{creature['name']}」の目撃実績や生息情報をGoogle検索で精査してください。
        回答は必ず指定されたJSON形式で。
        """

        logger.debug(f"Stage 2 Prompt for {creature['name']}: {prompt}")
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search_retrieval=types.GoogleSearchRetrieval())],
                    response_mime_type="application/json",
                    response_schema=response_schema,
                    max_output_tokens=4096,
                )
            )
            text = getattr(response, 'text', '') or response.candidates[0].content.parts[0].text
            result = self._safe_json_parse(text)
            return result if isinstance(result, dict) else {"actual_existence": False, "evidence": "Parse Error", "rarity": "Unknown"}
        except Exception as e:
            logger.warning(f"⚠️ Stage 2 Error for {creature['name']}: {e}")
            return {"actual_existence": False, "evidence": str(e), "rarity": "Unknown"}

    def process(self, mode: str, filters: Dict[str, Any], limit: int):
        processed_count = 0
        try:
            self.load_data(filters)
            self.create_context_cache()

            for p in self.points:
                if processed_count >= limit: break
                logger.info(f"🔎 Processing Point: {p['name']} ({p['id']})")

                # Add target creature name to point info for Stage 1 focus
                p['specific_creature_name'] = None
                if filters.get('creatureId'):
                    creature = next((c for c in self.creatures if c['id'] == filters['creatureId']), None)
                    if creature:
                        p['specific_creature_name'] = creature['name']

                s1_results = self.run_stage1_batch(p)
                if not s1_results:
                    logger.warning(f"  ⚠️ Stage 1 returned 0 results for {p['name']}.")
                    continue

                possible_count = sum(1 for r in s1_results if r.get("is_possible"))
                logger.info(f"  ✅ Stage 1: {len(s1_results)} checked, {possible_count} potentially possible.")

                for res in s1_results:
                    if processed_count >= limit: break
                    creature_id = res.get("creature_id")

                    if not res.get("is_possible"):
                        logger.debug(f"  ❌ Skipping: {creature_id} (not possible according to AI)")
                        continue

                    if not creature_id:
                        raise ValueError(f"AI returned an empty creature_id for point {p['name']}")

                    # Optional: pinpoint creature filter
                    if filters.get('creatureId') and creature_id != filters['creatureId']:
                        continue

                    key = f"{p['id']}_{creature_id}"

                    # Check existence in Firestore if mode is 'new'
                    if mode == "new":
                        existing = self.db.collection('point_creatures').document(key).get()
                        if existing.exists:
                            logger.debug(f"  ⏭️ Skipping existing: {creature_id}")
                            continue

                    creature = next((c for c in self.creatures if c['id'] == creature_id), None)
                    if not creature:
                        raise ValueError(f"Creature ID '{creature_id}' returned by AI was NOT found in the biological dictionary. AI may be hallucinating IDs.")

                    # Stage 2: Fact-check with Grounding (Only if Stage 1 is unsure)
                    if res.get("confidence", 0) >= 0.85:
                        logger.info(f"  ✨ AI is confident ({res.get('confidence')}) for {creature['name']}. Saving without search.")
                        s2 = {
                            "actual_existence": True,
                            "evidence": res.get("reasoning"),
                            "rarity": res.get("rarity")
                        }
                    else:
                        logger.info(f"  🌐 AI is unsure. Running Google Search Grounding: {creature['name']}...")
                        s2 = self.run_stage2_grounding(p, creature)

                    # Save result to Firestore
                    status = "pending" if s2.get("actual_existence") else "rejected"

                    # Final check: if rejected but high confidence in S1, maybe it's just 'Rare'
                    if status == "rejected" and res.get("confidence", 0) > 0.8:
                        logger.info(f"  💡 High confidence S1 result kept as 'pending' despite no web evidence.")
                        status = "pending"

                    new_entry = {
                        "pointId": p['id'],
                        "creatureId": creature['id'],
                        "localRarity": s2.get("rarity") or res.get("rarity") or "Rare",
                        "status": status,
                        "reasoning": s2.get("evidence") or res.get("reasoning"),
                        "confidence": (res.get("confidence", 0.5) + (0.3 if s2.get("actual_existence") else 0)) / 1.3,
                        "updatedAt": firestore.SERVER_TIMESTAMP,
                        "method": "python-batch-v1"
                    }

                    self.db.collection('point_creatures').document(key).set(new_entry)
                    logger.info(f"  🚀 [STORED] key={key} | {creature['name']} ({creature_id}) -> status:{status}")
                    processed_count += 1

                    # Small sleep to be nice to API quotas (adjust as needed)
                    time.sleep(0.5)

        finally:
            self.cleanup_cache()

        logger.info(f"🏁 Finished. Processed {processed_count} mappings.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WeDive AI Cleansing Pipeline (Bulk / Specific)")
    parser.add_argument("--mode", choices=["all", "new", "specific", "replace"], default="new", help="all: full scan, new: skip existing, specific: targeted scan, replace: overwrite specific")
    parser.add_argument("--limit", type=int, default=100000, help="Maximum number of mappings to process")
    parser.add_argument("--pointId", help="Target a specific point")
    parser.add_argument("--creatureId", help="Target a specific creature")
    parser.add_argument("--region", help="Filter points by region")
    parser.add_argument("--zone", help="Filter points by zone")
    parser.add_argument("--area", help="Filter points by area")

    args = parser.parse_args()

    filters = {
        "pointId": args.pointId,
        "creatureId": args.creatureId,
        "region": args.region,
        "zone": args.zone,
        "area": args.area
    }

    pipeline = CleansingPipeline()
    pipeline.process(mode=args.mode, filters=filters, limit=args.limit)
