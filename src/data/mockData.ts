import type { Region, Zone, Area, Point, Creature, User, Log, CertificationMaster, BadgeMaster, Rarity, CreatureStats, RankMaster } from '../types';
// 生成した生物データをインポート
import creaturesSeed from '../data/creatures_real.json';
import pointCreaturesSeed from '../data/point_creatures_seed.json';

// --- Helper Types for JSON Import ---
// JSONファイルの構造に合わせて型を定義（アプリのCreature型とは異なる部分があるため）
type SeedCreature = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  description: string;
  baseRarity: string; // JSONではbaseRarity
  image: string;      // JSONではimage
  depthRange: { min: number; max: number };
  waterTempRange: { min: number; max: number };
  specialAttributes?: string[];
  // regions: string[]; // Removed from usage
  size?: string;
  season?: string[];
  imageCredit?: string;
  imageLicense?: string;
  imageKeyword?: string;
};

// --- Master Data ---
export const TRUST_RANKS: RankMaster[] = [
  { id: 'apprentice', name: '見習いダイバー', minScore: 0, roleUpgrade: false, designColor: 'gray-400', icon: 'Droplet' },
  { id: 'explorer', name: '知識の先駆者', minScore: 20, roleUpgrade: false, designColor: 'blue-500', icon: 'Map' },
  { id: 'pioneer', name: '専門家候補', minScore: 50, roleUpgrade: true, designColor: 'purple-500', icon: 'Aperture' }, // ここで昇格！
  { id: 'sage', name: '図鑑の賢者', minScore: 100, roleUpgrade: true, designColor: 'amber-500', icon: 'Crown' }
];

export const CERTIFICATION_MASTER: CertificationMaster = {
  id: 'org_padi',
  name: 'PADI',
  ranks: [
    { id: 'rank_ow', name: 'Open Water Diver', level: 1 },
    { id: 'rank_aow', name: 'Advanced Open Water Diver', level: 2 },
    { id: 'rank_red', name: 'Rescue Diver', level: 3 },
    { id: 'rank_dm', name: 'Divemaster', level: 4 },
    { id: 'rank_inst', name: 'Instructor', level: 5 },
  ]
};

export const BADGE_MASTER: BadgeMaster[] = [
  {
    id: 'bg_izu_master',
    name: '伊豆マスター',
    iconUrl: '/images/badges/izu_master.png',
    condition: { type: 'dive_count_in_zone', threshold: 50 }
  },
  {
    id: 'bg_okinawa_lover',
    name: '沖縄ラバー',
    iconUrl: '/images/badges/okinawa.png',
    condition: { type: 'dive_count_in_zone', threshold: 30 }
  },
  {
    id: 'bg_shark_hunter',
    name: 'シャークハンター',
    iconUrl: '/images/badges/shark.png',
    condition: { type: 'sighting_count', threshold: 10 }
  }
];

// 1. Locations Loading (Flattening JSON)
import locationsSeed from './locations_seed.json';

// Seed Types
type SeedLocationNode = {
  id: string;
  name: string;
  description?: string;
  type?: 'Region' | 'Zone' | 'Area' | 'Point';
  children?: SeedLocationNode[];
  // Point specific fields
  level?: string;
  maxDepth?: number;
  entryType?: string;
  current?: string;
  topography?: string[];
  features?: string[];
  imageKeyword?: string;
  image?: string;
};

const REGIONS: Region[] = [];
const ZONES: Zone[] = [];
const AREAS: Area[] = [];
let POINTS: Point[] = []; // will be updated with creature links

const rawLocations = locationsSeed as SeedLocationNode[];

rawLocations.forEach(regionNode => {
  REGIONS.push({
    id: regionNode.id,
    name: regionNode.name,
    description: regionNode.description || ''
  });

  regionNode.children?.forEach(zoneNode => {
    ZONES.push({
      id: zoneNode.id,
      name: zoneNode.name,
      regionId: regionNode.id,
      description: zoneNode.description || ''
    });

    zoneNode.children?.forEach(areaNode => {
      AREAS.push({
        id: areaNode.id,
        name: areaNode.name,
        zoneId: zoneNode.id
      });

      areaNode.children?.forEach(pointNode => {
        // Points might be raw from generation, ensure fields
        POINTS.push({
          id: pointNode.id,
          name: pointNode.name,
          areaId: areaNode.id,
          region: regionNode.name, // Denormalized for display
          zone: zoneNode.name,
          area: areaNode.name,
          level: (pointNode.level as any) || 'Beginner',
          maxDepth: pointNode.maxDepth || 10,
          entryType: (pointNode.entryType as any) || 'boat',
          current: (pointNode.current as any) || 'none',
          topography: (pointNode.topography as any[]) || [],
          features: pointNode.features || [],
          description: pointNode.description || '',
          // creatures: [], // Populated dynamically later
          // Use provided image or fallback
          imageUrl: pointNode.image || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80',
          images: pointNode.image ? [pointNode.image] : ['https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80'],
          status: 'approved',
          submitterId: 'system',
          createdAt: '2023-01-01T00:00:00Z',
          imageKeyword: pointNode.imageKeyword,
          bookmarkCount: 0
        });
      });
    });
  });
});



