import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, TextInput, ScrollView, TouchableOpacity, Switch, Dimensions, Modal, FlatList, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Calendar, MapPin, Fish, Clock, Droplets,
  Thermometer, Save, X, Users, Settings, Search, Check,
  Sun, Camera, Info, ChevronDown, ChevronUp
} from 'lucide-react-native';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { Point, Creature, DiveLog } from '../../src/types';
import { ImageWithFallback } from '../../src/components/ImageWithFallback';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../src/firebase';
import { LogService } from '../../src/services/LogService';
import * as DocumentPicker from 'expo-document-picker';
import { parseGarminZip } from '../../src/utils/garminParser';

const { width } = Dimensions.get('window');

interface LogFormData {
  title: string;
  date: string;
  diveNumber: string;
  pointId: string;
  pointName: string;
  shopName: string;
  region: string;
  zone: string;
  area: string;
  buddy: string;
  guide: string;
  members: string;
  entryTime: string;
  exitTime: string;
  maxDepth: string;
  avgDepth: string;
  weather: string;
  airTemp: string;
  waterTempSurface: string;
  waterTempBottom: string;
  transparency: string;
  wave: string;
  current: string;
  surge: string;
  suitType: string;
  suitThickness: string;
  weight: string;
  tankMaterial: string;
  tankCapacity: string;
  pressureStart: string;
  pressureEnd: string;
  entryType: 'beach' | 'boat';
  creatureId: string;
  sightedCreatures: string[];
  comment: string;
  isPrivate: boolean;
  photos: string[];
}

