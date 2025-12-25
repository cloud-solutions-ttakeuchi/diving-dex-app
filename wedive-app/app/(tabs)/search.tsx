import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, FlatList, Dimensions, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { Search as SearchIcon, MapPin, Star, ChevronRight, Anchor, BookOpen, Clock, Droplets } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { Point, Creature } from '../../src/types';
import { ImageWithFallback } from '../../src/components/ImageWithFallback';

const { width } = Dimensions.get('window');

const NO_IMAGE_POINT = require('../../assets/images/no-image-point.png');
const NO_IMAGE_CREATURE = require('../../assets/images/no-image-creature.png');

type SearchMode = 'spots' | 'creatures' | 'logs';

export default function SearchScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams();
  const [mode, setMode] = useState<SearchMode>((tab as SearchMode) || 'spots');
  const [searchTerm, setSearchTerm] = useState('');

  const [points, setPoints] = useState<Point[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tab && ['spots', 'creatures', 'logs'].includes(tab as string)) {
      setMode(tab as SearchMode);
    }
  }, [tab]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const pointsQuery = query(collection(db, 'points'));
        const pointsSnapshot = await getDocs(pointsQuery);
        const pointsData = pointsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Point));
        setPoints(pointsData);

        const creaturesQuery = query(collection(db, 'creatures'));
        const creaturesSnapshot = await getDocs(creaturesQuery);
        const creaturesData = creaturesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creature));
        setCreatures(creaturesData);
      } catch (error) {
        console.error("Error fetching search data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredSpots = points.filter(p =>
    (p.name && p.name.includes(searchTerm)) ||
    (p.area && p.area.includes(searchTerm)) ||
    (p.region && p.region.includes(searchTerm))
  );

  const filteredCreatures = creatures.filter(c =>
    (c.name && c.name.includes(searchTerm)) ||
    (c.category && c.category.includes(searchTerm))
  );

  const renderSpotItem = ({ item }: { item: Point }) => (
    <TouchableOpacity
      style={styles.spotCard}
      onPress={() => router.push(`/details/spot/${item.id}`)}
    >
      <ImageWithFallback
        source={item.imageUrl ? { uri: item.imageUrl } : null}
        fallbackSource={NO_IMAGE_POINT}
        style={styles.spotImage}
      />
      <View style={styles.spotInfo}>
        <View style={styles.row}>
          <Text style={styles.spotName}>{item.name}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{item.level}</Text>
          </View>
        </View>
        <View style={styles.locationRow}>
          <MapPin size={12} color="#64748b" />
          <Text style={styles.locationText}>{item.region} • {item.area}</Text>
        </View>
        <View style={styles.featuresRow}>
          {item.features && item.features.map((f, i) => (
            <View key={i} style={styles.featureTag}>
              <Text style={styles.featureText}>#{f}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCreatureItem = ({ item }: { item: Creature }) => (
    <TouchableOpacity
      style={styles.creatureCard}
      onPress={() => router.push(`/details/creature/${item.id}`)}
    >
      <ImageWithFallback
        source={item.imageUrl ? { uri: item.imageUrl } : null}
        fallbackSource={NO_IMAGE_CREATURE}
        style={styles.creatureImage}
      />
      <View style={styles.creatureContent}>
        <View style={styles.creatureInfo}>
          <Text style={styles.creatureCategory}>{item.category}</Text>
          <Text style={styles.creatureName}>{item.name}</Text>
        </View>
        <View style={styles.rarityBadge}>
          <Star size={10} color="#fbbf24" fill="#fbbf24" />
          <Text style={styles.rarityValue}>{item.rarity || 'Common'}</Text>
        </View>
      </View>
      <ChevronRight size={16} color="#cbd5e1" />
    </TouchableOpacity>
  );

  // TODO: Log rendering logic with real data
  const renderLogItem = ({ item }: { item: any }) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>ログ機能は準備中です</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>探す</Text>
        <View style={styles.searchBox}>
          <SearchIcon size={20} color="#94a3b8" />
          <TextInput
            style={styles.input}
            placeholder={mode === 'spots' ? "スポットを検索..." : mode === 'creatures' ? "生物を検索..." : "ログを検索..."}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#94a3b8"
          />
        </View>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'spots' && styles.activeModeBtn]}
            onPress={() => setMode('spots')}
          >
            <MapPin size={16} color={mode === 'spots' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeText, mode === 'spots' && styles.activeModeText]}>スポット</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'creatures' && styles.activeModeBtn]}
            onPress={() => setMode('creatures')}
          >
            <Anchor size={16} color={mode === 'creatures' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeText, mode === 'creatures' && styles.activeModeText]}>生物</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'logs' && styles.activeModeBtn]}
            onPress={() => setMode('logs')}
          >
            <BookOpen size={16} color={mode === 'logs' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeText, mode === 'logs' && styles.activeModeText]}>ログ</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={(mode === 'spots' ? filteredSpots : mode === 'creatures' ? filteredCreatures : []) as any[]}
        renderItem={(mode === 'spots' ? renderSpotItem : mode === 'creatures' ? renderCreatureItem : renderLogItem) as any}
        keyExtractor={item => item.id || Math.random().toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>見つかりませんでした</Text>
            {mode !== 'logs' && (
              <TouchableOpacity
                style={styles.addProposalBtn}
                onPress={() => router.push(mode === 'spots' ? '/details/spot/add' : '/details/creature/add')}
              >
                <Text style={styles.addProposalText}>
                  新しい{mode === 'spots' ? 'スポット' : '生物'}を登録する
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  input: {
    flex: 1,
    marginLeft: 11,
    fontSize: 16,
    color: '#1e293b',
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  activeModeBtn: {
    backgroundColor: '#0ea5e9',
  },
  modeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748b',
  },
  activeModeText: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  spotImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#f1f5f9',
  },
  spotInfo: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  spotName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  levelBadge: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  locationText: {
    fontSize: 13,
    color: '#64748b',
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: 'transparent',
  },
  featureTag: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featureText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  creatureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  creatureImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  creatureContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 12,
    backgroundColor: 'transparent',
  },
  creatureInfo: {
    backgroundColor: 'transparent',
  },
  creatureCategory: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 2,
  },
  creatureName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#334155',
  },
  rarityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rarityValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  emptyText: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    backgroundColor: 'transparent',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  userInfo: {
    backgroundColor: 'transparent',
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  logDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  logImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f1f5f9',
  },
  logContent: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  logPointName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  logCreatureName: {
    fontSize: 13,
    color: '#0ea5e9',
    fontWeight: '600',
    marginBottom: 8,
  },
  logStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  logStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
  },
  logStatText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  logComment: {
    color: '#475569',
    fontStyle: 'italic',
  },
  addProposalBtn: {
    marginTop: 16,
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addProposalText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
