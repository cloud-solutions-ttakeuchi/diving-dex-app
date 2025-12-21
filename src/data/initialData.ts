import type { Region, Zone, Area, Point, Creature, User, Log, Rarity, CreatureStats } from '../types';

// 生成した生物データをインポート
import creaturesSeed from './creatures_seed.json';
import locationsSeed from './locations_seed.json';

// --- Helper Types for JSON Import ---
// JSONファイルの構造に合わせて型を定義
type SeedLocationNode = {
  id: string;
  name: string;
  description?: string;
  type?: 'Region' | 'Zone' | 'Area' | 'Point';
  children?: SeedLocationNode[];
  level?: string;
  maxDepth?: number;
  entryType?: string;
  current?: string;
  topography?: string[];
  features?: string[];
  imageKeyword?: string;
  image?: string;
};


// 1. Locations Loading
const REGIONS: Region[] = [];
const ZONES: Zone[] = [];
const AREAS: Area[] = [];
let POINTS: Point[] = [];

const rawLocations = locationsSeed as SeedLocationNode[];

// Deterministic hash for clean, alphanumeric IDs

rawLocations.forEach(regionNode => {
  const regionId = regionNode.id;

  REGIONS.push({
    id: regionId,
    name: regionNode.name,
    description: regionNode.description || ''
  });

  regionNode.children?.forEach(zoneNode => {
    const zoneId = zoneNode.id;
    ZONES.push({
      id: zoneId,
      name: zoneNode.name,
      regionId: regionId,
      description: zoneNode.description || ''
    });

    zoneNode.children?.forEach(areaNode => {
      const areaId = areaNode.id;
      AREAS.push({
        id: areaId,
        name: areaNode.name,
        zoneId: zoneId,
        regionId: regionId
      });

      areaNode.children?.forEach(pointNode => {
        const pointId = pointNode.id;
        POINTS.push({
          id: pointId,
          name: pointNode.name,
          areaId: areaId,
          zoneId: zoneId,
          regionId: regionId,
          region: regionNode.name,
          zone: zoneNode.name,
          area: areaNode.name,
          level: (pointNode.level as any) || 'Beginner',
          maxDepth: pointNode.maxDepth || 10,
          entryType: (pointNode.entryType as any) || 'boat',
          current: (pointNode.current as any) || 'none',
          topography: (pointNode.topography as any[]) || [],
          features: pointNode.features || [],
          description: pointNode.description || '',
          imageUrl: (pointNode.image && pointNode.image.match(/\((.*?)\)/)?.[1]) || pointNode.image || '',
          images: pointNode.image ? [(pointNode.image.match(/\((.*?)\)/)?.[1] || pointNode.image)] : [],
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

// 2. Creatures Loading (Deduplicated to avoid React Key warnings)
const seenCreatureIds = new Set<string>();
const CREATURES: Creature[] = [];

creaturesSeed.forEach((c: any) => {
  if (seenCreatureIds.has(c.id)) return;
  seenCreatureIds.add(c.id);

  CREATURES.push({
    id: c.id,
    name: c.name,
    scientificName: c.scientificName,
    englishName: c.englishName,
    family: c.family,
    size: c.size,
    category: c.category,
    tags: c.tags,
    description: c.description,
    rarity: (rarityMap[c.rarity] || 'Common') as Rarity,
    imageUrl: c.imageUrl,
    depthRange: c.depthRange,
    waterTempRange: c.waterTempRange,
    specialAttributes: c.specialAttributes,
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
      baseRarity: c.rarity
    })
  });
});

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

  if (c.tags.some(t => ['人気', 'アイドル', '可愛い', '幼魚'].includes(t))) stats.popularity += 30;
  if (c.specialAttributes?.includes('被写体')) stats.popularity += 20;
  if (['ウミウシ', 'クマノミ', 'マンタ', 'カメ'].some(cat => c.category.includes(cat))) stats.popularity = Math.max(stats.popularity, 80 + Math.random() * 20);
  stats.popularity = Math.min(100, stats.popularity + Math.random() * 20);

  if (c.size) {
    const num = parseFloat(c.size.replace(/[^0-9.]/g, ''));
    let cm = num;
    if (c.size.includes('m') && !c.size.includes('cm') && !c.size.includes('mm')) cm = num * 100;
    if (cm <= 2) stats.size = 10;
    else if (cm <= 10) stats.size = 30;
    else if (cm <= 30) stats.size = 50;
    else if (cm <= 100) stats.size = 80;
    else stats.size = 100;
  }

  if (c.specialAttributes?.some(a => ['毒', '噛みつく', '刺す'].includes(a))) stats.danger += 60;
  if (c.category.includes('サメ')) stats.danger += 40;
  stats.danger = Math.min(100, stats.danger);

  if (['カメ', '大物', 'サメ'].some(cat => c.category.includes(cat))) stats.lifespan = 80 + Math.random() * 20;
  else if (['魚類', '回遊魚'].some(cat => c.category.includes(cat))) stats.lifespan = 40 + Math.random() * 20;
  else if (['ウミウシ', '甲殻類'].some(cat => c.category.includes(cat))) stats.lifespan = 10 + Math.random() * 20;

  const rarityVals: Record<string, number> = { 'N': 20, 'Common': 20, 'R': 50, 'Rare': 50, 'SR': 80, 'Epic': 80, 'SSR': 100, 'Legendary': 100 };
  stats.rarity = rarityVals[c.baseRarity] || 30;

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

// 3. Point-Creature Associations Loading
import type { PointCreature } from '../types';
// Use Vite's glob import to optionally load the seed file if it exists
const seedModules = import.meta.glob('./point_creatures_seed.json', { eager: true, import: 'default' });
export const POINT_CREATURES = (seedModules['./point_creatures_seed.json'] as PointCreature[]) || [];

// Update POINTS to add random bookmarks via simpler logic
POINTS = POINTS.map(point => {
  return {
    ...point,
    bookmarkCount: Math.floor(Math.random() * 50)
  };
});

// 4. Initial Logs & Users (Minimal System/Admin Data)
const rawLogs: Partial<Log>[] = [
  {
    id: 'l1', userId: 'u1', diveNumber: 1, date: '2023-08-01',
    location: { pointId: 'p1', pointName: 'フト根', region: '西伊豆', shopName: 'Izu Diving Service' },
    spotId: 'p1', creatureId: '',
    comment: 'First dive! Saw so many fish.',
    depth: { max: 18.0, average: 12.0 }, time: { entry: '10:00', exit: '10:45', duration: 45 },
    condition: { weather: 'sunny', waterTemp: { surface: 26, bottom: 24 }, transparency: 15 },
    gear: { suitType: 'wet', suitThickness: 5, weight: 4, tank: { material: 'steel', capacity: 10, pressureStart: 200, pressureEnd: 50 } },
    entryType: 'boat', photos: [], isPrivate: false, sightedCreatures: [],
    likeCount: 5, likedBy: ['u2', 'u3', 'u4', 'u5', 'u6']
  }
];

const LOGS: Log[] = rawLogs.map(log => {
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
    id: 'u1', name: 'System Admin', role: 'admin', trustScore: 1000, profileImage: undefined, logs: LOGS.map(l => l.id),
    favoriteCreatureIds: [],
    favorites: {
      points: [],
      areas: [],
      shops: [],
      gear: { tanks: [] }
    },
    wanted: [], bookmarkedPointIds: ['p1', 'p4'],
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

console.log('INITIAL_DATA Loaded:', {
  regions: REGIONS.length,
  zones: ZONES.length,
  areas: AREAS.length,
  points: POINTS.length,
  creatures: CREATURES.length,
  pointCreatures: POINT_CREATURES.length
});
