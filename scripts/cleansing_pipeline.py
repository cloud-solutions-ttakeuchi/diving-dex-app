import json
import os
import argparse
import time
import shutil
from typing import List, Dict, Any
from datetime import datetime, timedelta, timezone
from google import genai
from google.genai import types

# --- Configuration ---
# Allow overriding via environment variables for CI/CD or different projects
# PROJECT_ID is required via env.
PROJECT_ID = (
    os.environ.get("GOOGLE_CLOUD_PROJECT") or
    os.environ.get("GCLOUD_PROJECT") or
    os.environ.get("VITE_FIREBASE_PROJECT_ID")
)
# LOCATION is required via env (e.g. us-central1)
LOCATION = os.environ.get("LOCATION")

if not PROJECT_ID:
    print("❌ Error: PROJECT_ID is not set. Please set GOOGLE_CLOUD_PROJECT environment variable.")
    exit(1)

if not LOCATION:
    print("❌ Error: LOCATION is not set. Please set LOCATION environment variable (e.g. us-central1).")
    exit(1)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "src/data")
CREATURES_FILE = os.path.join(DATA_DIR, "creatures_seed.json")
LOCATIONS_FILE = os.path.join(DATA_DIR, "locations_seed.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "point_creatures_seed.json")

class CleansingPipeline:
    def __init__(self):
        self.model_name = "gemini-2.0-flash-001"
        # Initialize the new Google GenAI Client for Vertex AI
        self.client = genai.Client(
            vertexai=True,
            project=PROJECT_ID,
            location=LOCATION
        )
        self.cache = None

    def load_data(self):
        with open(CREATURES_FILE, 'r', encoding='utf-8') as f:
            self.creatures = json.load(f)
        with open(LOCATIONS_FILE, 'r', encoding='utf-8') as f:
            self.locations = json.load(f)

        self.points = []
        self._extract_points(self.locations)
        print(f"📊 Loaded {len(self.creatures)} creatures and {len(self.points)} points.")

    def _extract_points(self, hierarchy, region="", zone="", area=""):
        for item in hierarchy:
            name = item.get("name", "")
            item_id = item.get("id", "")

            # Identify points by ID prefix 'p_' or by being a leaf node with latitude/longitude
            if item_id.startswith("p_") or ("latitude" in item and "children" not in item):
                self.points.append({
                    "id": item_id,
                    "name": name,
                    "region": region,
                    "zone": zone,
                    "area": area,
                    "maxDepth": item.get("maxDepth", 40),
                    "topography": item.get("topography", [])
                })
            elif "children" in item:
                # Update hierarchy labels
                if not region: r, z, a = name, zone, area
                elif not zone: r, z, a = region, name, area
                else: r, z, a = region, zone, name
                self._extract_points(item["children"], r, z, a)

    def create_context_cache(self):
        """
        Creates a context cache using the new SDK.
        """
        print("💾 Creating Context Cache for Biological Dictionary...")
        system_instruction = (
            "あなたは海洋生物学者です。提供された生物リストの生態に基づき、"
            "特定のダイビングポイントに生息しているか判定します。出力は必ずJSON形式で。"
        )

        creatures_context = "\n".join([
            f"ID:{c['id']} - {c['name']}: {c['description']} (水深:{json.dumps(c.get('depthRange'))})"
            for c in self.creatures
        ])

        # Create cache with 60 minute TTL
        self.cache = self.client.caches.create(
            model=self.model_name,
            config=types.CreateCachedContentConfig(
                display_name="biological_dictionary",
                system_instruction=system_instruction,
                contents=[creatures_context],
                ttl="3600s",
            )
        )
        print(f"✅ Context Cache created: {self.cache.name}")

    def run_stage1_batch(self, point) -> List[Dict[str, Any]]:
        """Stage 1: Batch physical constraint filtering via Cache."""
        # Explicit response schema (Recommended for Gemini 2.0)
        response_schema = {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "creature_id": {"type": "STRING"},
                    "is_possible": {"type": "BOOLEAN"},
                    "rarity": {"type": "STRING"},
                    "confidence": {"type": "NUMBER"}
                },
                "required": ["creature_id", "is_possible"]
            }
        }

        prompt = f"""
        ダイビングポイント「{point['name']}」の条件に基づき、生息可能な生物をキャッシュ内の辞書から**最大20種**抽出してください。
        ポイント水深: {point['maxDepth']}m
        地形: {json.dumps(point['topography'])}

        【条件】
        - 生息がほぼ確実、あるいは可能性が高いもの（is_possible=true）のみを出力してください。
        - 期待される希少度(rarity)、確信度(confidence: 0.0-1.0)を含めてください。
        - 出力は必ず定義されたスキーマに従ったJSON配列形式で行ってください。
        """

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    cached_content=self.cache.name,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                )
            )
            # Use response.text if available, or fall back to candidats
            text = getattr(response, 'text', '')
            if not text and response.candidates:
                text = response.candidates[0].content.parts[0].text

            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            return json.loads(text)
        except Exception as e:
            print(f"⚠️ JSON Parse Error in S1: {e}")
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
        「{point['name']}」({point['region']})での「{creature['name']}」の目撃実績を調査してください。
        回答は必ず指定されたJSONスキーマに従って返してください。
        """

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                    response_mime_type="application/json",
                    response_schema=response_schema,
                )
            )
            text = getattr(response, 'text', '')
            if not text and response.candidates:
                text = response.candidates[0].content.parts[0].text

            return json.loads(text)
        except Exception as e:
            print(f"⚠️ Grounding Error for {creature['name']}: {e}")
            return {"actual_existence": True, "evidence": "Error parsing AI response", "rarity": "Rare"}


    def process(self, mode="new", limit=10):
        self.load_data()
        self.create_context_cache()

        point_creatures = []
        if os.path.exists(OUTPUT_FILE) and mode != "all":
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                point_creatures = json.load(f)

        existing_keys = {f"{pc['pointId']}_{pc['creatureId']}" for pc in point_creatures}

        count = 0
        for p in self.points:
            if count >= limit: break

            print(f"🔍 Point Checking: {p['name']}...")
            s1_results = self.run_stage1_batch(p)

            for res in s1_results:
                if count >= limit: break
                creature_id = res.get("creature_id")
                if not res.get("is_possible") or not creature_id: continue

                key = f"{p['id']}_{creature_id}"
                if mode == "new" and key in existing_keys: continue

                creature = next((c for c in self.creatures if c['id'] == creature_id), None)
                if not creature: continue

                print(f"  🌐 Grounding: {creature['name']}...")
                s2 = self.run_stage2_grounding(p, creature)

                if s2.get("actual_existence"):
                    new_entry = {
                        "id": key,
                        "pointId": p['id'],
                        "creatureId": creature['id'],
                        "localRarity": s2.get("rarity", res.get("rarity", "Rare")),
                        "status": "pending",
                        "reasoning": s2.get("evidence", ""),
                        "confidence": (res.get("confidence", 0.5) + 0.3) / 1.3
                    }
                    # Update or append
                    point_creatures = [pc for pc in point_creatures if pc["id"] != key]
                    point_creatures.append(new_entry)
                    count += 1

            time.sleep(1)

        # Backup & Save
        if os.path.exists(OUTPUT_FILE):
            backup_file = f"{OUTPUT_FILE}.bak"
            shutil.copy2(OUTPUT_FILE, backup_file)
            print(f"📁 Backup created: {backup_file}")

        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(point_creatures, f, indent=2, ensure_ascii=False)
        print(f"🚀 Saved {count} new entries. Total: {len(point_creatures)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["all", "new"], default="new")
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()

    pipeline = CleansingPipeline()
    pipeline.process(mode=args.mode, limit=args.limit)
