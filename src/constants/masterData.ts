import { RankMaster, CertificationMaster, BadgeMaster } from '../types';

export const TRUST_RANKS: RankMaster[] = [
  { id: 'apprentice', name: '見習いダイバー', minScore: 0, roleUpgrade: false, designColor: 'gray-400', icon: 'Droplet' },
  { id: 'explorer', name: '知識の先駆者', minScore: 20, roleUpgrade: false, designColor: 'blue-500', icon: 'Map' },
  { id: 'pioneer', name: '専門家候補', minScore: 50, roleUpgrade: true, designColor: 'purple-500', icon: 'Aperture' },
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
