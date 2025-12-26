import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator, Platform, Share as RNShare, View, Text, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, MapPin, Droplets, Wind, Mountain, Bookmark, Share, Edit3, Anchor, Home, Star } from 'lucide-react-native';
import { doc, getDoc, collection, query, where, getDocs, limit, setDoc } from 'firebase/firestore';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../../src/firebase';
import { Point, Creature, PointCreature, Rarity } from '../../../src/types';
import { useAuth } from '../../../src/context/AuthContext';
import { CreatureSelectorModal } from '../../../src/components/CreatureSelectorModal';
import { RaritySelectorModal } from '../../../src/components/RaritySelectorModal';
import { Alert } from 'react-native';

import { ImageWithFallback } from '../../../src/components/ImageWithFallback';

const { width } = Dimensions.get('window');

const NO_IMAGE_POINT = require('../../../assets/images/no-image-point.png');
const NO_IMAGE_CREATURE = require('../../../assets/images/no-image-creature.png');

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [point, setPoint] = useState<Point | null>(null);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const [showCreatureModal, setShowCreatureModal] = useState(false);
  const [showRarityModal, setShowRarityModal] = useState(false);
  const [selectedCreature, setSelectedCreature] = useState<Creature | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || typeof id !== 'string') return;
      try {
        // 1. Fetch Point
        const docRef = doc(db, 'points', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const pointData = { id: docSnap.id, ...docSnap.data() } as Point;
          setPoint(pointData);

          // 2. Fetch Related Creatures
          const pcQuery = query(
            collection(db, 'point_creatures'),
            where('pointId', '==', id),
            where('status', 'in', ['approved', 'pending']),
            limit(20)
          );
          const pcSnap = await getDocs(pcQuery);
          const creatureLinks = pcSnap.docs.map(doc => doc.data() as PointCreature);
          const creatureIds = creatureLinks.map(link => link.creatureId);

          if (creatureIds.length > 0) {
            // Firestore 'in' query has a limit of 10-30 items depending on SDK version
            const cQuery = query(
              collection(db, 'creatures'),
              where('id', 'in', creatureIds.slice(0, 10))
            );
            const cSnap = await getDocs(cQuery);
            const creatureDocs = cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creature));

            // Map back to include the point_creature status
            const data = creatureLinks
              .map(link => {
                const doc = creatureDocs.find(c => c.id === link.creatureId);
                return doc ? { ...doc, _linkStatus: link.status } : null;
              })
              .filter((c): c is Creature & { _linkStatus: PointCreature['status'] } => c !== null);

            setCreatures(data as any);
          }
        } else {
          setPoint(null);
        }
      } catch (error) {
        console.error("Error fetching spot detail data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleShare = async () => {
    try {
      if (!point) return;
      await RNShare.share({
        message: `${point.name} - WeDiveでチェック！\n#wedive #diving`,
        url: `https://wedive.app/points/${point.id}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreatureSelect = (creature: Creature) => {
    setSelectedCreature(creature);
    setShowCreatureModal(false);
    setShowRarityModal(true);
  };

  const handleSubmitDiscovery = async (rarity: Rarity) => {
    if (!selectedCreature || !point || !user) return;
    setIsSubmitting(true);
    setShowRarityModal(false);

    try {
      const relId = `${point.id}_${selectedCreature.id}`;
      const pointCreatureData: PointCreature = {
        id: relId,
        pointId: point.id,
        creatureId: selectedCreature.id,
        localRarity: rarity,
        status: (user.role === 'admin' || user.role === 'moderator') ? 'approved' : 'pending',
      };

      await setDoc(doc(db, 'point_creatures', relId), pointCreatureData);

      Alert.alert(
        'ありがとうございます！',
        user.role === 'admin' ? '生物情報を登録しました。' : '生物発見情報を送信しました。管理者の承認をお待ちください。',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error submitting discovery:', error);
      Alert.alert('エラー', '失敗しました。');
    } finally {
      setIsSubmitting(false);
      setSelectedCreature(null);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (!point) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>スポットが見つかりませんでした。</Text>
        <TouchableOpacity style={styles.backBtnSimple} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* 1. Header Buttons */}
      <View style={[styles.floatingHeader, { top: insets.top || 40 }]}>
        <TouchableOpacity
          style={styles.glassCircle}
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.rightButtons}>
          <TouchableOpacity
            style={styles.glassCircle}
            onPress={() => setIsBookmarked(!isBookmarked)}
          >
            <Bookmark size={22} color={isBookmarked ? "#f59e0b" : "#fff"} fill={isBookmarked ? "#f59e0b" : "transparent"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.glassCircle}
            onPress={handleShare}
          >
            <Share size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.glassCircle}
            onPress={() => router.push({ pathname: '/details/spot/edit', params: { id: point.id } })}
          >
            <Edit3 size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {/* 2. Hero Section */}
        <View style={styles.heroContainer}>
          <ImageWithFallback
            source={point.imageUrl ? { uri: point.imageUrl } : null}
            fallbackSource={NO_IMAGE_POINT}
            style={styles.heroImage}
          />
          <View style={styles.heroOverlay} />

          <View style={styles.heroBottom}>
            {/* Breadcrumbs */}
            <View style={styles.breadcrumb}>
              <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.breadcrumbItem}>
                <Home size={14} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.breadcrumbSeparator}>/</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/search', params: { region: point.region } })} style={styles.breadcrumbItem}>
                <Text style={styles.breadcrumbLink}>{point.region}</Text>
              </TouchableOpacity>
              <Text style={styles.breadcrumbSeparator}>/</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/search', params: { region: point.region, area: point.area } })} style={styles.breadcrumbItem}>
                <Text style={styles.breadcrumbLink}>{point.area || "All"}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{(point.level || 'Unknown').toUpperCase()}</Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>{point.name}</Text>
          </View>
        </View>

        {/* 3. Main Content */}
        <View style={styles.mainCard}>
          <View style={styles.statsGrid}>
            <StatItem icon={<Droplets size={20} color="#0ea5e9" />} label="DEPTH" value={`${point.maxDepth || '-'}m`} color="#e0f2fe" />
            <StatItem icon={<Wind size={20} color="#22c55e" />} label="CURRENT" value={point.current || 'None'} color="#f0fdf4" />
            <StatItem icon={<Mountain size={20} color="#d946ef" />} label="TERRAIN" value={point.topography?.[0] || 'Natural'} color="#fdf4ff" />
            <StatItem icon={<Anchor size={20} color="#f97316" />} label="ENTRY" value={point.entryType || 'Boat'} color="#fff7ed" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.descriptionText}>
              {point.description || 'スポットの詳細情報はまだ登録されていません。'}
            </Text>
          </View>

          {/* Confirmed Creatures List */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderBetween}>
              <Text style={styles.sectionTitle}>Confirmed Species</Text>
              {isAuthenticated && (
                <TouchableOpacity
                  style={styles.addLinkBtn}
                  onPress={() => setShowCreatureModal(true)}
                >
                  <Star size={14} color="#0ea5e9" />
                  <Text style={styles.addLinkBtnText}>生物を追加</Text>
                </TouchableOpacity>
              )}
            </View>
            {creatures.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.creatureScroll}
              >
                {creatures.map(creature => (
                  <TouchableOpacity
                    key={creature.id}
                    style={styles.creatureCard}
                    onPress={() => router.push(`/details/creature/${creature.id}`)}
                  >
                    <ImageWithFallback
                      source={(creature as any).imageUrl ? { uri: (creature as any).imageUrl } : null}
                      fallbackSource={NO_IMAGE_CREATURE}
                      style={styles.creatureThumb}
                    />
                    {(creature as any)._linkStatus === 'pending' && (
                      <View style={styles.pendingBadgeMini}>
                        <Text style={styles.pendingBadgeTextMini}>提案中</Text>
                      </View>
                    )}
                    <View style={styles.creatureInfo}>
                      <Text style={styles.creatureName} numberOfLines={1}>{creature.name}</Text>
                      <View style={styles.rarityStars}>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Star
                            key={i}
                            size={10}
                            color={i < (creature.rarity === 'Legendary' ? 4 : creature.rarity === 'Epic' ? 3 : creature.rarity === 'Rare' ? 2 : 1) ? "#fbbf24" : "#e2e8f0"}
                            fill={i < (creature.rarity === 'Legendary' ? 4 : creature.rarity === 'Epic' ? 3 : creature.rarity === 'Rare' ? 2 : 1) ? "#fbbf24" : "transparent"}
                          />
                        ))}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>まだ登録された生物がいません。</Text>
                {isAuthenticated && (
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => setShowCreatureModal(true)}
                  >
                    <Text style={styles.emptyAddBtnText}>あなたが見つけた生物を追加する</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {point.features && point.features.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitleSmall}>Highlights</Text>
              <View style={styles.tagsContainer}>
                {point.features.map((f, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>#{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitleSmall}>Location Map</Text>
            <View style={styles.mapCard}>
              <View style={styles.mapContainer}>
                {point.coordinates ? (
                  <MapView
                    style={styles.map}
                    initialRegion={{
                      latitude: point.coordinates.lat,
                      longitude: point.coordinates.lng,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    <Marker
                      coordinate={{
                        latitude: point.coordinates.lat,
                        longitude: point.coordinates.lng,
                      }}
                    />
                  </MapView>
                ) : (
                  <View style={styles.noMap}>
                    <MapPin size={32} color="#cbd5e1" />
                    <Text style={styles.noMapText}>No location data</Text>
                  </View>
                )}
              </View>
              <View style={styles.mapFooter}>
                <Text style={styles.addressText} numberOfLines={1}>{point.formattedAddress || point.area || point.name}</Text>
                <TouchableOpacity onPress={() => router.push('/search')}>
                  <View style={styles.addressBadge}>
                    <Text style={styles.addressBadgeText}>一覧へ</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 4. Footer Action */}
      <View style={[styles.footerAction, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push({ pathname: '/log/add', params: { pointId: point.id, pointName: point.name } })}
        >
          <Text style={styles.primaryBtnText}>このポイントでログを書く</Text>
        </TouchableOpacity>
      </View>

      <CreatureSelectorModal
        isVisible={showCreatureModal}
        onClose={() => setShowCreatureModal(false)}
        onSelect={handleCreatureSelect}
      />

      <RaritySelectorModal
        isVisible={showRarityModal}
        onClose={() => setShowRarityModal(false)}
        onSelect={handleSubmitDiscovery}
        title={selectedCreature?.name || '発見報告'}
      />

      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

function StatItem({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  return (
    <View style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  floatingHeader: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1000,
  },
  rightButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  glassCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroContainer: {
    width: width,
    height: 480,
    backgroundColor: '#0f172a',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  heroBottom: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  breadcrumbLink: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  breadcrumbSeparator: {
    color: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 8,
    fontWeight: '900',
  },
  levelBadge: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  levelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 42,
  },
  mainCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    marginTop: -40,
    paddingTop: 30,
    paddingHorizontal: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statBox: {
    width: (width - 48 - 14) / 2,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '900',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1e293b',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 14,
  },
  sectionTitleSmall: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#475569',
    fontWeight: '500',
  },
  creatureScroll: {
    paddingRight: 24,
    gap: 12,
  },
  creatureCard: {
    width: 140,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  creatureThumb: {
    width: '100%',
    height: 100,
    backgroundColor: '#e2e8f0',
  },
  creatureInfo: {
    padding: 10,
  },
  creatureName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  rarityStars: {
    flexDirection: 'row',
    gap: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
  },
  mapCard: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  mapContainer: {
    height: 180,
    backgroundColor: '#e2e8f0',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  noMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMapText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 6,
  },
  mapFooter: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    flex: 1,
    marginRight: 10,
  },
  addressBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addressBadgeText: {
    fontSize: 10,
    color: '#0369a1',
    fontWeight: '900',
  },
  footerAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  primaryBtn: {
    backgroundColor: '#0ea5e9',
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  errorText: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 20,
  },
  backBtnSimple: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backBtnText: {
    color: '#0ea5e9',
    fontWeight: '800',
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  addLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  addLinkBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0ea5e9',
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyAddBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0ea5e9',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  pendingBadgeMini: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeTextMini: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
});
