import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { ChevronLeft, Info, Camera, Sparkles, X } from 'lucide-react-native';
import { useAuth } from '../../../src/context/AuthContext';
import { ProposalService } from '../../../src/services/ProposalService';
import { functions } from '../../../src/firebase';
import { httpsCallable } from 'firebase/functions';
import * as ImagePicker from 'expo-image-picker';
import { ImageWithFallback } from '../../../src/components/ImageWithFallback';

const NO_IMAGE_CREATURE = require('../../../assets/images/no-image-creature.png');

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

export default function AddCreatureProposalScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.name) {
      Alert.alert('エラー', '名前は必須です');
      return;
    }

    setSubmitting(true);
    try {
      const tagList = formData.tags.split(',').map(t => t.trim()).filter(Boolean);

      await ProposalService.addCreatureProposal(
        user.id,
        {
          name: formData.name,
          scientificName: formData.scientificName,
          family: formData.family,
          description: formData.description,
          category: formData.category,
          rarity: formData.rarity,
          size: formData.size,
          depthRange: { min: Number(formData.depthMin), max: Number(formData.depthMax) },
          waterTempRange: { min: Number(formData.waterTempMin), max: Number(formData.waterTempMax) },
          season: formData.season,
          specialAttributes: formData.specialAttributes,
          tags: tagList,
          status: 'pending',
          submitterId: user.id,
          createdAt: new Date().toISOString(),
          images: formData.imageUrl ? [formData.imageUrl] : [],
          imageUrl: formData.imageUrl || '',
          imageCredit: formData.imageCredit || '',
          imageLicense: formData.imageLicense || '',
        } as any,
        'create'
      );

      Alert.alert('ありがとうございます！', '新規生物の登録を申請しました。', [
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>新規生物の登録提案</Text>
        <TouchableOpacity onPress={handleSubmit} style={styles.submitBtn} disabled={submitting}>
          {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>提案する</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoBanner}>
          <Info size={16} color="#0ea5e9" />
          <Text style={styles.infoText}>図鑑に載っていない生物を見つけましたか？新しい生物の登録にご協力ください。</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>生物名 *</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(val) => setFormData(p => ({ ...p, name: val }))}
            placeholder="例: ミズタマウミウシ"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>学名 (Scientific Name)</Text>
          <TextInput
            style={styles.input}
            value={formData.scientificName}
            onChangeText={(val) => setFormData(p => ({ ...p, scientificName: val }))}
            placeholder="例: Amphiprion ocellaris"
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
            placeholder="生態や特徴を入力してください..."
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

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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
