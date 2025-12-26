import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Search, X, ChevronRight } from 'lucide-react-native';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Creature } from '../types';
import { ImageWithFallback } from './ImageWithFallback';

interface CreatureSelectorModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (creature: Creature) => void;
}

const NO_IMAGE_CREATURE = require('../../assets/images/no-image-creature.png');

export const CreatureSelectorModal: React.FC<CreatureSelectorModalProps> = ({
  isVisible,
  onClose,
  onSelect
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      handleSearch('');
    }
  }, [isVisible]);

  const handleSearch = async (text: string) => {
    setSearchTerm(text);
    setIsLoading(true);
    try {
      const q = text
        ? query(
          collection(db, 'creatures'),
          where('status', '==', 'approved'),
          where('name', '>=', text),
          where('name', '<=', text + '\uf8ff'),
          limit(20)
        )
        : query(
          collection(db, 'creatures'),
          where('status', '==', 'approved'),
          limit(20)
        );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creature));
      setCreatures(results);
    } catch (error) {
      console.error('Error searching creatures:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Creature }) => (
    <TouchableOpacity style={styles.item} onPress={() => onSelect(item)}>
      <ImageWithFallback
        source={item.imageUrl ? { uri: item.imageUrl } : null}
        fallbackSource={NO_IMAGE_CREATURE}
        style={styles.itemImage}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemCategory}>{item.category} / {item.family || 'Unknown'}</Text>
      </View>
      <ChevronRight size={20} color="#cbd5e1" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>生物を選択</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Search size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="生物名で検索..."
            value={searchTerm}
            onChangeText={handleSearch}
            autoFocus
          />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0ea5e9" />
          </View>
        ) : (
          <FlatList
            data={creatures}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>該当する生物が見つかりませんでした。</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  itemCategory: {
    fontSize: 12,
    color: '#64748b',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
  },
});
