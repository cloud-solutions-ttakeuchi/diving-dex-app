import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { X, Star } from 'lucide-react-native';
import { Rarity } from '../types';

interface RaritySelectorModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (rarity: Rarity) => void;
  title: string;
}

const RARITIES: { value: Rarity; label: string; color: string; description: string }[] = [
  { value: 'Common', label: 'Common', color: '#64748b', description: 'どこでも見かける。いつもいる。' },
  { value: 'Rare', label: 'Rare', color: '#0ea5e9', description: '探せば見つかる。季節限定など。' },
  { value: 'Epic', label: 'Epic', color: '#f59e0b', description: 'なかなか会えない。珍しい。' },
  { value: 'Legendary', label: 'Legendary', color: '#d946ef', description: 'めったに会えない。激レア。' },
];

export const RaritySelectorModal: React.FC<RaritySelectorModalProps> = ({
  isVisible,
  onClose,
  onSelect,
  title
}) => {
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>この場所での出現頻度を選択してください</Text>

          <View style={styles.list}>
            {RARITIES.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={styles.rarityItem}
                onPress={() => onSelect(r.value)}
              >
                <View style={[styles.iconBox, { backgroundColor: r.color + '10' }]}>
                  <Star size={20} color={r.color} fill={r.color} />
                </View>
                <View style={styles.rarityInfo}>
                  <Text style={[styles.rarityLabel, { color: r.color }]}>{r.label}</Text>
                  <Text style={styles.rarityDesc}>{r.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1e293b',
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  list: {
    gap: 12,
  },
  rarityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  rarityInfo: {
    flex: 1,
  },
  rarityLabel: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  rarityDesc: {
    fontSize: 12,
    color: '#64748b',
  },
});
