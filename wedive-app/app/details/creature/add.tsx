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
import { ChevronLeft, Info, Camera } from 'lucide-react-native';
import { useAuth } from '../../../src/context/AuthContext';
import { ProposalService } from '../../../src/services/ProposalService';

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
          images: [],
          imageUrl: '',
        } as any,
        'create'
      );

      Alert.alert('ありがとうございます！', '新規生物の登録を申請しました。', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert('エラー', '申請に失敗しました');
    } finally {
      setSubmitting(false);
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
          />
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
});
