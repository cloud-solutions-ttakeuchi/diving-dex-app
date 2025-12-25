import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator, Platform, Share as RNShare, View, Text, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, MapPin, Droplets, Wind, Mountain, Bookmark, Share, Edit3, Anchor, Home } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../../src/firebase';
import { Point } from '../../../src/types';

import { ImageWithFallback } from '../../../src/components/ImageWithFallback';

const { width } = Dimensions.get('window');

const NO_IMAGE_POINT = require('../../../assets/images/no-image-point.png');

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [point, setPoint] = useState<Point | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    const fetchPoint = async () => {
      if (!id || typeof id !== 'string') return;
      try {
        const docRef = doc(db, 'points', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setPoint({ id: docSnap.id, ...docSnap.data() } as Point);
        } else {
          setPoint(null);
        }
      } catch (error) {
        console.error("Error fetching point:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoint();
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

      {/* 1. 上部のヘッダーボタン */}
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
        {/* 2. ヒーローセクション */}
        <View style={styles.heroContainer}>
          <ImageWithFallback
            source={point.imageUrl ? { uri: point.imageUrl } : null}
            fallbackSource={NO_IMAGE_POINT}
            style={styles.heroImage}
          />
          <View style={styles.heroOverlay} />

          <View style={styles.heroBottom}>
            {/* ナビゲーション（パンくずリスト）を強化 */}
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
              <Text style={styles.levelText}>{point.level.toUpperCase()}</Text>
            </View>
            <Text style={styles.heroTitle} numberOfLines={2}>{point.name}</Text>
          </View>
        </View>

        {/* 3. メインコンテンツ */}
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

      {/* 4. 下部のフッターアクション */}
      <View style={[styles.footerAction, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push({ pathname: '/log/add', params: { pointId: point.id, pointName: point.name } })}
        >
          <Text style={styles.primaryBtnText}>このポイントでログを書く</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
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
});
