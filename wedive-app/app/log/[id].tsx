import React, { useMemo } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Share, Alert } from 'react-native';
import { View, Text } from '@/components/Themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  Lock
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
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>#{log.diveNumber} {log.title}</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Share2 size={24} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Main Info Card */}
        <View style={styles.mainCard}>
          <View style={styles.dateRow}>
            <View style={styles.dateBadge}>
              <Calendar size={14} color="#64748b" style={{ marginRight: 4 }} />
              <Text style={styles.dateText}>{log.date}</Text>
            </View>
            <View style={styles.diveNumBadge}>
              <Text style={styles.diveNumText}>Dive No. {log.diveNumber}</Text>
            </View>
          </View>

          <Text style={styles.title}>{log.title}</Text>

          <View style={styles.locationContainer}>
            <MapPin size={18} color="#ef4444" />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={styles.pointName}>{log.location.pointName}</Text>
              <Text style={styles.regionName}>{log.location.region}</Text>
            </View>
            {log.isPrivate && (
              <View style={styles.privateBadge}>
                <Lock size={14} color="#64748b" />
                <Text style={styles.privateText}>非公開</Text>
              </View>
            )}
          </View>
        </View>

        {/* Profile Chart (If available) */}
        {profilePoints && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Activity size={18} color="#0ea5e9" />
              <Text style={styles.sectionTitle}>Dive Profile</Text>
            </View>
            <View style={styles.chartContainer}>
              <Svg height={CHART_HEIGHT} width={CHART_WIDTH}>
                {/* Y-axis labels */}
                <SvgText x="0" y="15" fontSize="10" fill="#94a3b8" textAnchor="start">0m</SvgText>
                <SvgText x="0" y={CHART_HEIGHT} fontSize="10" fill="#94a3b8" textAnchor="start">
                  {Math.round(log.depth.max)}m
                </SvgText>

                {/* Profile Line */}
                <Polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="2"
                />

                {/* Surface Line */}
                <Line x1="0" y1="0" x2={CHART_WIDTH} y2="0" stroke="#f1f5f9" strokeWidth="1" />
              </Svg>
              <View style={styles.chartFooter}>
                <Text style={styles.chartTime}>0 min</Text>
                <Text style={styles.chartTime}>{log.time.duration} min</Text>
              </View>
            </View>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Clock size={20} color="#3b82f6" />
            <Text style={styles.statValue}>{log.time.duration}</Text>
            <Text style={styles.statLabel}>min</Text>
          </View>
          <View style={styles.statBox}>
            <Maximize2 size={20} color="#ef4444" />
            <Text style={styles.statValue}>{log.depth.max}</Text>
            <Text style={styles.statLabel}>Max m</Text>
          </View>
          <View style={styles.statBox}>
            <Minimize2 size={20} color="#f59e0b" />
            <Text style={styles.statValue}>{log.depth.average}</Text>
            <Text style={styles.statLabel}>Avg m</Text>
          </View>
          <View style={styles.statBox}>
            <Thermometer size={20} color="#10b981" />
            <Text style={styles.statValue}>{log.condition?.waterTemp?.bottom || '--'}</Text>
            <Text style={styles.statLabel}>Water °C</Text>
          </View>
        </View>

        {/* Condition Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Waves size={18} color="#0ea5e9" />
            <Text style={styles.sectionTitle}>Conditions</Text>
          </View>
          <View style={styles.condRow}>
            <View style={styles.condItem}>
              <Text style={styles.condLabel}>Weather</Text>
              <Text style={styles.condValue}>{log.condition?.weather || 'N/A'}</Text>
            </View>
            <View style={styles.condItem}>
              <Text style={styles.condLabel}>Transparency</Text>
              <Text style={styles.condValue}>{log.condition?.transparency ? `${log.condition.transparency}m` : 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Gear Section */}
        {log.gear && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Settings size={18} color="#64748b" />
              <Text style={styles.sectionTitle}>Gear & Equipment</Text>
            </View>
            <View style={styles.gearTextRow}>
              <Text style={styles.gearLabel}>Suit:</Text>
              <Text style={styles.gearValue}>{log.gear.suitType} {log.gear.suitThickness}mm</Text>
            </View>
            <View style={styles.gearTextRow}>
              <Text style={styles.gearLabel}>Weight:</Text>
              <Text style={styles.gearValue}>{log.gear.weight}kg</Text>
            </View>
            {log.gear.tank && (
              <View style={styles.gearTextRow}>
                <Text style={styles.gearLabel}>Tank:</Text>
                <Text style={styles.gearValue}>
                  {log.gear.tank.material} {log.gear.tank.capacity}L ({log.gear.tank.pressureStart} → {log.gear.tank.pressureEnd} bar)
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Comment Section */}
        {log.comment && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Info size={18} color="#64748b" />
              <Text style={styles.sectionTitle}>Notes</Text>
            </View>
            <Text style={styles.comment}>{log.comment}</Text>
          </View>
        )}

        {/* Sighted Creatures Section */}
        {sightedCreatureDetails.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Heart size={18} color="#ec4899" fill="#ec4899" />
              <Text style={styles.sectionTitle}>Encountered Species</Text>
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
                  />
                  <View style={styles.creatureInfo}>
                    <Text style={styles.creatureName} numberOfLines={1}>{creature.name}</Text>
                    <ChevronRight size={14} color="#94a3b8" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Photos Section */}
        {log.photos && log.photos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ImageIcon size={18} color="#64748b" />
              <Text style={styles.sectionTitle}>Photos</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
              {log.photos.map((uri, idx) => (
                <Image key={idx} source={{ uri }} style={styles.photoItem} />
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
    paddingTop: 45,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginHorizontal: 12,
  },
  shareBtn: {
    padding: 8,
    marginRight: -8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  diveNumBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  diveNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  regionName: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: '#fff',
    width: (width - 60) / 4,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 8,
  },
  chartContainer: {
    marginTop: 10,
    alignItems: 'center',
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
  condRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  condItem: {
    flex: 1,
  },
  condLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  condValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  gearTextRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  gearLabel: {
    fontSize: 14,
    color: '#94a3b8',
    width: 70,
  },
  gearValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  comment: {
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
  },
  photoList: {
    marginTop: 4,
  },
  photoItem: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
  },
  footerSpace: {
    height: 100,
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
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  creatureCard: {
    width: (width - 40 - 40 - 24) / 3, // 3 columns inside section
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  creatureImage: {
    width: '100%',
    height: 'auto',
    aspectRatio: 1.2,
  },
  creatureInfo: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creatureName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  privateText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
});