// Rarity Mapping
const rarityMap: Record<string, Rarity> = {
  'N': 'Common',
  'R': 'Rare',
  'SR': 'Epic',
  'SSR': 'Legendary',
  'Common': 'Common',
  'Rare': 'Rare',
  'Epic': 'Epic',
  'Legendary': 'Legendary'
};

// 5. Creatures (Imported from JSON)
const CREATURES: Creature[] = creaturesSeed.map((c: SeedCreature) => ({
  id: c.id,
  name: c.name,
  category: c.category,
  tags: c.tags,
  description: c.description,
  rarity: (rarityMap[c.baseRarity] || 'Common') as Rarity,
  imageUrl: c.image,
  depthRange: c.depthRange,
  waterTempRange: c.waterTempRange,
  specialAttributes: c.specialAttributes,
  // regions: c.regions, // Removed from type
  imageCredit: c.imageCredit,
  imageLicense: c.imageLicense,
  imageKeyword: c.imageKeyword,
  status: 'approved',
  stats: calculateCreatureStats({
    name: c.name,
    category: c.category,
    tags: c.tags,
    specialAttributes: c.specialAttributes,
    size: c.size,
    baseRarity: c.baseRarity
  })
}));

function calculateCreatureStats(c: {
  name: string;
  category: string;
  tags: string[];
  specialAttributes?: string[];
  size?: string;
  baseRarity: string;
}): CreatureStats {
  const stats = {
    popularity: 50,
    size: 20,
    danger: 10,
    lifespan: 50,
    rarity: 20,
    speed: 50
  };

  // 1. Popularity (人気)
  if (c.tags.some(t => ['人気', 'アイドル', '可愛い', '幼魚'].includes(t))) stats.popularity += 30;
  if (c.specialAttributes?.includes('被写体')) stats.popularity += 20;
  if (['ウミウシ', 'クマノミ', 'マンタ', 'カメ'].some(cat => c.category.includes(cat))) stats.popularity = Math.max(stats.popularity, 80 + Math.random() * 20);
  stats.popularity = Math.min(100, stats.popularity + Math.random() * 20);

  // 2. Size (大きさ)
  if (c.size) {
    const num = parseFloat(c.size.replace(/[^0-9.]/g, ''));
    let cm = num;
    if (c.size.includes('m') && !c.size.includes('cm') && !c.size.includes('mm')) cm = num * 100;

    // Logarithmic scale attempt: 2cm->10, 30cm->50, 1m->80, 5m->100
    if (cm <= 2) stats.size = 10;
    else if (cm <= 10) stats.size = 30;
    else if (cm <= 30) stats.size = 50;
    else if (cm <= 100) stats.size = 80;
    else stats.size = 100;
  }

  // 3. Danger (危険度)
  if (c.specialAttributes?.some(a => ['毒', '噛みつく', '刺す'].includes(a))) stats.danger += 60;
  if (c.category.includes('サメ')) stats.danger += 40;
  stats.danger = Math.min(100, stats.danger);

  // 4. Lifespan (寿命)
  if (['カメ', '大物', 'サメ'].some(cat => c.category.includes(cat))) stats.lifespan = 80 + Math.random() * 20;
  else if (['魚類', '回遊魚'].some(cat => c.category.includes(cat))) stats.lifespan = 40 + Math.random() * 20;
  else if (['ウミウシ', '甲殻類'].some(cat => c.category.includes(cat))) stats.lifespan = 10 + Math.random() * 20;

  // 5. Rarity (レア度)
  const rarityVals: Record<string, number> = { 'N': 20, 'Common': 20, 'R': 50, 'Rare': 50, 'SR': 80, 'Epic': 80, 'SSR': 100, 'Legendary': 100 };
  stats.rarity = rarityVals[c.baseRarity] || 30;

  // 6. Speed (逃げ足)
  if (['回遊魚', 'サメ', 'アジ', 'マグロ'].some(cat => c.category.includes(cat))) stats.speed = 80 + Math.random() * 20;
  else if (c.tags.some(t => ['擬態', '隠れる'].includes(t))) stats.speed = 40 + Math.random() * 20;
  else if (['ウミウシ', 'サンゴ', '底生'].some(cat => c.category.includes(cat))) stats.speed = 5 + Math.random() * 15;

  return {
    popularity: Math.round(stats.popularity),
    size: Math.round(stats.size),
    danger: Math.round(stats.danger),
    lifespan: Math.round(stats.lifespan),
    rarity: Math.round(stats.rarity),
    speed: Math.round(stats.speed)
  };
}

// 5. Dynamic Linking (生物とポイントの紐付け)
// 代わりに PointCreature 関係テーブルを作成
import type { PointCreature } from '../types';

