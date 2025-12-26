import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Save, Info, Camera, Sparkles, X } from 'lucide-react-native';
import { useAuth } from '../../../src/context/AuthContext';
import { db, functions } from '../../../src/firebase';
import { ProposalService } from '../../../src/services/ProposalService';
import { Creature } from '../../../src/types';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import * as ImagePicker from 'expo-image-picker';
import { ImageWithFallback } from '../../../src/components/ImageWithFallback';

const NO_IMAGE_CREATURE = require('../../../assets/images/no-image-creature.png');

const DELETE_REASONS = ['重複している', '実在しない生物', '写真・名称が不正確', '図鑑に不適切'];

const CATEGORIES = ['魚類', '軟骨魚類', '爬虫類', '甲殻類', '軟体動物', '刺胞動物', '哺乳類', 'その他'];
const RARITIES = [
  { label: 'Common', value: 'Common' },
  { label: 'Rare', value: 'Rare' },
  { label: 'Epic', value: 'Epic' },
  { label: 'Legendary', value: 'Legendary' },
];
const SEASONS = [
  { label: '春', value: 'spring' },
  { label: '夏', value: 'summer' },
  { label: '秋', value: 'autumn' },
  { label: '冬', value: 'winter' },
];
const SPECIAL_ATTRS = ['毒', '擬態', '夜行性', '共生', '固有種', '群れ', '幼魚', '大物', 'レア', '危険'];

