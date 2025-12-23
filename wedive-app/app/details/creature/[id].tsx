import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Star, Heart, Bookmark, Share2, Info } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../src/firebase';
import { Creature } from '../../../src/types';

import { ImageWithFallback } from '../../../src/components/ImageWithFallback';

const { width } = Dimensions.get('window');

const NO_IMAGE_CREATURE = require('../../../assets/images/no-image-creature.png');

export default function CreatureDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [creature, setCreature] = useState<Creature | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCreature = async () => {
      if (!id || typeof id !== 'string') return;
      try {
        const docRef = doc(db, 'creatures', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setCreature({ id: docSnap.id, ...docSnap.data() } as Creature);
        } else {
          setCreature(null);
        }
      } catch (error) {
        console.error("Error fetching creature:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCreature();
  }, [id]);

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
        <Text>生物が見つかりませんでした。</Text>
        <TouchableOpacity style={styles.backBtnSimple} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rarity = creature.rarity || 'Common';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <ImageWithFallback
          source={creature.imageUrl ? { uri: creature.imageUrl } : null}
          fallbackSource={NO_IMAGE_CREATURE}
          style={styles.image}
        />
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.actionBtns}>
          <TouchableOpacity style={styles.actionBtn}>
            <Heart size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Share2 size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{creature.category}</Text>
          </View>
          <Text style={styles.name}>{creature.name}</Text>
          <View style={styles.rarityRow}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                color={i < (rarity === 'Legendary' ? 4 : rarity === 'Epic' ? 3 : rarity === 'Rare' ? 2 : 1) ? "#fbbf24" : "#e2e8f0"}
                fill={i < (rarity === 'Legendary' ? 4 : rarity === 'Epic' ? 3 : rarity === 'Rare' ? 2 : 1) ? "#fbbf24" : "transparent"}
              />
            ))}
            <Text style={styles.rarityText}>{rarity}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <Text style={styles.description}>{creature.description}</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Info size={16} color="#64748b" />
            <Text style={styles.infoLabel}>Scientific Name:</Text>
            <Text style={styles.infoValue}>{creature.scientificName || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Bookmark size={16} color="#64748b" />
            <Text style={styles.infoLabel}>Family:</Text>
            <Text style={styles.infoValue}>{creature.family || '-'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.trackBtn}>
          <Text style={styles.trackBtnText}>この生物のログを書く</Text>
        </TouchableOpacity>
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
    height: 350,
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
  actionBtns: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'transparent',
  },
  categoryBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  rarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
  },
  rarityText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 20,
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
    backgroundColor: 'transparent',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    width: 110,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    fontStyle: 'italic',
  },
  trackBtn: {
    backgroundColor: '#0ea5e9',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  trackBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
