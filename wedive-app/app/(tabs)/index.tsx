import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Image, TouchableOpacity, ScrollView, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { collection, getDocs, query, limit, orderBy, where } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { Point, Creature } from '../../src/types';
import { Star, MapPin, Sparkles, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ImageWithFallback } from '../../src/components/ImageWithFallback';

const { width } = Dimensions.get('window');

const NO_IMAGE_POINT = require('../../assets/images/no-image-point.png');
const NO_IMAGE_CREATURE = require('../../assets/images/no-image-creature.png');

export default function TabOneScreen() {
  const router = useRouter();
  const [points, setPoints] = useState<Point[]>([]);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Featured Points (Top 5 recently added or by some criteria)
        // For now, simple limit 5
        const pointsQuery = query(collection(db, 'points'), limit(5));
        const pointsSnapshot = await getDocs(pointsQuery);
        const pointsData = pointsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Point));

        // Fetch Popular Creatures (Top 10)
        // Ideally should be sorted by popularity or similar
        const creaturesQuery = query(collection(db, 'creatures'), limit(10));
        const creaturesSnapshot = await getDocs(creaturesQuery);
        const creaturesData = creaturesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creature));

        setPoints(pointsData);
        setCreatures(creaturesData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} stickyHeaderIndices={[0]}>
        {/* Search Header Placeholder */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.logoRow}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoText}><Text style={styles.logoBrand}>We</Text>Dive</Text>
            </View>
            <TouchableOpacity
              style={styles.searchBar}
              onPress={() => router.push('/search')}
            >
              <Text style={styles.searchText}>スポットや生物を検索...</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.aiBadge}>
              <Sparkles size={12} color="#0ea5e9" />
              <Text style={styles.aiBadgeText}>NEW AI FEATURE</Text>
            </View>
            <Text style={styles.heroTitle}>あなただけの{"\n"}<Text style={styles.heroHighlight}>コンシェルジュ</Text></Text>
            <Text style={styles.heroDesc}>最高のダイビングプランをAIと一緒に作りましょう。</Text>
            <TouchableOpacity
              style={styles.heroBtn}
              onPress={() => router.push('/ai')}
            >
              <Text style={styles.heroBtnText}>AIに相談する</Text>
            </TouchableOpacity>
          </View>

          {/* Featured Spot */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>FEATURED SPOTS</Text>
              <TouchableOpacity onPress={() => router.push('/search?tab=spots')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
            </View>
            {points.length === 0 ? (
              <Text style={styles.emptyText}>No spots found.</Text>
            ) : (
              points.map(point => (
                <TouchableOpacity
                  key={point.id}
                  style={styles.pointCard}
                  onPress={() => router.push(`/details/spot/${point.id}`)}
                >
                  <ImageWithFallback
                    source={point.imageUrl ? { uri: point.imageUrl } : null}
                    fallbackSource={NO_IMAGE_POINT}
                    style={styles.pointImage}
                  />
                  <View style={styles.pointInfo}>
                    <View style={styles.levelBadge}>
                      <Text style={styles.levelText}>{point.level}</Text>
                    </View>
                    <Text style={styles.pointName}>{point.name}</Text>
                    <View style={styles.locationRow}>
                      <MapPin size={12} color="#64748b" />
                      <Text style={styles.pointLocation}>{point.region} • {point.area}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Popular Creatures */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>POPULAR CREATURES</Text>
              <TouchableOpacity onPress={() => router.push('/search?tab=creatures')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
            </View>
            <FlatList
              data={creatures}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.creatureList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.creatureCard}
                  onPress={() => router.push(`/details/creature/${item.id}`)}
                >
                  <View style={styles.creatureImageWrapper}>
                    <ImageWithFallback
                      source={item.imageUrl ? { uri: item.imageUrl } : null}
                      fallbackSource={NO_IMAGE_CREATURE}
                      style={styles.creatureImage}
                    />
                  </View>
                  <View style={styles.creatureInfo}>
                    <Text style={styles.creatureCategory}>{item.category}</Text>
                    <Text style={styles.creatureName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.rarityRow}>
                      <Star size={10} color="#fbbf24" fill="#fbbf24" />
                      {/* Note: rarity logic requires complex calculation, falling back to static for now or item.rarity */}
                      <Text style={styles.rarityText}>{item.rarity || 'Common'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </ScrollView>

      {/* Floating Action Button for Add Log */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/log/add')}
      >
        <Plus size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    zIndex: 10,
  },
  headerContent: {
    backgroundColor: 'transparent',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: 2,
    marginBottom: 6,
  },
  logoImage: {
    height: 50,
    width: 50,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: -0.5,
  },
  logoBrand: {
    color: '#0ea5e9',
  },
  searchBar: {
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  searchText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  heroSection: {
    backgroundColor: '#f0f9ff',
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    marginTop: 10,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
    gap: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0ea5e9',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0c4a6e',
    lineHeight: 34,
    marginBottom: 8,
  },
  heroHighlight: {
    color: '#0ea5e9',
  },
  heroDesc: {
    fontSize: 14,
    color: '#38bdf8',
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  pointCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  pointImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#f1f5f9',
  },
  pointInfo: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  levelBadge: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  levelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pointName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
  },
  pointLocation: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  creatureList: {
    paddingRight: 20,
    backgroundColor: 'transparent',
  },
  creatureCard: {
    width: 130,
    marginRight: 16,
    backgroundColor: 'transparent',
  },
  creatureImageWrapper: {
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    marginBottom: 8,
  },
  creatureImage: {
    width: '100%',
    height: '100%',
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
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
  },
  rarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  rarityText: {
    fontSize: 10,
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  heroBtn: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 20,
  },
});
