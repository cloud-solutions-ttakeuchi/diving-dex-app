import React, { useState, useRef } from 'react';
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
  Image,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Save, MapPin, Info, Camera, X, Map as MapIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import { useAuth } from '../../../src/context/AuthContext';
import { db, storage } from '../../../src/firebase';
import { ProposalService } from '../../../src/services/ProposalService';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const LEVELS = [
  { label: '初級', value: 'Beginner' },
  { label: '中級', value: 'Intermediate' },
  { label: '上級', value: 'Advanced' },
];
const ENTRY_TYPES = [
  { label: 'ボート', value: 'boat' },
  { label: 'ビーチ', value: 'beach' },
  { label: 'エントリー容易', value: 'entry_easy' },
];
const CURRENTS = [
  { label: 'なし', value: 'none' },
  { label: '弱', value: 'weak' },
  { label: '強', value: 'strong' },
  { label: 'ドリフト必須', value: 'drift' },
];
const TOPOGRAPHY_TYPES = [
  { label: '砂地', value: 'sand' },
  { label: '岩場', value: 'rock' },
  { label: 'ドロップオフ', value: 'dropoff' },
  { label: '洞窟', value: 'cave' },
  { label: '泥地', value: 'muck' },
  { label: 'サンゴ', value: 'coral' },
];

