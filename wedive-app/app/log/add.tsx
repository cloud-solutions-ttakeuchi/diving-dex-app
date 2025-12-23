import React, { useState } from 'react';
import { StyleSheet, TextInput, ScrollView, TouchableOpacity, Switch, Dimensions, Modal, FlatList, Image, Alert, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { ChevronLeft, Calendar, MapPin, Fish, Clock, Droplets, Thermometer, Save, X } from 'lucide-react-native';
import { addDoc, collection, serverTimestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';

const { width } = Dimensions.get('window');

export default function AddLogScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [spotName, setSpotName] = useState(''); // 手入力用
  const [selectedSpotId, setSelectedSpotId] = useState('');
  const [selectedCreatureId, setSelectedCreatureId] = useState('');
  const [maxDepth, setMaxDepth] = useState('');
  const [waterTemp, setWaterTemp] = useState('');
  const [comment, setComment] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // Modal states for selection
  const [spotModalVisible, setSpotModalVisible] = useState(false);
  const [creatureModalVisible, setCreatureModalVisible] = useState(false);

  const selectedSpot = null as any; // Temporary fix
  const selectedCreature = null as any; // Temporary fix

  const handleSave = async () => {
    if (!title || !date) {
      Alert.alert('入力エラー', 'タイトルと日付は必須です');
      return;
    }

    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    setIsLoading(true);
    try {
      const logData = {
        userId: user.id,
        userName: user.name || 'Anonymous',
        userImage: user.profileImage || null,
        title,
        date,
        spotName: spotName || (selectedSpot ? selectedSpot.name : ''),
        spotId: selectedSpotId || null,
        creatureId: selectedCreatureId || null,
        maxDepth: parseFloat(maxDepth) || 0,
        waterTemp: parseFloat(waterTemp) || 0,
        comment,
        isPrivate,
        likes: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 1. Logsコレクションに追加
      const docRef = await addDoc(collection(db, 'logs'), logData);

      // 2. Userのlogs配列に追加
      await updateDoc(doc(db, 'users', user.id), {
        logs: arrayUnion(docRef.id)
      });

      Alert.alert('完了', 'ログを保存しました', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      console.error("Log Save Error:", e);
      Alert.alert('保存失敗', 'ログの保存中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>新規ログ登録</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={isLoading}>
          {isLoading ? <ActivityIndicator size="small" color="#0ea5e9" /> : <Save size={20} color="#0ea5e9" />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Title & Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BASIC INFO</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="ダイビングタイトル"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor="#94a3b8"
          />
          <View style={styles.inputRow}>
            <Calendar size={18} color="#64748b" />
            <TextInput
              style={styles.rowInput}
              value={date}
              onChangeText={setDate}
              placeholder="2024-12-22"
            />
          </View>
        </View>

        {/* Location & Creature */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SPOT & CREATURE</Text>

          <TouchableOpacity
            style={[styles.selector, !selectedSpotId && styles.selectorEmpty]}
            onPress={() => setSpotModalVisible(true)}
          >
            <MapPin size={18} color={selectedSpotId ? "#0ea5e9" : "#94a3b8"} />
            <Text style={[styles.selectorText, !selectedSpotId && styles.selectorTextEmpty]}>
              {selectedSpot ? selectedSpot.name : "ダイビングポイントを選択"}
            </Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.titleInput, { fontSize: 16, borderBottomWidth: 1, borderColor: '#f1f5f9', marginBottom: 16 }]}
            placeholder="またはスポット名を手入力"
            value={spotName}
            onChangeText={setSpotName}
            placeholderTextColor="#94a3b8"
          />

          <TouchableOpacity
            style={[styles.selector, !selectedCreatureId && styles.selectorEmpty]}
            onPress={() => setCreatureModalVisible(true)}
          >
            <Fish size={18} color={selectedCreatureId ? "#0ea5e9" : "#94a3b8"} />
            <Text style={[styles.selectorText, !selectedCreatureId && styles.selectorTextEmpty]}>
              {selectedCreature ? selectedCreature.name : "主な観察生物を選択"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dive Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DIVE DATA</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <View style={styles.labelRow}>
                <Droplets size={14} color="#64748b" />
                <Text style={styles.innerLabel}>最大水深</Text>
              </View>
              <View style={styles.unitRow}>
                <TextInput
                  style={styles.gridInput}
                  value={maxDepth}
                  onChangeText={setMaxDepth}
                  keyboardType="numeric"
                  placeholder="0.0"
                />
                <Text style={styles.unitText}>m</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <View style={styles.labelRow}>
                <Thermometer size={14} color="#64748b" />
                <Text style={styles.innerLabel}>最高水温</Text>
              </View>
              <View style={styles.unitRow}>
                <TextInput
                  style={styles.gridInput}
                  value={waterTemp}
                  onChangeText={setWaterTemp}
                  keyboardType="numeric"
                  placeholder="0.0"
                />
                <Text style={styles.unitText}>℃</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MEMO</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="ダイビングの感想、メンバーなど..."
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Private Toggle */}
        <View style={[styles.section, styles.settingsRow]}>
          <View>
            <Text style={styles.settingsLabel}>非公開にする</Text>
            <Text style={styles.settingsDesc}>自分だけが閲覧できるログになります</Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: '#e2e8f0', true: '#0ea5e9' }}
          />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
          <Text style={styles.submitBtnText}>ログを保存する</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Spot Selector Modal */}
      <Modal visible={spotModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ポイントを選択</Text>
              <TouchableOpacity onPress={() => setSpotModalVisible(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[]}
              keyExtractor={item => item.id}
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedSpotId(item.id);
                    setSpotModalVisible(false);
                  }}
                >
                  <MapPin size={16} color="#94a3b8" />
                  <View style={{ backgroundColor: 'transparent' }}>
                    <Text style={styles.modalItemName}>{item.name}</Text>
                    <Text style={styles.modalItemSub}>{item.region} • {item.area}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Creature Selector Modal */}
      <Modal visible={creatureModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>生物を選択</Text>
              <TouchableOpacity onPress={() => setCreatureModalVisible(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[]}
              keyExtractor={item => item.id}
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedCreatureId(item.id);
                    setCreatureModalVisible(false);
                  }}
                >
                  <View style={styles.modalItemIcon}>
                    <Image source={{ uri: item.imageUrl }} style={styles.modalItemImage} />
                  </View>
                  <View style={{ backgroundColor: 'transparent' }}>
                    <Text style={styles.modalItemName}>{item.name}</Text>
                    <Text style={styles.modalItemSub}>{item.category}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  saveBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 12,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  rowInput: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  selectorEmpty: {
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
  },
  selectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  selectorTextEmpty: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'transparent',
  },
  gridItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  innerLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    backgroundColor: 'transparent',
  },
  gridInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    padding: 0,
    minWidth: 40,
  },
  unitText: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    fontSize: 15,
    color: '#334155',
    textAlignVertical: 'top',
    minHeight: 120,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  settingsLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  settingsDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  modalItemImage: {
    width: '100%',
    height: '100%',
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalItemSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
});