// Use generated associations
export const POINT_CREATURES: PointCreature[] = pointCreaturesSeed as PointCreature[];

// Removed on-the-fly generation logic
/*
const determineLocalRarity = ...
POINTS = POINTS.map(...)
*/

// Update POINTS to just return point structure (no side-effects needed for POINT_CREATURES population)
POINTS = POINTS.map(point => {
  return {
    ...point,
    bookmarkCount: Math.floor(Math.random() * 50)
  };
});


// 6. Logs (生物IDが変わったため、ログも整合性を取る必要があります)
const rawLogs: Partial<Log>[] = [
  {
    id: 'l1', userId: 'u1', diveNumber: 1, date: '2023-08-01',
    location: { pointId: 'p1', pointName: 'フト根', region: '西伊豆', shopName: 'Izu Diving Service' },
    spotId: 'p1', creatureId: '', // 後で埋める
    comment: 'First dive! Saw so many fish.',
    depth: { max: 18.0, average: 12.0 }, time: { entry: '10:00', exit: '10:45', duration: 45 },
    condition: { weather: 'sunny', waterTemp: { surface: 26, bottom: 24 }, transparency: 15 },
    gear: { suitType: 'wet', suitThickness: 5, weight: 4, tank: { material: 'steel', capacity: 10, pressureStart: 200, pressureEnd: 50 } },
    entryType: 'boat', photos: [], isPrivate: false, sightedCreatures: [],
    likeCount: 5, likedBy: ['u2', 'u3', 'u4', 'u5', 'u6']
  },
  {
    id: 'l2', userId: 'u1', diveNumber: 2, date: '2023-08-01',
    location: { pointId: 'p1', pointName: 'フト根', region: '西伊豆' },
    spotId: 'p1', creatureId: '',
    comment: 'Saw a turtle!',
    depth: { max: 20.0, average: 14.0 }, time: { duration: 50 },
    photos: [], isPrivate: false, sightedCreatures: []
  },
  {
    id: 'l3', userId: 'u1', diveNumber: 3, date: '2023-08-02',
    location: { pointId: 'p1', pointName: 'フト根', region: '西伊豆' },
    spotId: 'p1', creatureId: '',
    comment: 'Huge school.',
    depth: { max: 22.0, average: 15.0 }, time: { duration: 40 },
    photos: [], isPrivate: false, sightedCreatures: []
  },
  {
    id: 'l4', userId: 'u1', diveNumber: 4, date: '2023-09-15',
    location: { pointId: 'p3', pointName: '湾内', region: '西伊豆' },
    spotId: 'p3', creatureId: '',
    comment: 'Tiny frogfish.',
    depth: { max: 15.0, average: 10.0 }, time: { duration: 60 },
    photos: [], isPrivate: false, sightedCreatures: []
  },
  {
    id: 'l5', userId: 'u1', diveNumber: 5, date: '2023-10-10',
    location: { pointId: 'p6', pointName: 'マンタスクランブル', region: '石垣島' },
    spotId: 'p6', creatureId: '',
    comment: 'MANTA!!!',
    depth: { max: 18.0, average: 12.0 }, time: { duration: 50 },
    photos: [], isPrivate: false, sightedCreatures: []
  },
  {
    id: 'l6', userId: 'u1', diveNumber: 6, date: '2023-12-01',
    location: { pointId: 'p4', pointName: '青の洞窟', region: '沖縄本島' },
    spotId: 'p4', creatureId: '',
    comment: 'Nemo found.',
    depth: { max: 10.0, average: 5.0 }, time: { duration: 40 },
    photos: [], isPrivate: false, sightedCreatures: []
  },
];

const LOGS: Log[] = rawLogs.map(log => {
  // ログのポイント情報を元に、そのポイントにいる生物からランダムに1つ選んでcreatureIdにセット
  // POINT_CREATURES を検索
  const validLinks = POINT_CREATURES.filter(pc => pc.pointId === log.spotId);

  const randomCreatureId = validLinks.length > 0
    ? validLinks[Math.floor(Math.random() * validLinks.length)].creatureId
    : (CREATURES[0]?.id || 'unknown');

  return {
    ...log,
    creatureId: randomCreatureId,
    likeCount: log.likeCount || 0,
    likedBy: log.likedBy || []
  } as Log;
});


const USERS: User[] = [
  {
    id: 'u1', name: 'Minarai Diver', role: 'admin', trustScore: 1000, profileImage: undefined, logs: LOGS.map(l => l.id), favorites: [], wanted: [], bookmarkedPointIds: ['p1', 'p4'],
    certification: { orgId: 'org_padi', rankId: 'rank_aow', date: '2020-01-01' },
    badges: [{ badgeId: 'bg_izu_master', earnedAt: '2024-08-10' }]
  }
];

export const INITIAL_DATA = {
  regions: REGIONS,
  zones: ZONES,
  areas: AREAS,
  points: POINTS,
  creatures: CREATURES,
  pointCreatures: POINT_CREATURES,
  users: USERS,
  logs: LOGS,
};