export default function AddLogScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Master Data
  const [masterPoints, setMasterPoints] = useState<Point[]>([]);
  const [masterCreatures, setMasterCreatures] = useState<Creature[]>([]);

  // Selection Modals
  const [spotModalVisible, setSpotModalVisible] = useState(false);
  const [creatureModalVisible, setCreatureModalVisible] = useState(false);
  const [spotSearchTerm, setSpotSearchTerm] = useState('');
  const [creatureSearchTerm, setCreatureSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');

  // Accordion State
  const [openSections, setOpenSections] = useState({
    basic: true,
    location: true,
    data: false,
    conditions: false,
    content: true
  });

  const [formData, setFormData] = useState<LogFormData>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    diveNumber: '',
    pointId: '',
    pointName: '',
    shopName: '',
    region: '',
    zone: '',
    area: '',
    buddy: '',
    guide: '',
    members: '',
    entryTime: '10:00',
    exitTime: '10:45',
    maxDepth: '18',
    avgDepth: '12',
    weather: 'sunny',
    airTemp: '25',
    waterTempSurface: '24',
    waterTempBottom: '22',
    transparency: '15',
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
    entryType: 'boat',
    creatureId: '',
    sightedCreatures: [],
    comment: '',
    isPrivate: false,
    photos: [],
  });

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const pointsSnap = await getDocs(query(collection(db, 'points'), orderBy('name')));
        const pointsData = pointsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Point));
        setMasterPoints(pointsData);

        const creaturesSnap = await getDocs(query(collection(db, 'creatures'), orderBy('name')));
        const creaturesData = creaturesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Creature));
        setMasterCreatures(creaturesData);

        // Set Defaults from User Favorites
        if (user && user.favorites) {
          const primaryPoint = user.favorites.points?.find(p => p.isPrimary);
          const primaryShop = user.favorites.shops?.find(s => s.isPrimary);
          const primaryTank = user.favorites.gear?.tanks?.find(t => t.isPrimary);

          setFormData(prev => ({
            ...prev,
            pointId: primaryPoint?.id || prev.pointId,
            shopName: primaryShop?.name || prev.shopName,
            tankMaterial: primaryTank?.specs?.material || prev.tankMaterial,
            tankCapacity: primaryTank?.specs?.capacity?.toString() || prev.tankCapacity,
          }));
        }

        setIsDataLoaded(true);
      } catch (e) {
        console.error("Error fetching master data:", e);
      }
    };
    fetchMasterData();
  }, [user]);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateField = (name: keyof LogFormData, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleSightedCreature = (creatureId: string) => {
    setFormData(prev => {
      const exists = prev.sightedCreatures.includes(creatureId);
      if (exists) {
        return { ...prev, sightedCreatures: prev.sightedCreatures.filter(id => id !== creatureId) };
      } else {
        return { ...prev, sightedCreatures: [...prev.sightedCreatures, creatureId] };
      }
    });
  };

  const renderLoadingOverlay = () => {
    if (!isLoading) return null;
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>
          {formData.date === '' ? '解析中...' : 'ログを保存中...'}
        </Text>
      </View>
    );
  };

  const handleImportGarmin = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      setIsLoading(true);

      const response = await fetch(fileUri);
      const arrayBuffer = await response.arrayBuffer();

      const { logs } = await parseGarminZip(arrayBuffer);

      if (logs.length === 0) {
        Alert.alert('インポート失敗', '有効なダイブログが見つかりませんでした。');
        return;
      }

      if (logs.length === 1) {
        applyGarminLog(logs[0]);
      } else {
        // 多すぎる場合は最新の10件程度から選ばせるなどのUIが理想だが、
        // まずは単純に最新（配列の最初）を適用。
        Alert.alert('複数ログ検出', `${logs.length}件のログが見つかりました。最新のものを読み込みます。`);
        applyGarminLog(logs[0]);
      }
    } catch (e) {
      console.error('Garmin import failed', e);
      Alert.alert('エラー', 'インポート中にエラーが発生しました。Garmin Connectからの正しいZIPエクスポートであることを確認してください。');
    } finally {
      setIsLoading(false);
    }
  };

  const applyGarminLog = (log: any) => {
    setFormData(prev => ({
      ...prev,
      title: log.title || prev.title,
      date: log.date || prev.date,
      diveNumber: log.diveNumber?.toString() || prev.diveNumber,
      entryTime: log.time?.entry || prev.entryTime,
      exitTime: log.time?.exit || prev.exitTime,
      maxDepth: log.depth?.max?.toString() || prev.maxDepth,
      avgDepth: log.depth?.average?.toString() || prev.avgDepth,
      waterTempBottom: log.condition?.waterTemp?.bottom?.toString() || prev.waterTempBottom,
      waterTempSurface: log.condition?.waterTemp?.surface?.toString() || prev.waterTempSurface,
      transparency: log.condition?.transparency?.toString() || prev.transparency,
      buddy: log.team?.buddy || prev.buddy,
      comment: log.comment || prev.comment,
      tankMaterial: log.gear?.tank?.material || prev.tankMaterial,
      tankCapacity: log.gear?.tank?.capacity?.toString() || prev.tankCapacity,
      pressureStart: log.gear?.tank?.pressureStart?.toString() || prev.pressureStart,
      pressureEnd: log.gear?.tank?.pressureEnd?.toString() || prev.pressureEnd,
      entryType: log.entryType || prev.entryType,
    }));
    // インポート時は自動でセクションを開く
    setOpenSections(prev => ({ ...prev, data: true, conditions: true }));
    Alert.alert('成功', 'Garminデータを読み込みました。内容を確認して保存してください。');
  };

  const handleSave = async () => {
    if (!formData.title || !formData.date) {
      Alert.alert('入力エラー', 'タイトルと日付は必須です');
      return;
    }

    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    setIsLoading(true);
    console.log("Saving log starting...", { title: formData.title, date: formData.date });
    try {
      const selectedPoint = masterPoints.find(p => p.id === formData.pointId);
      console.log("Selected Point:", selectedPoint?.name || "None (Manual Input)");

      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const entry = timeRegex.test(formData.entryTime) ? formData.entryTime.split(':').map(Number) : [0, 0];
      const exit = timeRegex.test(formData.exitTime) ? formData.exitTime.split(':').map(Number) : [0, 0];

      let duration = 0;
      if (entry.length === 2 && exit.length === 2) {
        duration = (exit[0] * 60 + exit[1]) - (entry[0] * 60 + entry[1]);
        if (duration < 0) duration += 1440; // Over midnight
      }
      console.log("Calculated duration:", duration);

      const logData: Omit<DiveLog, 'id'> = {
        userId: user.id,
        title: formData.title,
        date: formData.date,
        diveNumber: Number(formData.diveNumber) || 0,
        location: {
          pointId: formData.pointId,
          pointName: selectedPoint?.name || formData.pointName || '不明',
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
        likeCount: 0,
        likedBy: [],
        spotId: formData.pointId || '',
      };

      console.log("Step 1: Attempting to save document via LogService...");
      const logId = await LogService.addLog(user.id, logData);
      console.log("Log saved successfully with ID:", logId);

      Alert.alert('完了', 'ログを保存しました', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      console.error("Critical Save Error:", e);
      Alert.alert('保存失敗', `エラーが発生しました: ${e.message || '不明'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const regions = useMemo(() => {
    const rSet = new Set(masterPoints.map(p => p.region).filter(Boolean));
    return Array.from(rSet).sort();
  }, [masterPoints]);

  const filteredPoints = useMemo(() => {
    let results = masterPoints;
    if (selectedRegion) {
      results = results.filter(p => p.region === selectedRegion);
    }
    if (spotSearchTerm) {
      const s = spotSearchTerm.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.area?.toLowerCase().includes(s)
      );
    }
    return results.slice(0, 50);
  }, [masterPoints, spotSearchTerm, selectedRegion]);

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
      const uri = result.assets[0].uri;
      uploadImage(uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `logs/${user?.id || 'unknown'}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, downloadURL]
      }));
    } catch (e) {
      console.error("Upload failed", e);
      Alert.alert('アップロード失敗', '画像のアップロードに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCreatures = useMemo(() => {
    if (!creatureSearchTerm) return masterCreatures.slice(0, 50);
    const s = creatureSearchTerm.toLowerCase();
    return masterCreatures.filter(c =>
      c.name.includes(s) ||
      c.category?.includes(s)
    ).slice(0, 50);
  }, [masterCreatures, creatureSearchTerm]);

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Dive Log</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, (!formData.title || !formData.date) && styles.saveBtnDisabled]}
          disabled={isLoading}
        >
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Basic Info */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <SectionHeader title="基本情報" icon={Calendar} section="basic" color="#3b82f6" />
            <TouchableOpacity style={styles.importBtn} onPress={handleImportGarmin}>
              <Text style={styles.importBtnText}>Garmin連携</Text>
            </TouchableOpacity>
          </View>
          {openSections.basic && (
            <View style={styles.sectionBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>タイトル</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="例: 大瀬崎でのんびりフォトダイブ"
                  value={formData.title}
                  onChangeText={v => updateField('title', v)}
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>日付</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.date}
                    onChangeText={v => updateField('date', v)}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.label}>Dive No.</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.diveNumber}
                    onChangeText={v => updateField('diveNumber', v)}
                    keyboardType="numeric"
                    placeholder="100"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>エントリー</Text>
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tab, formData.entryType === 'boat' && styles.tabActive]}
                    onPress={() => updateField('entryType', 'boat')}
                  >
                    <Text style={[styles.tabText, formData.entryType === 'boat' && styles.tabTextActive]}>ボート</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, formData.entryType === 'beach' && styles.tabActive]}
                    onPress={() => updateField('entryType', 'beach')}
                  >
                    <Text style={[styles.tabText, formData.entryType === 'beach' && styles.tabTextActive]}>ビーチ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Location & Team */}
        <View style={styles.sectionCard}>
          <SectionHeader title="場所・チーム" icon={MapPin} section="location" color="#8b5cf6" />
          {openSections.location && (
            <View style={styles.sectionBody}>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setSpotModalVisible(true)}
              >
                <MapPin size={18} color={formData.pointId ? "#3b82f6" : "#94a3b8"} />
                <Text style={[styles.selectorBtnText, !formData.pointId && styles.selectorBtnTextEmpty]}>
                  {formData.pointId ? masterPoints.find(p => p.id === formData.pointId)?.name : "ポイントを選択"}
                </Text>
              </TouchableOpacity>

              {!formData.pointId && (
                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.textInput, { fontSize: 14 }]}
                    placeholder="またはスポット名を手入力"
                    value={formData.pointName}
                    onChangeText={v => updateField('pointName', v)}
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>ショップ名</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.shopName}
                  onChangeText={v => updateField('shopName', v)}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>ガイド</Text>
                  <TextInput style={styles.textInput} value={formData.guide} onChangeText={v => updateField('guide', v)} />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.label}>バディ</Text>
                  <TextInput style={styles.textInput} value={formData.buddy} onChangeText={v => updateField('buddy', v)} />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Dive Data */}
        <View style={styles.sectionCard}>
          <SectionHeader title="ダイブデータ" icon={Clock} section="data" color="#10b981" />
          {openSections.data && (
            <View style={styles.sectionBody}>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>エントリー時間</Text>
                  <TextInput style={styles.textInput} value={formData.entryTime} onChangeText={v => updateField('entryTime', v)} />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.label}>エキジット時間</Text>
                  <TextInput style={styles.textInput} value={formData.exitTime} onChangeText={v => updateField('exitTime', v)} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>最大水深 (m)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={formData.maxDepth}
                    onChangeText={v => updateField('maxDepth', v)}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.label}>平均水深 (m)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={formData.avgDepth}
                    onChangeText={v => updateField('avgDepth', v)}
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Content & Photos */}
        <View style={styles.sectionCard}>
          <SectionHeader title="生物・コメント・写真" icon={Fish} section="content" color="#ef4444" />
          {openSections.content && (
            <View style={styles.sectionBody}>
              <View style={styles.creatureSelectGroup}>
                <Text style={styles.label}>見た生物（複数選択可）</Text>
                <TouchableOpacity
                  style={styles.selectorBtn}
                  onPress={() => setCreatureModalVisible(true)}
                >
                  <Search size={18} color="#94a3b8" />
                  <Text style={styles.selectorBtnTextEmpty}>生物を検索して追加...</Text>
                </TouchableOpacity>

                {formData.sightedCreatures.length > 0 && (
                  <View style={styles.sightedList}>
                    {formData.sightedCreatures.map(id => {
                      const creature = masterCreatures.find(c => c.id === id);
                      if (!creature) return null;
                      return (
                        <View key={id} style={styles.sightedTag}>
                          <Text style={styles.sightedTagName}>{creature.name}</Text>
                          <TouchableOpacity onPress={() => toggleSightedCreature(id)}>
                            <X size={14} color="#64748b" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>主な生物（メイン）</Text>
                <TouchableOpacity
                  style={styles.selectorBtn}
                  onPress={() => setCreatureModalVisible(true)}
                >
                  <Fish size={18} color={formData.creatureId ? "#ef4444" : "#94a3b8"} />
                  <Text style={[styles.selectorBtnText, !formData.creatureId && styles.selectorBtnTextEmpty]}>
                    {formData.creatureId ? masterCreatures.find(c => c.id === formData.creatureId)?.name : "未選択"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>コメント・メモ</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="ダイビングの感想などを自由に記入..."
                  multiline
                  numberOfLines={4}
                  value={formData.comment}
                  onChangeText={v => updateField('comment', v)}
                />
              </View>

              <View style={styles.photoSection}>
                <Text style={styles.label}>写真</Text>
                <View style={styles.photoGrid}>
                  {formData.photos.map((uri, index) => (
                    <View key={index} style={styles.photoWrapper}>
                      <Image source={{ uri }} style={styles.photoItem} />
                      <TouchableOpacity
                        style={styles.removePhotoBtn}
                        onPress={() => removePhoto(index)}
                      >
                        <X size={12} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickImage} disabled={isLoading}>
                    <Camera size={24} color="#94a3b8" />
                    <Text style={styles.addPhotoText}>追加</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>非公開ログにする</Text>
                  <Text style={styles.switchDesc}>自分だけに表示されます</Text>
                </View>
                <Switch
                  value={formData.isPrivate}
                  onValueChange={v => updateField('isPrivate', v)}
                  trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                />
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>ログを保存する</Text>}
        </TouchableOpacity>

      </ScrollView>

      {/* Spot Selector Modal */}
      <Modal visible={spotModalVisible} animationType="slide">
        <View style={styles.modalFull}>
          <View style={styles.modalHeaderFull}>
            <TouchableOpacity onPress={() => setSpotModalVisible(false)}>
              <X size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.modalTitleFull}>ポイント選択</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalFilterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipScroll}>
              <TouchableOpacity
                style={[styles.filterChip, !selectedRegion && styles.filterChipActive]}
                onPress={() => setSelectedRegion('')}
              >
                <Text style={[styles.filterChipText, !selectedRegion && styles.filterChipTextActive]}>全て</Text>
              </TouchableOpacity>
              {regions.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.filterChip, selectedRegion === r && styles.filterChipActive]}
                  onPress={() => setSelectedRegion(r)}
                >
                  <Text style={[styles.filterChipText, selectedRegion === r && styles.filterChipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.modalSearchBox}>
            <Search size={20} color="#94a3b8" />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="ポイント名やエリアで検索..."
              value={spotSearchTerm}
              onChangeText={setSpotSearchTerm}
            />
          </View>

          <FlatList
            data={filteredPoints}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalListItem}
                onPress={() => {
                  updateField('pointId', item.id);
                  setSpotModalVisible(false);
                }}
              >
                <View style={styles.modalListIcon}>
                  <MapPin size={18} color="#64748b" />
                </View>
                <View>
                  <Text style={styles.modalItemName}>{item.name}</Text>
                  <Text style={styles.modalItemSub}>{item.region} • {item.area}</Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ padding: 16 }}
          />
        </View>
      </Modal>

      {/* Creature Selector Modal */}
      <Modal visible={creatureModalVisible} animationType="slide">
        <View style={styles.modalFull}>
          <View style={styles.modalHeaderFull}>
            <TouchableOpacity onPress={() => setCreatureModalVisible(false)}>
              <X size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.modalTitleFull}>生物選択</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalSearchBox}>
            <Search size={20} color="#94a3b8" />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="生物名や種別で検索..."
              value={creatureSearchTerm}
              onChangeText={setCreatureSearchTerm}
            />
          </View>

          <FlatList
            data={filteredCreatures}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalListItem}
                onPress={() => {
                  toggleSightedCreature(item.id);
                  if (!formData.creatureId) updateField('creatureId', item.id);
                  setCreatureModalVisible(false);
                }}
              >
                <View style={[styles.modalListIcon, { padding: 0, overflow: 'hidden' }]}>
                  <ImageWithFallback
                    source={item.imageUrl ? { uri: item.imageUrl } : null}
                    fallbackSource={require('../../assets/images/no-image-creature.png')}
                    style={{ width: '100%', height: '100%' }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalItemName}>{item.name}</Text>
                  <Text style={styles.modalItemSub}>{item.category}</Text>
                </View>
                {formData.sightedCreatures.includes(item.id) && <Check size={20} color="#10b981" />}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ padding: 16 }}
          />
        </View>
      </Modal>
      {renderLoadingOverlay()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  saveBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectionHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  importBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  importBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
  },
  sectionBody: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: 'transparent',
  },
  inputGroup: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 8,
    marginLeft: 4,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0f172a',
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  selectorBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  selectorBtnTextEmpty: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  creatureSelectGroup: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  sightedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  sightedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sightedTagName: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  photoSection: {
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  photoWrapper: {
    width: (width - 64 - 30) / 4,
    height: (width - 64 - 30) / 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoItem: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    width: (width - 64 - 30) / 4,
    height: (width - 64 - 30) / 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  addPhotoText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: 'transparent',
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  switchDesc: {
    fontSize: 12,
    color: '#94a3b8',
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalFull: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeaderFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: 'transparent',
  },
  modalTitleFull: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalFilterRow: {
    backgroundColor: '#fff',
    paddingBottom: 12,
  },
  filterChipScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
  },
  filterChipText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    margin: 16,
    marginTop: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: 'transparent',
  },
  modalListIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalItemSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#0ea5e9',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