export default function EditCreatureProposalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creature, setCreature] = useState<Creature | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    scientificName: '',
    family: '',
    description: '',
    category: '魚類',
    rarity: 'Common',
    size: '',
    depthMin: '',
    depthMax: '',
    waterTempMin: '',
    waterTempMax: '',
    season: [] as string[],
    specialAttributes: [] as string[],
    tags: '',
    imageUrl: '',
    imageCredit: '',
    imageLicense: '',
  });

  const [deleteReason, setDeleteReason] = useState('');

  useEffect(() => {
    if (id) fetchCreatureData();
  }, [id]);

  const fetchCreatureData = async () => {
    try {
      const docRef = doc(db, 'creatures', id as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as Creature;
        setCreature(data);
        setFormData({
          name: data.name || '',
          scientificName: data.scientificName || '',
          family: data.family || '',
          description: data.description || '',
          category: data.category || '魚類',
          rarity: data.rarity || 'Common',
          size: data.size || '',
          depthMin: String(data.depthRange?.min || ''),
          depthMax: String(data.depthRange?.max || ''),
          waterTempMin: String(data.waterTempRange?.min || ''),
          waterTempMax: String(data.waterTempRange?.max || ''),
          season: data.season || [],
          specialAttributes: data.specialAttributes || [],
          tags: (data.tags || []).join(', '),
          imageUrl: data.imageUrl || '',
          imageCredit: data.imageCredit || '',
          imageLicense: data.imageLicense || '',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.name) {
      Alert.alert('エラー', '名前は必須です');
      return;
    }

    setSubmitting(true);
    try {
      const diffData: any = {};
      if (formData.name !== creature?.name) diffData.name = formData.name;
      if (formData.scientificName !== creature?.scientificName) diffData.scientificName = formData.scientificName;
      if (formData.family !== creature?.family) diffData.family = formData.family;
      if (formData.description !== creature?.description) diffData.description = formData.description;
      if (formData.category !== creature?.category) diffData.category = formData.category;
      if (formData.rarity !== creature?.rarity) diffData.rarity = formData.rarity;
      if (formData.size !== creature?.size) diffData.size = formData.size;
      if (formData.imageUrl !== creature?.imageUrl) {
        diffData.imageUrl = formData.imageUrl;
        diffData.images = [formData.imageUrl];
      }
      if (formData.imageCredit !== creature?.imageCredit) diffData.imageCredit = formData.imageCredit;
      if (formData.imageLicense !== creature?.imageLicense) diffData.imageLicense = formData.imageLicense;

      const depthRange = { min: Number(formData.depthMin), max: Number(formData.depthMax) };
      if (JSON.stringify(depthRange) !== JSON.stringify(creature?.depthRange)) diffData.depthRange = depthRange;

      const waterTempRange = { min: Number(formData.waterTempMin), max: Number(formData.waterTempMax) };
      if (JSON.stringify(waterTempRange) !== JSON.stringify(creature?.waterTempRange)) diffData.waterTempRange = waterTempRange;

      if (JSON.stringify(formData.season) !== JSON.stringify(creature?.season)) diffData.season = formData.season;
      if (JSON.stringify(formData.specialAttributes) !== JSON.stringify(creature?.specialAttributes)) diffData.specialAttributes = formData.specialAttributes;

      const tagList = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (JSON.stringify(tagList) !== JSON.stringify(creature?.tags)) diffData.tags = tagList;

      if (Object.keys(diffData).length === 0) {
        Alert.alert('情報', '変更箇所がありません');
        setSubmitting(false);
        return;
      }

      await ProposalService.addCreatureProposal(
        user.id,
        {
          ...diffData,
          name: creature?.name // Preview info
        },
        'update',
        id as string
      );

      Alert.alert('ありがとうございます！', '修正案を申請しました。管理者の承認後に反映されます。', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '申請に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoFillImage = async () => {
    if (!formData.name && !formData.scientificName) {
      Alert.alert('入力エラー', '生物名または学名を入力してください。');
      return;
    }

    setSubmitting(true);
    try {
      const searchFn = httpsCallable(functions, 'searchCreatureImage');
      const query = formData.scientificName || formData.name;
      const result = await searchFn({ query, lang: 'ja' });
      const data = result.data as any;

      if (data.imageUrl) {
        setFormData(prev => ({
          ...prev,
          imageUrl: data.imageUrl,
          imageCredit: data.imageCredit,
          imageLicense: data.imageLicense
        }));
      } else {
        Alert.alert('検索結果', 'Wikipediaで画像が見つかりませんでした。');
      }
    } catch (error: any) {
      console.error('Search failed:', error);
      Alert.alert('エラー', '検索に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setFormData(p => ({
        ...p,
        imageUrl: `data:image/jpeg;base64,${result.assets[0].base64}`,
        imageCredit: 'User Upload',
        imageLicense: 'Self'
      }));
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>生物情報の修正提案</Text>
        <TouchableOpacity onPress={handleSubmit} style={styles.submitBtn} disabled={submitting}>
          {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>提案する</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoBanner}>
          <Info size={16} color="#0ea5e9" />
          <Text style={styles.infoText}>生物図鑑の正確性向上のため、正しい情報への修正にご協力をお願いします。</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>生物名</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(val) => setFormData(p => ({ ...p, name: val }))}
          />
        </View>

        <TouchableOpacity
          style={styles.wikiBtn}
          onPress={handleAutoFillImage}
          disabled={submitting}
        >
          <Sparkles size={18} color="#fff" />
          <Text style={styles.wikiBtnText}>Wikipediaから画像を探す</Text>
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>写真</Text>
          <View style={styles.imageSection}>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {formData.imageUrl ? (
                <View style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <ImageWithFallback
                    source={{ uri: formData.imageUrl }}
                    fallbackSource={NO_IMAGE_CREATURE}
                    style={styles.previewImage}
                  />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => setFormData(p => ({ ...p, imageUrl: '', imageCredit: '', imageLicense: '' }))}
                  >
                    <X size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Camera size={32} color="#94a3b8" />
                  <Text style={styles.imagePlaceholderText}>タップしてアップロード</Text>
                </View>
              )}
            </TouchableOpacity>

            {formData.imageUrl ? (
              <View style={styles.imageMeta}>
                <View style={styles.metaInputGroup}>
                  <Text style={styles.metaLabel}>画像クレジット</Text>
                  <TextInput
                    style={styles.metaInput}
                    value={formData.imageCredit}
                    onChangeText={(val) => setFormData(p => ({ ...p, imageCredit: val }))}
                    placeholder="例: Wikipedia"
                  />
                </View>
                <View style={styles.metaInputGroup}>
                  <Text style={styles.metaLabel}>ライセンス</Text>
                  <TextInput
                    style={styles.metaInput}
                    value={formData.imageLicense}
                    onChangeText={(val) => setFormData(p => ({ ...p, imageLicense: val }))}
                    placeholder="例: CC BY-SA"
                  />
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>基本情報</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              value={formData.scientificName}
              onChangeText={(val) => setFormData(p => ({ ...p, scientificName: val }))}
              placeholder="学名"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={formData.family}
              onChangeText={(val) => setFormData(p => ({ ...p, family: val }))}
              placeholder="科"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>カテゴリー</Text>
          <View style={styles.optionContainer}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.optionBtn, formData.category === cat && styles.optionBtnActive]}
                onPress={() => setFormData(p => ({ ...p, category: cat }))}
              >
                <Text style={[styles.optionText, formData.category === cat && styles.optionTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>レアリティ (管理者用)</Text>
          <View style={styles.optionContainer}>
            {RARITIES.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.optionBtn, formData.rarity === r.value && styles.optionBtnActive]}
                onPress={() => setFormData(p => ({ ...p, rarity: r.value }))}
              >
                <Text style={[styles.optionText, formData.rarity === r.value && styles.optionTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 16 }]}>
            <Text style={styles.label}>大きさ</Text>
            <TextInput
              style={styles.input}
              value={formData.size}
              onChangeText={(val) => setFormData(p => ({ ...p, size: val }))}
              placeholder="例: 10cm"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>水深域 (m)</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, textAlign: 'center' }]}
                value={formData.depthMin}
                onChangeText={(val) => setFormData(p => ({ ...p, depthMin: val }))}
                keyboardType="numeric"
                placeholder="0"
              />
              <Text style={{ marginHorizontal: 4 }}>~</Text>
              <TextInput
                style={[styles.input, { flex: 1, textAlign: 'center' }]}
                value={formData.depthMax}
                onChangeText={(val) => setFormData(p => ({ ...p, depthMax: val }))}
                keyboardType="numeric"
                placeholder="40"
              />
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>見られる季節</Text>
          <View style={styles.optionContainer}>
            {SEASONS.map(s => {
              const isActive = formData.season.includes(s.value);
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.optionBtn, isActive && styles.optionBtnActive]}
                  onPress={() => {
                    const next = isActive ? formData.season.filter(v => v !== s.value) : [...formData.season, s.value];
                    setFormData(p => ({ ...p, season: next }));
                  }}
                >
                  <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>特殊属性</Text>
          <View style={styles.optionContainer}>
            {SPECIAL_ATTRS.map(attr => {
              const isActive = formData.specialAttributes.includes(attr);
              return (
                <TouchableOpacity
                  key={attr}
                  style={[styles.optionBtn, isActive && styles.optionBtnActive]}
                  onPress={() => {
                    const next = isActive ? formData.specialAttributes.filter(v => v !== attr) : [...formData.specialAttributes, attr];
                    setFormData(p => ({ ...p, specialAttributes: next }));
                  }}
                >
                  <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{attr}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>説明</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(val) => setFormData(p => ({ ...p, description: val }))}
            multiline
            numberOfLines={5}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>検索タグ (カンマ区切り)</Text>
          <TextInput
            style={styles.input}
            value={formData.tags}
            onChangeText={(val) => setFormData(p => ({ ...p, tags: val }))}
            placeholder="例: オレンジ, しましま, 可愛い"
          />
        </View>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>管理・削除</Text>
          <Text style={styles.dangerDesc}>この生物が図鑑に不適切、または重複している場合は理由を添えて削除を申請できます。</Text>

          <View style={styles.quickReasons}>
            {DELETE_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={styles.reasonChip}
                onPress={() => setDeleteReason(prev => prev ? `${prev}, ${r}` : r)}
              >
                <Text style={styles.reasonChipText}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={deleteReason}
            onChangeText={setDeleteReason}
            placeholder="削除を希望する理由を入力してください（例：〇〇と重複、実在しない等）"
            multiline
          />

          <TouchableOpacity
            style={[styles.deleteRequestBtn, !deleteReason && styles.deleteRequestBtnDisabled]}
            disabled={!deleteReason}
            onPress={() => {
              Alert.alert('削除申請', 'この生物の削除を申請しますか？', [
                { text: 'キャンセル', style: 'cancel' },
                {
                  text: '申請する', style: 'destructive', onPress: async () => {
                    if (!user || !id) return;
                    try {
                      await ProposalService.addCreatureProposal(user.id, {
                        reason: deleteReason,
                        name: creature?.name
                      }, 'delete', id as string);
                      Alert.alert('完了', '削除の申請を送信しました');
                      router.back();
                    } catch (e) {
                      Alert.alert('エラー', '失敗しました');
                    }
                  }
                }
              ]);
            }}
          >
            <Text style={[styles.deleteRequestText, !deleteReason && styles.deleteRequestTextDisabled]}>削除を申請する</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  backBtn: { padding: 8 },
  submitBtn: { backgroundColor: '#0ea5e9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  submitBtnText: { color: '#fff', fontWeight: 'bold' },
  content: { flex: 1, padding: 20 },
  infoBanner: { flexDirection: 'row', backgroundColor: '#f0f9ff', padding: 12, borderRadius: 12, marginBottom: 24, gap: 10 },
  infoText: { flex: 1, fontSize: 12, color: '#0369a1', lineHeight: 18 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 16, color: '#1e293b' },
  textArea: { height: 120, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center' },
  optionContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  optionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  optionBtnActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  optionText: { fontSize: 13, color: '#64748b' },
  optionTextActive: { color: '#fff', fontWeight: 'bold' },
  dangerZone: { marginTop: 40, padding: 20, backgroundColor: '#fef2f2', borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  dangerTitle: { fontSize: 16, fontWeight: 'bold', color: '#991b1b', marginBottom: 8 },
  dangerDesc: { fontSize: 12, color: '#b91c1c', marginBottom: 16, lineHeight: 18 },
  deleteRequestBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ef4444', padding: 12, borderRadius: 12, alignItems: 'center' },
  deleteRequestBtnDisabled: { borderColor: '#fca5a5' },
  deleteRequestText: { color: '#ef4444', fontWeight: 'bold' },
  deleteRequestTextDisabled: { color: '#fca5a5' },
  reasonInput: { backgroundColor: '#fff', height: 80, textAlignVertical: 'top', marginBottom: 12, fontSize: 14 },
  quickReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  reasonChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  reasonChipText: { fontSize: 11, color: '#64748b' },
  wikiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 24,
    gap: 8,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  wikiBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  imageSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  imagePicker: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
  },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { marginTop: 8, fontSize: 12, color: '#94a3b8', fontWeight: 'bold' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageMeta: { marginTop: 16, gap: 12 },
  metaInputGroup: { gap: 4 },
  metaLabel: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8' },
  metaInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: '#1e293b' },
});