export default function AddSpotProposalScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    region: '',
    zone: '',
    area: '',
    description: '',
    maxDepth: '15',
    level: 'Beginner',
    entryType: 'boat',
    current: 'none',
    topography: [] as string[],
    features: '',
    latitude: '',
    longitude: '',
    photos: [] as string[],
  });

  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 35.6812,
    longitude: 139.7671,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });
  const [markerCoords, setMarkerCoords] = useState<{ latitude: number, longitude: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef<MapView>(null);

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.name || !formData.region) {
      Alert.alert('エラー', '名前と地域は必須です');
      return;
    }

    setSubmitting(true);
    try {
      const featureList = formData.features.split(',').map(f => f.trim()).filter(Boolean);
      const coords = (formData.latitude && formData.longitude) ? { lat: Number(formData.latitude), lng: Number(formData.longitude) } : undefined;

      await ProposalService.addPointProposal(
        user.id,
        {
          name: formData.name,
          region: formData.region,
          zone: formData.zone,
          area: formData.area,
          description: formData.description,
          maxDepth: Number(formData.maxDepth) || 0,
          level: formData.level,
          entryType: formData.entryType,
          current: formData.current,
          topography: formData.topography,
          features: featureList,
          coordinates: coords,
          images: formData.photos,
          status: 'pending',
          submitterId: user.id,
          createdAt: new Date().toISOString(),
          bookmarkCount: 0,
          imageUrl: formData.photos[0] || '',
        } as any,
        'create'
      );

      Alert.alert('ありがとうございます！', '新規スポットの登録を申請しました。', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('許可が必要', '写真を選択するにはライブラリへのアクセス許可が必要です');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets[0].uri) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        reject(new TypeError("Network request failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
  };

  const uploadImage = async (uri: string) => {
    setIsLoading(true);
    try {
      const blob = await uriToBlob(uri);
      const filename = `spots/new_${user?.id || 'unknown'}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      const metadata = { contentType: 'image/jpeg' };
      await uploadBytes(storageRef, blob, metadata);
      const downloadURL = await getDownloadURL(storageRef);

      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, downloadURL]
      }));
    } catch (e: any) {
      console.error("Upload failed", e);
      Alert.alert('エラー', `画像のアップロードに失敗しました\n(Code: ${e.code || 'unknown'})`);
    } finally {
      setIsLoading(false);
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handleMapConfirm = () => {
    if (markerCoords) {
      setFormData(prev => ({
        ...prev,
        latitude: String(markerCoords.latitude),
        longitude: String(markerCoords.longitude),
      }));
    }
    setIsMapModalOpen(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        Alert.alert('設定エラー', 'Google Maps API Keyが設定されていません。');
        return;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        const newRegion = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };
        setMapRegion(newRegion);
        setMarkerCoords({ latitude: lat, longitude: lng });
        mapRef.current?.animateToRegion(newRegion, 1000);
      } else {
        const maskedKey = apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}` : '未設定';
        const msg = data.status === 'REQUEST_DENIED'
          ? `APIキーが拒絶されました。\nKey: ${maskedKey}\nGoogle Cloudでこのキーに対して「Geocoding API」が許可されているか確認してください。`
          : `場所が見つかりませんでした (Status: ${data.status})`;
        Alert.alert('検索失敗', msg);
      }
    } catch (e) {
      console.error('Search failed:', e);
      Alert.alert('エラー', '検索に失敗しました');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>新規スポットの登録提案</Text>
        <TouchableOpacity onPress={handleSubmit} style={styles.submitBtn} disabled={submitting}>
          {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>提案する</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoBanner}>
          <Info size={16} color="#0ea5e9" />
          <Text style={styles.infoText}>まだ登録されていないダイビングスポットを教えてください。管理者が確認後、地図に追加されます。</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>スポット名</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(val) => setFormData(p => ({ ...p, name: val }))}
            placeholder="例: 伊東 大根"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>地域 (Region / Zone / Area)</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              value={formData.region}
              onChangeText={(val) => setFormData(p => ({ ...p, region: val }))}
              placeholder="地域"
            />
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              value={formData.zone}
              onChangeText={(val) => setFormData(p => ({ ...p, zone: val }))}
              placeholder="エリア"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={formData.area}
              onChangeText={(val) => setFormData(p => ({ ...p, area: val }))}
              placeholder="場所"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>正確な位置 (座標)</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <TextInput
                style={[styles.input, { textAlign: 'center' }]}
                value={formData.latitude}
                onChangeText={(val) => setFormData(p => ({ ...p, latitude: val }))}
                keyboardType="numeric"
                placeholder="緯度"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.input, { textAlign: 'center' }]}
                value={formData.longitude}
                onChangeText={(val) => setFormData(p => ({ ...p, longitude: val }))}
                keyboardType="numeric"
                placeholder="経度"
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => setIsMapModalOpen(true)}
          >
            <MapIcon size={16} color="#0ea5e9" />
            <Text style={styles.mapButtonText}>地図から位置を指定する</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>スポット写真</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
            {formData.photos.map((uri, idx) => (
              <View key={idx} style={styles.photoContainer}>
                <View style={styles.photoWrapper}>
                  <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: 12 }} />
                  <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(idx)}>
                    <X size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {isLoading ? (
              <View style={[styles.addPhotoBtn, { borderStyle: 'solid' }]}>
                <ActivityIndicator color="#0ea5e9" />
              </View>
            ) : (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickImage}>
                <Camera size={24} color="#94a3b8" />
                <Text style={styles.addPhotoText}>追加</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 16 }]}>
            <Text style={styles.label}>最大水深 (m)</Text>
            <TextInput
              style={styles.input}
              value={formData.maxDepth}
              onChangeText={(val) => setFormData(p => ({ ...p, maxDepth: val }))}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>レベル</Text>
            <View style={styles.optionContainer}>
              {LEVELS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionBtn, formData.level === opt.value && styles.optionBtnActive]}
                  onPress={() => setFormData(p => ({ ...p, level: opt.value }))}
                >
                  <Text style={[styles.optionText, formData.level === opt.value && styles.optionTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>エントリー方式</Text>
          <View style={styles.optionContainer}>
            {ENTRY_TYPES.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionBtn, formData.entryType === opt.value && styles.optionBtnActive]}
                onPress={() => setFormData(p => ({ ...p, entryType: opt.value }))}
              >
                <Text style={[styles.optionText, formData.entryType === opt.value && styles.optionTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>流れ</Text>
          <View style={styles.optionContainer}>
            {CURRENTS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionBtn, formData.current === opt.value && styles.optionBtnActive]}
                onPress={() => setFormData(p => ({ ...p, current: opt.value }))}
              >
                <Text style={[styles.optionText, formData.current === opt.value && styles.optionTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>地形 (複数選択可)</Text>
          <View style={styles.optionContainer}>
            {TOPOGRAPHY_TYPES.map(opt => {
              const isActive = formData.topography.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionBtn, isActive && styles.optionBtnActive]}
                  onPress={() => {
                    const next = isActive ? formData.topography.filter(v => v !== opt.value) : [...formData.topography, opt.value];
                    setFormData(p => ({ ...p, topography: next }));
                  }}
                >
                  <Text style={[styles.optionText, isActive && styles.optionTextActive]}>{opt.label}</Text>
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
            placeholder="ポイントの魅力や特徴を教えてください..."
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>特徴タグ (カンマ区切り)</Text>
          <TextInput
            style={styles.input}
            value={formData.features}
            onChangeText={(val) => setFormData(p => ({ ...p, features: val }))}
            placeholder="例: カメが見れる, 洞窟が綺麗"
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Map Picker Modal */}
      <Modal visible={isMapModalOpen} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsMapModalOpen(false)}>
              <Text style={styles.cancelText}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>地点を選択</Text>
            <TouchableOpacity onPress={handleMapConfirm}>
              <Text style={styles.doneText}>完了</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="場所を検索（例: 大瀬崎）"
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <Text style={styles.searchBtnText}>検索</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, position: 'relative' }}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={mapRegion}
              onRegionChangeComplete={setMapRegion}
              onMapReady={() => setIsMapReady(true)}
              onPress={(e) => setMarkerCoords(e.nativeEvent.coordinate)}
            >
              {isMapReady && markerCoords && <Marker coordinate={markerCoords} />}
            </MapView>
            <View style={styles.mapHelp}>
              <Text style={styles.mapHelpText}>地図をタップしてピンを立ててください</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingTop: Platform.OS === 'ios' ? 60 : 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  submitBtn: { backgroundColor: '#0ea5e9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  content: { flex: 1, padding: 16 },
  infoBanner: { flexDirection: 'row', gap: 12, backgroundColor: '#f0f9ff', padding: 12, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#e0f2fe' },
  infoText: { flex: 1, fontSize: 13, color: '#0369a1', lineHeight: 18 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 16, color: '#1e293b' },
  textArea: { height: 120, textAlignVertical: 'top', paddingTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  optionContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  optionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  optionBtnActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  optionText: { fontSize: 13, color: '#64748b' },
  optionTextActive: { color: '#fff' },
  photoList: { flexDirection: 'row', marginBottom: 8 },
  photoContainer: { marginRight: 12 },
  photoWrapper: { position: 'relative' },
  removePhotoBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, padding: 4, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  addPhotoBtn: { width: 100, height: 100, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  addPhotoText: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  mapButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#f0f9ff', borderWidth: 1, borderStyle: 'dashed', borderColor: '#bae6fd', padding: 12, borderRadius: 12, marginTop: 12 },
  mapButtonText: { fontSize: 14, color: '#0ea5e9', fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingTop: Platform.OS === 'ios' ? 60 : 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  cancelText: { fontSize: 16, color: '#64748b' },
  doneText: { fontSize: 16, color: '#0ea5e9', fontWeight: 'bold' },
  map: { flex: 1 },
  mapHelp: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  mapHelpText: { fontSize: 12, color: '#64748b' },
  searchBar: { flexDirection: 'row', padding: 8, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  searchInput: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 14, color: '#1e293b' },
  searchBtn: { backgroundColor: '#0ea5e9', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  searchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
