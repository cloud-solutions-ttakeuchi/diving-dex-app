export interface Region {
  id: string;
  name: string;
  description?: string;
}

export interface Zone {
  id: string;
  name: string;
  regionId: string;
  description?: string;
}

export interface Area {
  id: string;
  name: string;
  zoneId: string;
  regionId: string;
  description?: string;
}

export interface Point {
  id: string;
  name: string;
  areaId: string;
  zoneId: string;
  regionId: string;

  // Hierarchy (Search/Filter)
  region: string;
  zone: string;
  area: string;

  // Attributes
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  maxDepth: number;
  entryType: 'beach' | 'boat' | 'entry_easy';
  current: 'none' | 'weak' | 'strong' | 'drift';

  // Topography & Environment
  topography: string[]; // 'sand', 'rock', 'dropoff', 'cave', 'muck'

  // Content
  description: string;
  features: string[];

  // Location
  coordinates?: {
    lat: number;
    lng: number;
  };
  googlePlaceId?: string; // New: Google Maps Place ID
  formattedAddress?: string; // New: Google Maps Formatted Address

  // System
  status: 'pending' | 'approved' | 'rejected';
  submitterId: string;
  createdAt: string;

  images: string[];
  imageUrl: string; // Main image (keep for compatibility)
  imageKeyword?: string;

  // creatures: string[]; // Removed in favor of PointCreature relation
  bookmarkCount: number;
}

export type DivingPoint = Point;

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export type PointCreature = {
  id: string; // pointId_creatureId
  pointId: string;
  creatureId: string;
  localRarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  lastSighted?: string;
  status: 'approved' | 'pending' | 'deletion_requested' | 'rejected';
  reasoning?: string;    // AIによる紐付け根拠 (Issue #49)
  confidence?: number;   // AIによる信頼度スコア 0.0-1.0 (Issue #49)
};

// --- Master Data Types ---
export interface CertificationRank {
  id: string;
  name: string;
  level: number;
}

export interface CertificationMaster {
  id: string;
  name: string;
  ranks: CertificationRank[];
}

export interface BadgeMaster {
  id: string;
  name: string;
  iconUrl: string;
  condition: {
    type: string;
    threshold: number;
  };
}

// --- Domain Types ---

export interface RankMaster {
  id: string;
  name: string;
  minScore: number;
  roleUpgrade: boolean;
  designColor: string;
  icon: string;
}

export interface User {
  id: string;
  name: string;
  role: 'user' | 'moderator' | 'admin';
  trustScore: number;
  profileImage?: string; // Data URL or path
  logs: string[]; // IDs of logs
  favorites: {
    points: { id: string; isPrimary: boolean }[];
    areas: { id: string; isPrimary: boolean }[];
    shops: { name: string; isPrimary: boolean }[];
    gear: {
      tanks: {
        name: string;
        specs: { material?: 'steel' | 'aluminum'; capacity?: number; gasType?: string; };
        isPrimary: boolean;
      }[];
    };
  };
  favoriteCreatureIds: string[]; // Renamed from favorites
  wanted: string[]; // IDs of wanted creatures
  bookmarkedPointIds: string[]; // IDs of bookmarked points

  // Extended Profile
  certification?: {
    orgId: string;
    rankId: string;
    date: string;
  };
  badges?: {
    badgeId: string;
    earnedAt: string;
  }[];
  subscription?: {
    status: 'active' | 'inactive';
  };

  // Legal
  isTermsAgreed?: boolean; // Deprecated but kept for backward compat if needed? Or just rely on version.
  agreedAt?: string;
  agreedTermsVersion?: string;

  // System
  createdAt?: string;
  status?: UserStatus;
}
export type UserStatus = 'provisional' | 'active' | 'suspended' | 'withdrawn';

export interface Creature {
  id: string;
  name: string;
  scientificName?: string;
  englishName?: string;
  family?: string; // 科目 (例: スズメダイ科)
  category: string;
  description: string;
  rarity: Rarity;
  imageUrl: string;
  tags: string[];

  // Extended Attributes
  depthRange?: { min: number; max: number };
  specialAttributes?: string[]; // e.g., "毒", "擬態", "夜行性"
  waterTempRange?: { min: number; max: number };
  // regions?: string[]; // Removed in favor of PointCreature logic
  status: 'pending' | 'approved' | 'rejected';

  // Legacy/Optional fields
  size?: string;
  season?: string[];
  locationIds?: string[];
  submitterId?: string;
  gallery?: string[];
  stats?: CreatureStats;
  imageCredit?: string;
  imageLicense?: string;
  imageKeyword?: string;
}

export type CreatureStats = {
  popularity: number; // 人気：ダイバーからの人気度、フォトジェニックさ
  size: number;       // 大きさ：物理的なサイズ感
  danger: number;     // 危険度：毒、攻撃性
  lifespan: number;   // 寿命：生物としての寿命の長さ
  rarity: number;     // レア度：遭遇の難易度（高いほどレア）
  speed: number;      // 逃げ足：泳ぐ速さ、撮影難易度
};

export interface DiveLog {
  id: string;
  userId: string;
  date: string;
  diveNumber: number;

  location: {
    pointId: string;
    pointName: string;
    region: string;
    shopName?: string;
    lat?: number;
    lng?: number;
  };

  team?: {
    buddy?: string;
    guide?: string;
    members?: string[];
  };

  time: {
    entry?: string;
    exit?: string;
    duration: number;
    surfaceInterval?: number; // minutes
  };

  depth: {
    max: number;
    average: number;
  };

  condition?: {
    weather?: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
    airTemp?: number;
    waterTemp?: {
      surface?: number;
      bottom?: number;
    };
    transparency?: number;
    wave?: 'none' | 'low' | 'high';
    current?: 'none' | 'weak' | 'strong';
    surge?: 'none' | 'weak' | 'strong';
    waterType?: 'salt' | 'fresh';
  };

  gear?: {
    suitType?: 'wet' | 'dry';
    suitThickness?: number;
    weight?: number;
    tank?: {
      material?: 'steel' | 'aluminum';
      capacity?: number;
      pressureStart?: number;
      pressureEnd?: number;
      gasType?: string; // e.g. "Air", "EANx32"
      oxygen?: number;
    };
  };

  entryType?: 'beach' | 'boat';

  creatureId?: string; // Main creature found (optional link)
  sightedCreatures?: string[]; // IDs of other creatures

  photos: string[];
  comment: string;
  isPrivate: boolean;

  // Social
  likeCount: number;
  likedBy: string[]; // User IDs

  // Legacy compatibility
  spotId: string; // Alias for location.pointId

  // Import Metadata
  title?: string; // Original title from import (e.g. Garmin activity name)
  garminActivityId?: string; // To prevent duplicates

  profile?: {
    depth?: number;
    temp?: number;
    hr?: number;
    time: number; // seconds from start
  }[];

}

export type Log = DiveLog;

// --- Proposal Types ---
export interface EditProposal {
  targetId?: string; // If 'update' or 'delete'
  proposalType: 'create' | 'update' | 'delete';
  diffData?: any; // Partial<Creature> | Partial<Point>
  submitterId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  // For 'create', we might just store the full data in root or diffData?
  // Current implementation stores full data in root of doc.
  // We'll keep compatibility by allowing the doc to have Creature/Point fields directly for 'create'.
  [key: string]: any;
}

export type CreatureProposal = Creature & EditProposal;
export type PointProposal = Point & EditProposal;
