import React, { useState, useEffect, useMemo } from 'react';
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
  Dimensions,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Calendar,
  Clock,
  MapPin,
  Thermometer,
  Save,
  X,
  Users,
  Settings,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Wind,
  Droplets,
  Waves,
  Maximize2,
  Minimize2,
  Trash2,
  ChevronLeft,
  Info,
  Heart,
  Grid,
  Plus,
  Lock
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { ImageWithFallback } from '../../../src/components/ImageWithFallback';
import { useAuth } from '../../../src/context/AuthContext';
import { db, storage } from '../../../src/firebase';
import { LogService } from '../../../src/services/LogService';
import { DiveLog, Point } from '../../../src/types';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const { width } = Dimensions.get('window');

export default function EditLogScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');
  const [masterPoints, setMasterPoints] = useState<Point[]>([]);
  const [masterCreatures, setMasterCreatures] = useState<any[]>([]);
  const [pointCreatures, setPointCreatures] = useState<any[]>([]);
  const [spotSearchTerm, setSpotSearchTerm] = useState('');
  const [creatureSearchTerm, setCreatureSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    diveNumber: '',
    pointId: '',
    pointName: '',
    region: '',
    shopName: '',
    buddy: '',
    guide: '',
    members: '',
    entryTime: '',
    exitTime: '',
    maxDepth: '',
    avgDepth: '',
    weather: 'sunny',
    airTemp: '',
    waterTempSurface: '',
    waterTempBottom: '',
    transparency: '',
    wave: 'none',
    current: 'none',
    surge: 'none',
    suitType: 'wet',
    suitThickness: '5',
    weight: '4',
    tankMaterial: 'steel',
    tankCapacity: '10',
    pressureStart: '200',
    pressureEnd: '50',
    comment: '',
    photos: [] as string[],
    isPrivate: false,
    creatureId: '',
    sightedCreatures: [] as string[],
    entryType: 'boat' as 'boat' | 'beach',
    importProfile: [] as any[],
    garminActivityId: '',
  });

  // UI Control: Sections
  const [openSections, setOpenSections] = useState({
    basic: true,
    location: false,
    data: false,
    conditions: false,
    gear: false,
    creatures: false,
    photos: false,
    comment: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (user && id) {
      fetchMasterData();
      fetchLogData();
    }
  }, [id, user]);

  const fetchMasterData = async () => {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 10000)
      );

      const pointsPromise = getDocs(query(collection(db, 'points'), where('status', '==', 'approved')));
      const creaturesPromise = getDocs(query(collection(db, 'creatures'), where('status', '==', 'approved')));
      const pointCreaturesPromise = getDocs(collection(db, 'point_creatures'));

      const [pointsSnap, creaturesSnap, pointCreaturesSnap] = await Promise.race([
        Promise.all([pointsPromise, creaturesPromise, pointCreaturesPromise]),
        timeoutPromise
      ]) as [any, any, any];

      setMasterPoints(pointsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Point)));
      setMasterCreatures(creaturesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      setPointCreatures(pointCreaturesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error("Master data fetch error:", e);
    }
  };

  const fetchLogData = async () => {
    if (!id || !user) return;
    setIsLoading(true);
    try {
      const logRef = doc(db, 'users', user.id, 'logs', id as string);

      // 10秒のタイムアウトを設定
      const fetchPromise = getDoc(logRef);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 10000)
      );

      const snap = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (snap && snap.exists()) {
        const data = snap.data() as DiveLog;
        setFormData({
          title: data.title || '',
          date: data.date || '',
          diveNumber: data.diveNumber?.toString() || '',
          pointId: data.location?.pointId || '',
          pointName: data.location?.pointName || '',
          region: data.location?.region || '',
          shopName: data.location?.shopName || '',
          buddy: data.team?.buddy || '',
          guide: data.team?.guide || '',
          members: (data.team?.members || []).join(', '),
          entryTime: data.time?.entry || '',
          exitTime: data.time?.exit || '',
          maxDepth: data.depth?.max?.toString() || '',
          avgDepth: data.depth?.average?.toString() || '',
          weather: data.condition?.weather || 'sunny',
          airTemp: data.condition?.airTemp?.toString() || '',
          waterTempSurface: data.condition?.waterTemp?.surface?.toString() || '',
          waterTempBottom: data.condition?.waterTemp?.bottom?.toString() || '',
          transparency: data.condition?.transparency?.toString() || '',
          wave: data.condition?.wave || 'none',
          current: data.condition?.current || 'none',
          surge: data.condition?.surge || 'none',
          suitType: data.gear?.suitType || 'wet',
          suitThickness: data.gear?.suitThickness?.toString() || '',
          weight: data.gear?.weight?.toString() || '',
          tankMaterial: data.gear?.tank?.material || 'steel',
          tankCapacity: data.gear?.tank?.capacity?.toString() || '',
          pressureStart: data.gear?.tank?.pressureStart?.toString() || '',
          pressureEnd: data.gear?.tank?.pressureEnd?.toString() || '',
          comment: data.comment || '',
          photos: data.photos || [],
          isPrivate: data.isPrivate || false,
          creatureId: data.creatureId || '',
          sightedCreatures: data.sightedCreatures || [],
          entryType: data.entryType || 'boat',
          importProfile: data.profile || [],
          garminActivityId: data.garminActivityId || '',
        });
      } else {
        Alert.alert('エラー', 'ログが見つかりませんでした');
        router.push('/(tabs)/mypage');
      }
    } catch (e: any) {
      console.error("fetchLogData Error:", e);
      if (e.message === 'TIMEOUT') {
        Alert.alert('接続エラー', 'データの取得に時間がかかりすぎています。通信環境を確認して再試行してください。');
      } else {
        Alert.alert('エラー', 'データの読み込みに失敗しました');
      }
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPoints = useMemo(() => {
    let results = masterPoints;
    if (selectedRegion) {
      results = results.filter(p => p.region === selectedRegion);
    }
    if (spotSearchTerm) {
      const s = spotSearchTerm.toLowerCase();
      results = results.filter(p =>
        (p.name && p.name.toLowerCase().includes(s)) ||
        (p.area && p.area.toLowerCase().includes(s)) ||
        (p.zone && p.zone.toLowerCase().includes(s))
      );
    }
    return results.slice(0, 50);
  }, [masterPoints, spotSearchTerm, selectedRegion]);

  const filteredCreatures = useMemo(() => {
    if (!creatureSearchTerm) return [];
    const s = creatureSearchTerm.toLowerCase();
    return masterCreatures.filter(c =>
      (c.name && c.name.toLowerCase().includes(s)) ||
      (c.category && c.category.toLowerCase().includes(s))
    ).slice(0, 50);
  }, [masterCreatures, creatureSearchTerm]);

  const pointSpecificCreatures = useMemo(() => {
    if (!formData.pointId || !pointCreatures.length) return [];
    const relatedIds = pointCreatures
      .filter(pc => pc.pointId === formData.pointId)
      .map(pc => pc.creatureId);
    return masterCreatures.filter(c => relatedIds.includes(c.id));
  }, [formData.pointId, pointCreatures, masterCreatures]);

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
      xhr.onload = function () { resolve(xhr.response); };
      xhr.onerror = function (e) { reject(new TypeError("Network request failed")); };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
  };

  const uploadImage = async (uri: string) => {
    setIsLoading(true);
    setSaveStatus('画像をアップロード中...');
    try {
      const blob = await uriToBlob(uri);
      const filename = `logs/${user?.id || 'unknown'}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      const metadata = { contentType: 'image/jpeg' };
      await uploadBytes(storageRef, blob, metadata);
      const downloadURL = await getDownloadURL(storageRef);

      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, downloadURL]
      }));
    } catch (e) {
      console.error("Upload failed", e);
      Alert.alert('エラー', '画像のアップロードに失敗しました');
    } finally {
      setIsLoading(false);
      setSaveStatus('');
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const toggleSightedCreature = (creatureId: string) => {
    setFormData(prev => {
      const current = prev.sightedCreatures || [];
      if (current.includes(creatureId)) {
        return { ...prev, sightedCreatures: current.filter(id => id !== creatureId) };
      } else {
        return { ...prev, sightedCreatures: [...current, creatureId] };
      }
    });
  };

  const handleSave = async () => {
    if (!formData.title || !formData.date) {
      Alert.alert('入力エラー', 'タイトルと日付は必須です');
      return;
    }

    if (!user || !id) return;

    setIsLoading(true);
    setSaveStatus('更新中...');

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('タイムアウトが発生しました')), 10000)
      );

      const updatePromise = (async () => {
        const selectedPoint = masterPoints.find(p => p.id === formData.pointId);

        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        const entry = timeRegex.test(formData.entryTime) ? formData.entryTime.split(':').map(Number) : [0, 0];
        const exit = timeRegex.test(formData.exitTime) ? formData.exitTime.split(':').map(Number) : [0, 0];

        let duration = 0;
        if (entry.length === 2 && exit.length === 2) {
          duration = (exit[0] * 60 + exit[1]) - (entry[0] * 60 + entry[1]);
          if (duration < 0) duration += 1440;
        }

        const logData: Partial<DiveLog> = {
          title: formData.title,
          date: formData.date,
          diveNumber: Number(formData.diveNumber) || 0,
          location: {
            pointId: formData.pointId,
            pointName: formData.pointName || selectedPoint?.name || '不明',
            region: formData.region || selectedPoint?.region || '',
            shopName: formData.shopName,
          },
          team: {
            buddy: formData.buddy,
            guide: formData.guide,
            members: (formData.members || '').split(',').map(m => m.trim()).filter(Boolean),
          },
          time: {
            entry: formData.entryTime,
            exit: formData.exitTime,
            duration: duration,
          },
          profile: formData.importProfile,
          depth: {
            max: Number(formData.maxDepth) || 0,
            average: Number(formData.avgDepth) || 0,
          },
          condition: {
            weather: formData.weather as any,
            airTemp: Number(formData.airTemp) || 0,
            waterTemp: {
              surface: Number(formData.waterTempSurface) || 0,
              bottom: Number(formData.waterTempBottom) || 0,
            },
            transparency: Number(formData.transparency) || 0,
            wave: formData.wave as any,
            current: formData.current as any,
            surge: formData.surge as any,
          },
          gear: {
            suitType: formData.suitType as any,
            suitThickness: Number(formData.suitThickness) || 0,
            weight: Number(formData.weight) || 0,
            tank: {
              material: formData.tankMaterial as any,
              capacity: Number(formData.tankCapacity) || 0,
              pressureStart: Number(formData.pressureStart) || 0,
              pressureEnd: Number(formData.pressureEnd) || 0,
            }
          },
          entryType: formData.entryType,
          ...(formData.creatureId ? { creatureId: formData.creatureId } : {}),
          sightedCreatures: formData.sightedCreatures,
          photos: formData.photos,
          comment: formData.comment,
          isPrivate: formData.isPrivate,
          garminActivityId: formData.garminActivityId,
          spotId: formData.pointId || '',
        };

        await LogService.updateLog(user.id, id as string, logData);
        return true;
      })();

      await Promise.race([updatePromise, timeoutPromise]);

      Alert.alert('完了', 'ログを更新しました', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      console.error("Update Error:", e);
      Alert.alert('更新失敗', `エラーが発生しました: ${e.message || '不明'}`);
    } finally {
      setIsLoading(false);
      setSaveStatus('');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      '削除の確認',
      'このログを削除してもよろしいですか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            if (!user || !id) return;
            setIsLoading(true);
            try {
              await LogService.deleteLog(user.id, id as string);
              Alert.alert('完了', 'ログを削除しました', [{ text: 'OK', onPress: () => router.push('/(tabs)/mypage') }]);
            } catch (e) {
              Alert.alert('エラー', '削除に失敗しました');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const SectionHeader = ({ title, icon: Icon, section, color }: any) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={() => toggleSection(section)}
      activeOpacity={0.7}
    >
      <View style={styles.sectionHeaderLeft}>
        <Icon size={20} color={color} />
        <Text style={styles.sectionTitleText}>{title}</Text>
      </View>
      {openSections[section as keyof typeof openSections] ? <ChevronUp size={20} color="#94a3b8" /> : <ChevronDown size={20} color="#94a3b8" />}
    </TouchableOpacity>
  );

  if (isLoading && !formData.date) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Dive Log</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={isLoading}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Basic Info */}
        <View style={styles.sectionCard}>
          <SectionHeader title="基本情報" icon={Calendar} section="basic" color="#3b82f6" />
          {openSections.basic && (
            <View style={styles.sectionBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>タイトル</Text>
                <TextInput
                  style={styles.input}
                  value={formData.title}
                  onChangeText={(val) => setFormData(p => ({ ...p, title: val }))}
                  placeholder="例: 大瀬崎でのんびりフォトダイブ"
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>日付</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.date}
                    onChangeText={(val) => setFormData(p => ({ ...p, date: val }))}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Dive No.</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.diveNumber}
                    onChangeText={(val) => setFormData(p => ({ ...p, diveNumber: val }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* 公開設定 */}
              <View style={styles.inputGroup}>
                <View style={styles.visibilityRow}>
                  <View style={styles.visibilityInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Lock size={18} color={formData.isPrivate ? "#64748b" : "#3b82f6"} style={{ marginRight: 8 }} />
                      <Text style={[styles.label, { marginBottom: 0 }]}>公開設定</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: formData.isPrivate ? '#f1f5f9' : '#eff6ff' }
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        { color: formData.isPrivate ? '#64748b' : '#3b82f6' }
                      ]}>
                        {formData.isPrivate ? '非公開' : '公開中'}
                      </Text>
                    </View>
                    <Switch
                      value={formData.isPrivate}
                      onValueChange={(val) => setFormData(p => ({ ...p, isPrivate: val }))}
                      trackColor={{ false: "#e2e8f0", true: "#cbd5e1" }}
                      thumbColor={formData.isPrivate ? "#64748b" : "#3b82f6"}
                    />
                  </View>
                </View>
                <View style={styles.visibilityNoteBox}>
                  <Text style={styles.visibilityNoteText}>
                    チェックを入れると自分専用のログになります。{"\n"}
                    公開する場合、「チーム情報」と「ショップ情報」以外のデータが他のユーザーにも公開されます。
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Location Section */}
        <View style={styles.sectionCard}>
          <SectionHeader title="場所・チーム" icon={MapPin} section="location" color="#ef4444" />
          {
            openSections.location && (
              <View style={styles.sectionBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>ポイントを選択</Text>
                  <View style={styles.searchWrapper}>
                    <Search size={16} color="#94a3b8" style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="ポイント名で検索..."
                      value={spotSearchTerm}
                      onChangeText={setSpotSearchTerm}
                    />
                  </View>
                  {spotSearchTerm.length > 0 && (
                    <View style={styles.searchResults}>
                      {filteredPoints.map(p => (
                        <TouchableOpacity
                          key={p.id}
                          style={styles.searchResultItem}
                          onPress={() => {
                            setFormData(prev => ({ ...prev, pointId: p.id, pointName: p.name, region: p.region }));
                            setSpotSearchTerm('');
                          }}
                        >
                          <Text style={styles.searchResultName}>{p.name}</Text>
                          <Text style={styles.searchResultSub}>{p.region} - {p.area}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {formData.pointName ? (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>{formData.pointName} ({formData.region})</Text>
                      <TouchableOpacity onPress={() => setFormData(p => ({ ...p, pointId: '', pointName: '', region: '' }))}>
                        <X size={14} color="#3b82f6" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>またはスポット名を手入力</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.pointName}
                    onChangeText={(val) => setFormData(p => ({ ...p, pointName: val }))}
                    placeholder="ショップ名や独自の場所"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>ショップ名</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.shopName}
                    onChangeText={(val) => setFormData(p => ({ ...p, shopName: val }))}
                  />
                </View>
              </View>
            )
          }
        </View >

        {/* Data Section */}
        < View style={styles.sectionCard} >
          <SectionHeader title="潜水データ" icon={Clock} section="data" color="#f59e0b" />
          {
            openSections.data && (
              <View style={styles.sectionBody}>
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>最大水深 (m)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.maxDepth}
                      onChangeText={(val) => setFormData(p => ({ ...p, maxDepth: val }))}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>平均水深 (m)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.avgDepth}
                      onChangeText={(val) => setFormData(p => ({ ...p, avgDepth: val }))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            )
          }
        </View >

        {/* Creatures Section */}
        < View style={styles.sectionCard} >
          <SectionHeader title="目撃した生物" icon={Heart} section="creatures" color="#ec4899" />
          {
            openSections.creatures && (
              <View style={styles.sectionBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>生物を検索（図鑑から追加）</Text>
                  <View style={styles.searchWrapper}>
                    <Search size={16} color="#94a3b8" style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="生物名で検索..."
                      value={creatureSearchTerm}
                      onChangeText={setCreatureSearchTerm}
                    />
                  </View>

                  {creatureSearchTerm.length > 0 && (
                    <View style={styles.searchResults}>
                      {filteredCreatures.map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.searchResultItem}
                          onPress={() => {
                            toggleSightedCreature(c.id);
                            setCreatureSearchTerm('');
                          }}
                        >
                          <Text style={styles.searchResultName}>{c.name}</Text>
                          <Text style={styles.searchResultSub}>{c.category}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {pointSpecificCreatures.length > 0 && !creatureSearchTerm && (
                    <View style={styles.pointCreaturesSection}>
                      <Text style={styles.subLabel}>このポイントの生物</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalTags}>
                        {pointSpecificCreatures.map(c => {
                          const isSelected = formData.sightedCreatures.includes(c.id);
                          return (
                            <TouchableOpacity
                              key={c.id}
                              style={[styles.pointCreatureTag, isSelected && styles.pointCreatureTagActive]}
                              onPress={() => toggleSightedCreature(c.id)}
                            >
                              <Text style={[styles.pointCreatureText, isSelected && styles.pointCreatureTextActive]}>{c.name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  <View style={styles.tagGrid}>
                    {formData.sightedCreatures.map(id => {
                      const creature = masterCreatures.find(c => c.id === id);
                      return (
                        <View key={id} style={styles.tag}>
                          <Text style={styles.tagText}>{creature?.name || '不明'}</Text>
                          <TouchableOpacity onPress={() => toggleSightedCreature(id)}>
                            <X size={14} color="#3b82f6" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>メインの生物</Text>
                  <View style={styles.searchWrapper}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="メインで見つけた生物名..."
                      value={masterCreatures.find(c => c.id === formData.creatureId)?.name || ''}
                      editable={false}
                    />
                    {formData.creatureId ? (
                      <TouchableOpacity onPress={() => setFormData(prev => ({ ...prev, creatureId: '' }))}>
                        <X size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={styles.helpTextSmall}>※上の検索から追加されたものが「目撃した生物」に入ります。メインに設定したい場合は、個別に選択してください（現状はリストから選択）。</Text>
                </View>
              </View>
            )
          }
        </View >

        {/* Photos Section */}
        < View style={styles.sectionCard} >
          <SectionHeader title="写真" icon={ImageIcon} section="photos" color="#8b5cf6" />
          {
            openSections.photos && (
              <View style={styles.sectionBody}>
                <View style={styles.photoGrid}>
                  {formData.photos.map((uri, index) => (
                    <View key={index} style={styles.photoCard}>
                      <Image source={{ uri }} style={styles.photo} />
                      <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(index)}>
                        <X size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickImage} disabled={isLoading}>
                    <Plus size={24} color="#94a3b8" />
                    <Text style={styles.addPhotoText}>追加</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          }
        </View >

        {/* Comment Section */}
        < View style={styles.sectionCard} >
          <SectionHeader title="コメント・メモ" icon={Save} section="comment" color="#8b5cf6" />
          {
            openSections.comment && (
              <View style={styles.sectionBody}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.comment}
                  onChangeText={(val) => setFormData(p => ({ ...p, comment: val }))}
                  multiline
                  numberOfLines={4}
                />
              </View>
            )
          }
        </View >

        {/* Delete Button */}
        < TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={isLoading} >
          <Trash2 size={20} color="#ef4444" />
          <Text style={styles.deleteBtnText}>ログを削除する</Text>
        </TouchableOpacity >

        <View style={{ height: 100 }} />
      </ScrollView >

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>{saveStatus || '読み込み中...'}</Text>
        </View>
      )}
    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginTop: 8,
  },
  visibilityInfo: {
    flex: 1,
  },
  visibilitySub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  visibilityNoteBox: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  visibilityNoteText: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  backBtn: { padding: 8 },
  saveBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 15 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionTitleText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginLeft: 12 },
  sectionBody: { padding: 16 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 16, color: '#0f172a' },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#0f172a' },
  searchResults: { position: 'absolute', top: 75, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', zIndex: 10, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, maxHeight: 250 },
  searchResultItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchResultName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  searchResultSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 8, gap: 8 },
  selectedBadgeText: { fontSize: 12, color: '#3b82f6', fontWeight: 'bold' },
  row: { flexDirection: 'row' },
  textArea: { height: 120, textAlignVertical: 'top' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 8 },
  deleteBtnText: { color: '#ef4444', fontWeight: 'bold', marginLeft: 8 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#334155', fontWeight: '500' },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  tagText: { fontSize: 13, color: '#334155', fontWeight: '500' },
  helpTextSmall: { fontSize: 11, color: '#94a3b8', marginTop: 8, lineHeight: 16 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoCard: { width: (width - 64 - 24) / 3, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  photo: { width: '100%', height: '100%' },
  removePhotoBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  addPhotoBtn: { width: (width - 64 - 24) / 3, aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  addPhotoText: { fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: '500' },
  pointCreaturesSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 4,
  },
  horizontalTags: {
    flexDirection: 'row',
  },
  pointCreatureTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 4,
  },
  pointCreatureTagActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  pointCreatureText: {
    fontSize: 12,
    color: '#64748b',
  },
  pointCreatureTextActive: {
    color: '#3b82f6',
    fontWeight: '700',
  },
});
