import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, MapPin, Droplets, Wind, Mountain, Bookmark, Share } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../src/firebase';
import { Point } from '../../../src/types';

import { ImageWithFallback } from '../../../src/components/ImageWithFallback';

const { width } = Dimensions.get('window');

const NO_IMAGE_POINT = require('../../../assets/images/no-image-point.png');

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [point, setPoint] = useState<Point | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        <Text>スポットが見つかりませんでした。</Text>
        <TouchableOpacity style={styles.backBtnSimple} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <ImageWithFallback
          source={point.imageUrl ? { uri: point.imageUrl } : null}
          fallbackSource={NO_IMAGE_POINT}
          style={styles.image}
        />
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn}>
          <Share size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{point.level}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.category}>{point.category || 'Diving Spot'}</Text>
          <Text style={styles.name}>{point.name}</Text>
          <View style={styles.locationRow}>
            <MapPin size={16} color="#64748b" />
            <Text style={styles.locationText}>
              {point.region} {point.area ? `• ${point.area}` : ''} {point.place ? `(${point.place})` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Level</Text>
            <Text style={styles.statValue}>{point.level}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Depth</Text>
            <Text style={styles.statValue}>{point.maxDepth ? `${point.maxDepth}m` : '-'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={styles.statValue}>{point.current || '-'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Terrain</Text>
            <Text style={styles.statValue}>{point.terrain || '-'}</Text>
          </View>
        </View>

        {point.features && point.features.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FEATURES</Text>
            <View style={styles.tags}>
              {point.features.map((f: string, i: number) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DESCRIPTION</Text>
          <Text style={styles.description}>
            {point.description || '詳細情報がまだありません。'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: width,
    height: 300,
    backgroundColor: '#f1f5f9',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backBtnSimple: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#0ea5e9',
    fontWeight: 'bold',
  },
  shareBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  levelBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  levelText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  content: {
    padding: 24,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
  },
  header: {
    marginBottom: 24,
  },
  category: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0ea5e9',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#64748b',
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 20,
    marginBottom: 32,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  divider: {
    width: 1,
    height: '100%',
    backgroundColor: '#e2e8f0',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    lineHeight: 26,
    color: '#334155',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  tagText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
});
