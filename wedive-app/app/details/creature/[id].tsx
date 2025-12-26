import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator, Platform, Share as RNShare, View, Text, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Star, Heart, Share2, Info, Edit3, Home, BookOpen, Droplets, Thermometer, Ruler, Zap, MapPin } from 'lucide-react-native';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../../src/firebase';
import { Creature, Rarity, Point, PointCreature } from '../../../src/types';

import { ImageWithFallback } from '../../../src/components/ImageWithFallback';

const { width } = Dimensions.get('window');

const NO_IMAGE_CREATURE = require('../../../assets/images/no-image-creature.png');
const NO_IMAGE_POINT = require('../../../assets/images/no-image-point.png');

export default function CreatureDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [creature, setCreature] = useState<Creature | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || typeof id !== 'string') return;
      try {
        // 1. Fetch Creature
        const docRef = doc(db, 'creatures', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setCreature({ id: docSnap.id, ...docSnap.data() } as Creature);

          // 2. Fetch Related Points
          const pcQuery = query(
            collection(db, 'point_creatures'),
            where('creatureId', '==', id),
            where('status', '==', 'approved'),
            limit(10)
          );
          const pcSnap = await getDocs(pcQuery);
          const pointIds = pcSnap.docs.map(doc => (doc.data() as PointCreature).pointId);

          if (pointIds.length > 0) {
            const pQuery = query(
              collection(db, 'points'),
              where('id', 'in', pointIds.slice(0, 10))
            );
            const pSnap = await getDocs(pQuery);
            setPoints(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Point)));
          }
        } else {
          setCreature(null);
        }
      } catch (error) {
        console.error("Error fetching creature detail data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleShare = async () => {
    try {
      if (!creature) return;
      await RNShare.share({
        message: `${creature.name} (${creature.scientificName || ''}) - WeDiveでチェック！\n#wedive #diving #fish`,
        url: `https://wedive.app/creatures/${creature.id}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (!creature) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>生物が見つかりませんでした。</Text>
        <TouchableOpacity style={styles.backBtnSimple} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rarity = creature.rarity || 'Common';
  const rarityLevel = rarity === 'Legendary' ? 4 : rarity === 'Epic' ? 3 : rarity === 'Rare' ? 2 : 1;

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
            onPress={() => setIsLiked(!isLiked)}
          >
            <Heart size={22} color={isLiked ? "#ef4444" : "#fff"} fill={isLiked ? "#ef4444" : "transparent"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.glassCircle}
            onPress={handleShare}
          >
            <Share2 size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.glassCircle}
            onPress={() => router.push({ pathname: '/details/creature/edit', params: { id: creature.id } })}
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
            source={creature.imageUrl ? { uri: creature.imageUrl } : null}
            fallbackSource={NO_IMAGE_CREATURE}
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
              <TouchableOpacity onPress={() => router.push('/search')} style={styles.breadcrumbItem}>
                <Text style={styles.breadcrumbLink}>{creature.category}</Text>
              </TouchableOpacity>
              {creature.family && (
                <>
                  <Text style={styles.breadcrumbSeparator}>/</Text>
                  <View style={styles.breadcrumbItem}>
                    <Text style={styles.breadcrumbLink}>{creature.family}</Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.rarityBadge}>
              <View style={styles.starsContainer}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Star
                    key={i}
                    size={12}
                    color={i < rarityLevel ? "#fbbf24" : "rgba(255,255,255,0.3)"}
                    fill={i < rarityLevel ? "#fbbf24" : "transparent"}
                  />
                ))}
              </View>
              <Text style={styles.rarityLabel}>{rarity.toUpperCase()}</Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>{creature.name}</Text>
            <Text style={styles.heroSubTitle}>{creature.scientificName}</Text>
          </View>
        </View>

        {/* 3. Main Content */}
        <View style={styles.mainCard}>
          {/* Quick Stats Grid */}
          <View style={styles.statsGrid}>
            <StatItem
              icon={<Ruler size={20} color="#8b5cf6" />}
              label="SIZE"
              value={creature.size || '-'}
              color="#f5f3ff"
            />
            <StatItem
              icon={<Droplets size={20} color="#0ea5e9" />}
              label="DEPTH"
              value={creature.depthRange ? `${creature.depthRange.min}-${creature.depthRange.max}m` : '-'}
              color="#e0f2fe"
            />
            <StatItem
              icon={<Thermometer size={20} color="#f43f5e" />}
              label="TEMP"
              value={creature.waterTempRange ? `${creature.waterTempRange.min}-${creature.waterTempRange.max}℃` : '-'}
              color="#fff1f2"
            />
            <StatItem
              icon={<Zap size={20} color="#f59e0b" />}
              label="SPEED"
              value={creature.stats?.speed ? `${creature.stats.speed}/5` : '-'}
              color="#fffbeb"
            />
          </View>

          {/* Overview Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BookOpen size={20} color="#0ea5e9" />
              <Text style={styles.sectionTitle}>Overview</Text>
            </View>
            <Text style={styles.descriptionText}>
              {creature.description || 'この生物の詳細はまだ登録されていません。'}
            </Text>
          </View>

          {/* Sighted Points List */}
          {points.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Spotted at</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pointScroll}
              >
                {points.map(point => (
                  <TouchableOpacity
                    key={point.id}
                    style={styles.pointCard}
                    onPress={() => router.push(`/details/spot/${point.id}`)}
                  >
                    <ImageWithFallback
                      source={point.imageUrl ? { uri: point.imageUrl } : null}
                      fallbackSource={NO_IMAGE_POINT}
                      style={styles.pointThumb}
                    />
                    <View style={styles.pointInfo}>
                      <Text style={styles.pointName} numberOfLines={1}>{point.name}</Text>
                      <View style={styles.pointLocation}>
                        <MapPin size={10} color="#64748b" />
                        <Text style={styles.pointArea} numberOfLines={1}>{point.area || point.region}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Taxonomy / Detailed Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitleSmall}>Detailed Information</Text>
            <View style={styles.infoList}>
              <InfoRow label="Scientific Name" value={creature.scientificName} italic />
              <InfoRow label="English Name" value={creature.englishName} />
              <InfoRow label="Family" value={creature.family} />
              <InfoRow label="Category" value={creature.category} />
              {creature.season && creature.season.length > 0 && (
                <View style={styles.tagsSection}>
                  <Text style={styles.infoLabelSmall}>BEST SEASON</Text>
                  <View style={styles.tagsRow}>
                    {creature.season.map((s, i) => (
                      <View key={i} style={styles.seasonTag}>
                        <Text style={styles.seasonTagText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Tags */}
          {creature.tags && creature.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitleSmall}>Behavior & Features</Text>
              <View style={styles.tagsContainer}>
                {creature.tags.map((tag, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Copyright Info */}
          {(creature.imageCredit || creature.imageLicense) && (
            <View style={styles.copyrightSection}>
              <Text style={styles.copyrightText}>
                Image by {creature.imageCredit || 'Unknown'}
                {creature.imageLicense ? ` (${creature.imageLicense})` : ''}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 4. Footer Action */}
      <View style={[styles.footerAction, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push({ pathname: '/log/add', params: { creatureId: creature.id, creatureName: creature.name } })}
        >
          <Text style={styles.primaryBtnText}>この生物の目撃ログを書く</Text>
        </TouchableOpacity>
      </View>
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

function InfoRow({ label, value, italic = false }: { label: string, value?: string, italic?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, italic && styles.italic]}>{value}</Text>
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
    opacity: 0.95,
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
    marginBottom: 16,
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
  rarityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  rarityLabel: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 44,
    marginBottom: 4,
  },
  heroSubTitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontStyle: 'italic',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1e293b',
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
    lineHeight: 28,
    color: '#475569',
    fontWeight: '500',
  },
  pointScroll: {
    paddingRight: 24,
    gap: 12,
    paddingTop: 12,
  },
  pointCard: {
    width: 160,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  pointThumb: {
    width: '100%',
    height: 100,
    backgroundColor: '#e2e8f0',
  },
  pointInfo: {
    padding: 10,
  },
  pointName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  pointLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointArea: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  infoList: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    marginLeft: 20,
  },
  italic: {
    fontStyle: 'italic',
  },
  tagsSection: {
    marginTop: 8,
  },
  infoLabelSmall: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '900',
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seasonTag: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  seasonTagText: {
    fontSize: 12,
    color: '#0ea5e9',
    fontWeight: '800',
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
  copyrightSection: {
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  copyrightText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '500',
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
});
