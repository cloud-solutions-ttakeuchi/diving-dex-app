import React, { useMemo } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Share, Alert } from 'react-native';
import { View, Text } from '@/components/Themed';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Clock,
  Thermometer,
  Maximize2,
  Minimize2,
  Wind,
  Droplets,
  Waves,
  ImageIcon,
  Heart,
  ChevronRight,
  Share2,
  Info,
  Settings,
  Activity,
  Edit3,
  Lock,
  Users,
  Compass,
  ArrowUp,
  ArrowDown,
  Navigation
} from 'lucide-react-native';
import Svg, { Polyline, G, Text as SvgText, Line } from 'react-native-svg';
import { useCreatures } from '../../src/hooks/useCreatures';
import { ImageWithFallback } from '../../src/components/ImageWithFallback';

const NO_IMAGE_CREATURE = require('../../assets/images/no-image-creature.png');

const { width } = Dimensions.get('window');

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { logs, user } = useAuth();
  const { data: creatures = [] } = useCreatures();

  const log = useMemo(() => logs.find(l => l.id === id), [logs, id]);

  const sightedCreatureDetails = useMemo(() => {
    if (!log) return [];

    // Convert to IDs and ensure uniqueness
    const ids = new Set<string>();
    if (log.creatureId) ids.add(log.creatureId);
    if (log.sightedCreatures) {
      log.sightedCreatures.forEach(cid => ids.add(cid));
    }

    // Normalize IDs (handling potential prefixes if inconsistent)
    const normalizeId = (id: string) => id.replace(/^[cp]/, '');

    return creatures.filter(c => {
      const nid = normalizeId(c.id);
      return Array.from(ids).some(id => normalizeId(id) === nid);
    });
  }, [log, creatures]);

  if (!log) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={28} color="#0f172a" />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>ログが見つかりませんでした。</Text>
        </View>
      </View>
    );
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${log.date} ${log.title} at ${log.location.pointName} #WeDive`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  // Profile Chart Dimensions
  const CHART_HEIGHT = 150;
  const CHART_WIDTH = width - 40;

  const profilePoints = useMemo(() => {
    if (!log.profile || log.profile.length === 0) return null;

    const maxDepth = Math.max(...log.profile.map(p => p.depth || 0), 1);
    const maxTime = log.profile[log.profile.length - 1].time;

    return log.profile.map(p => ({
      x: (p.time / maxTime) * CHART_WIDTH,
      y: ((p.depth || 0) / (maxDepth * 1.2)) * CHART_HEIGHT,
    }));
  }, [log]);

  const polylinePoints = useMemo(() => {
    return profilePoints?.map(p => `${p.x},${p.y}`).join(' ');
  }, [profilePoints]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Back Button and Title Header - Maintaining Base Design */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color="#0f172a" />
          <Text style={styles.backLabel}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ログ詳細</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleShare} style={styles.headerIconBtn}>
            <Share2 size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Main Photo Area */}
        {log.photos && log.photos.length > 0 && (
          <View style={styles.photoContainer}>
            <Image source={{ uri: log.photos[0] }} style={styles.mainImage} />
            <TouchableOpacity style={styles.imageOverlayBtn} activeOpacity={0.8}>
              <ImageIcon size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Info Area */}
        <View style={styles.infoCard}>
          <View style={styles.metaRow}>
            <View style={styles.dateBadge}>
              <Calendar size={12} color="#64748b" style={{ marginRight: 4 }} />
              <Text style={styles.metaText}>{log.date}</Text>
            </View>
            {(log.time.entry || log.time.exit) && (
              <View style={styles.timeBadge}>
                <Clock size={12} color="#64748b" style={{ marginRight: 4 }} />
                <Text style={styles.metaText}>
                  {log.time.entry || '--:--'} - {log.time.exit || '--:--'} ({log.time.duration}min)
                </Text>
              </View>
            )}
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>{log.title || `${log.location.pointName} ログ`}</Text>
          </View>

          <View style={styles.pointRow}>
            <MapPin size={14} color="#64748b" style={{ marginRight: 4 }} />
            <Text style={styles.pointLabel}>Point:</Text>
            <Text style={styles.pointName}>{log.location.pointName}</Text>
          </View>

          <View style={styles.locationRow}>
            <MapPin size={16} color="#ef4444" />
            <Text style={styles.locationDetailText}>
              {log.location.region}{log.location.shopName ? ` / ${log.location.shopName}` : ''}
            </Text>
          </View>

          <View style={styles.metaBadgeRow}>
            <View style={styles.diveNumBadge}>
              <Text style={styles.diveNumText}>Dive No. {log.diveNumber}</Text>
            </View>
            {log.isPrivate && (
              <View style={styles.privateBadge}>
                <Lock size={12} color="#64748b" />
                <Text style={styles.privateText}>非公開</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Activity size={18} color="#3b82f6" />
            <Text style={styles.sectionTitle}>ダイブデータ</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>最大水深</Text>
              <Text style={styles.statValue}>{log.depth.max}<Text style={styles.statUnit}>m</Text></Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>平均水深</Text>
              <Text style={styles.statValue}>{log.depth.average}<Text style={styles.statUnit}>m</Text></Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>透明度</Text>
              <Text style={styles.statValue}>{log.condition?.transparency || '--'}<Text style={styles.statUnit}>m</Text></Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>水温 (底)</Text>
              <Text style={styles.statValue}>{log.condition?.waterTemp?.bottom || '--'}<Text style={styles.statUnit}>°C</Text></Text>
            </View>
          </View>
        </View>

        {/* Profile Chart Section */}
        {profilePoints && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Activity size={18} color="#0ea5e9" />
              <Text style={styles.sectionTitle}>詳細データ</Text>
            </View>
            <View style={styles.chartContainer}>
              <Svg height={CHART_HEIGHT} width={CHART_WIDTH}>
                <Polyline
                  points={polylinePoints}
                  fill="rgba(14, 165, 233, 0.1)"
                  stroke="#0ea5e9"
                  strokeWidth="2"
                />
                <Line x1="0" y1="0" x2={CHART_WIDTH} y2="0" stroke="#f1f5f9" strokeWidth="1" />
              </Svg>
              <View style={styles.chartFooter}>
                <Text style={styles.chartTime}>0 min</Text>
                <Text style={styles.chartTime}>{log.time.duration} min</Text>
              </View>
            </View>
          </View>
        )}

        {/* Condition Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Waves size={18} color="#0ea5e9" />
            <Text style={styles.sectionTitle}>コンディション</Text>
          </View>
          <View style={styles.dataGrid}>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>天気</Text>
              <Text style={styles.dataValue}>{log.condition?.weather || '--'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>気温</Text>
              <Text style={styles.dataValue}>{log.condition?.airTemp ? `${log.condition.airTemp}°C` : '--'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>水温 (面)</Text>
              <Text style={styles.dataValue}>{log.condition?.waterTemp?.surface ? `${log.condition.waterTemp.surface}°C` : '--'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>波</Text>
              <Text style={styles.dataValue}>{log.condition?.wave || '--'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>流れ</Text>
              <Text style={styles.dataValue}>{log.condition?.current || '--'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>うねり</Text>
              <Text style={styles.dataValue}>{log.condition?.surge || '--'}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>エントリー</Text>
              <Text style={styles.dataValue}>{log.entryType === 'beach' ? 'ビーチ' : log.entryType === 'boat' ? 'ボート' : '--'}</Text>
            </View>
            {log.time.surfaceInterval && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>水面休息</Text>
                <Text style={styles.dataValue}>{log.time.surfaceInterval}min</Text>
              </View>
            )}
          </View>
        </View>

        {/* Gear Section */}
        {log.gear && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Settings size={18} color="#64748b" />
              <Text style={styles.sectionTitle}>器材・タンク</Text>
            </View>
            <View style={styles.gearBox}>
              <View style={styles.gearRow}>
                <Text style={styles.gearLabel}>スーツ</Text>
                <Text style={styles.gearValue}>
                  {log.gear.suitType === 'wet' ? 'ウェット' : log.gear.suitType === 'dry' ? 'ドライ' : '--'} {log.gear.suitThickness || ''}mm
                </Text>
                <Text style={styles.gearLabel}>タンク</Text>
                <Text style={styles.gearValue}>
                  {log.gear.tank?.material === 'steel' ? 'スチール' : log.gear.tank?.material === 'aluminum' ? 'アルミ' : '--'} {log.gear.tank?.capacity || ''}L
                </Text>
              </View>
              <View style={styles.gearRow}>
                <Text style={styles.gearLabel}>ウェイト</Text>
                <Text style={styles.gearValue}>{log.gear.weight ? `${log.gear.weight}kg` : '--'}</Text>
                <Text style={styles.gearLabel}>空気圧</Text>
                <Text style={styles.gearValue}>
                  {log.gear.tank?.pressureStart || '--'} → {log.gear.tank?.pressureEnd || '--'} bar
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Team Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={18} color="#a855f7" />
            <Text style={styles.sectionTitle}>チーム</Text>
          </View>
          <View style={styles.teamGrid}>
            <View style={styles.teamItem}>
              <Text style={styles.teamLabel}>ガイド:</Text>
              <Text style={styles.teamValue}>{log.team?.guide || '--'}</Text>
            </View>
            <View style={styles.teamItem}>
              <Text style={styles.teamLabel}>バディ:</Text>
              <Text style={styles.teamValue}>{log.team?.buddy || '--'}</Text>
            </View>
            {log.team?.members && log.team.members.length > 0 && (
              <View style={[styles.teamItem, { width: '100%' }]}>
                <Text style={styles.teamLabel}>メンバー:</Text>
                <Text style={styles.teamValue}>{log.team.members.join(', ')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Creatures Section */}
        {sightedCreatureDetails.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Heart size={18} color="#ec4899" fill="#ec4899" />
              <Text style={styles.sectionTitle}>生物</Text>
            </View>
            <View style={styles.creatureGrid}>
              {sightedCreatureDetails.map(creature => (
                <TouchableOpacity
                  key={creature.id}
                  style={styles.creatureCard}
                  onPress={() => router.push(`/details/creature/${creature.id}`)}
                >
                  <ImageWithFallback
                    source={{ uri: creature.imageUrl }}
                    style={styles.creatureImage}
                    fallbackSource={NO_IMAGE_CREATURE}
                    resizeMode="cover"
                  /><View style={styles.creatureInfo}>
                    <Text style={styles.creatureName} numberOfLines={1}>{creature.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Comment Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Info size={18} color="#64748b" />
            <Text style={styles.sectionTitle}>コメント</Text>
          </View>
          <View style={styles.commentContainer}>
            <Text style={styles.commentText}>{log.comment || 'コメントなし'}</Text>
          </View>
        </View>

        {/* Photos List (Thumbnail list) */}
        {log.photos && log.photos.length > 1 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ImageIcon size={18} color="#64748b" />
              <Text style={styles.sectionTitle}>その他の写真</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
              {log.photos.map((uri, idx) => (
                <Image key={idx} source={{ uri }} style={styles.photoThumb} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.footerSpace} />
      </ScrollView>

      {/* Action FABs (If owner) */}
      {user?.id === log.userId && (
        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={[styles.fab, styles.editFab]}
            onPress={() => router.push(`/log/edit/${id}`)}
          >
            <Edit3 size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    height: 100,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backLabel: {
    fontSize: 16,
    color: '#0f172a',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  headerIconBtn: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  photoContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlayBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
  },
  infoCard: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    lineHeight: 16,
  },
  titleRow: {
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 32,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pointLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginRight: 6,
  },
  pointName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  locationDetailText: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
    lineHeight: 20,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diveNumBadge: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  diveNumText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    width: (width - 40 - 12) / 2,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 28,
  },
  statUnit: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 2,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  chartTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dataItem: {
    width: '50%',
    marginBottom: 16,
  },
  dataLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 16,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 20,
  },
  gearBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  gearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 4,
  },
  gearLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    width: 60,
    lineHeight: 16,
  },
  gearValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
    lineHeight: 20,
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  teamItem: {
    width: (width - 40 - 12) / 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamLabel: {
    fontSize: 12,
    color: '#64748b',
    marginRight: 4,
  },
  teamValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 18,
  },
  creatureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-start',
  },
  creatureCard: {
    width: (width - 40 - 12) / 2,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  creatureImage: {
    width: '100%',
    height: (width - 40 - 12) / 2,
  },
  creatureInfo: {
    padding: 8,
    alignItems: 'center',
  },
  creatureName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
  },
  commentContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
  photoList: {
    marginTop: 8,
  },
  photoThumb: {
    width: 160,
    height: 120,
    borderRadius: 8,
    marginRight: 12,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginLeft: 8,
  },
  privateText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  footerSpace: {
    height: 80,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  editFab: {
    backgroundColor: '#0ea5e9',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
});
