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
} from 'react-native';
import { useRouter } from 'expo-router';
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
  Image as ImageIcon,
  Wind,
  Droplets,
  Waves,
  Maximize2,
  Minimize2,
  Trash2,
  ChevronLeft,
  Info
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/context/AuthContext';
import { db, storage } from '../../src/firebase';
import { LogService } from '../../src/services/LogService';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { parseGarminZip, parseGarminCsv } from '../../src/utils/garminParser';
import { DiveLog, Point } from '../../src/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const { width } = Dimensions.get('window');

/**
 * Add Log Screen
 * Enhanced for Garmin Import and beautiful UI.
 */
export default function AddLogScreen() {
  const router = useRouter();
  const { user, logs } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [masterPoints, setMasterPoints] = useState<Point[]>([]);
  const [masterCreatures, setMasterCreatures] = useState<any[]>([]);
  const [spotSearchTerm, setSpotSearchTerm] = useState('');
  const [creatureSearchTerm, setCreatureSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [helpModalVisible, setHelpModalVisible] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    diveNumber: '',
    pointId: '',
    pointName: '',
    region: '',
    shopName: '',
    buddy: '',
    guide: '',
    members: '',
    entryTime: '10:00',
    exitTime: '10:45',
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
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const pointsSnap = await getDocs(query(collection(db, 'points'), where('status', '==', 'approved')));
      setMasterPoints(pointsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Point)));

      const creaturesSnap = await getDocs(query(collection(db, 'creatures'), where('status', '==', 'approved')));
      setMasterCreatures(creaturesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error("Master data fetch error:", e);
    }
  };

  const handleImportGarmin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setSaveStatus('ファイルを選択してください...');

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'text/csv', 'application/vnd.ms-excel', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setIsLoading(false);
        setSaveStatus('');
        return;
      }

      const fileUri = result.assets[0].uri;
      const fileName = result.assets[0].name;

      setSaveStatus('ファイルを読み込み中...');

      let parsedResult;
      if (fileName.toLowerCase().endsWith('.csv')) {
        const text = await FileSystem.readAsStringAsync(fileUri);
        parsedResult = await parseGarminCsv(text);
      } else {
        // ZIPファイル：メモリ節約のためbase64で読み込み、そのままパーサーに渡す
        setSaveStatus('データを解析中 (これには時間がかかる場合があります)...');
        const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });

        // 解析処理 (内部で Buffer/ArrayBuffer 変換を効率的に行う)
        parsedResult = await parseGarminZip(base64 as any, {
          onProgress: (msg) => setSaveStatus(msg)
        });
      }

      const { logs } = parsedResult;

      if (!logs || logs.length === 0) {
        Alert.alert('インポート失敗', '有効なダイブログが見つかりませんでした。ファイル形式を確認してください。');
        setIsLoading(false);
        setSaveStatus('');
        return;
      }

      setIsLoading(false);
      setSaveStatus('');

      if (logs.length === 1) {
        applyGarminLog(logs[0]);
      } else {
        Alert.alert(
          '複数ログ検出',
          `${logs.length}件のログが見つかりました。どうしますか？`,
          [
            { text: '最新の1件のみ反映', onPress: () => applyGarminLog(logs[0]) },
            { text: `${logs.length}件すべて保存`, onPress: () => handleBulkImport(logs) },
            { text: 'キャンセル', style: 'cancel' }
          ]
        );
      }
    } catch (e: any) {
      setIsLoading(false);
      setSaveStatus('');
      console.error('Garmin import failed:', e);
      Alert.alert('エラー', `原因: ${e.message || '読み込み失敗'}\nファイルが大きすぎるか、形式が正しくない可能性があります。`);
    }
  };

  const handleBulkImport = async (parsedLogs: any[]) => {
    if (!user) return;
    setIsLoading(true);
    let successCount = 0;
    const newLogIds: string[] = [];

    try {
      const existingActivityIds = new Set(logs.map(l => l.garminActivityId).filter(Boolean));

      for (let i = 0; i < parsedLogs.length; i++) {
        setSaveStatus(`一括保存中 (${i + 1}/${parsedLogs.length})...`);
        const log = parsedLogs[i];

        // 重複チェック
        if (log.garminActivityId && existingActivityIds.has(log.garminActivityId)) {
          console.log(`Skipping duplicate Activity ID: ${log.garminActivityId}`);
          continue;
        }

        const logData = {
          title: log.title || 'Garmin Dive',
          date: log.date,
          diveNumber: Number(log.diveNumber) || 0,
          time: log.time,
          location: log.location || { pointId: '', pointName: 'Garmin Dive', region: '' },
          depth: log.depth || { max: 0, average: 0 },
          condition: log.condition || {},
          gear: log.gear || {},
          profile: log.profile || [],
          comment: log.comment || '',
          garminActivityId: log.garminActivityId || '',
          sightedCreatures: [],
          photos: [],
          likeCount: 0,
          likedBy: [],
          isPrivate: false,
          spotId: '',
          entryType: log.entryType || 'boat',
        };

        const logId = await LogService.addLog(user.id, logData as any, { skipUserUpdate: true });
        newLogIds.push(logId);
        successCount++;

        if (i % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // 最後の一回だけ、全ログIDをユーザーのリストに一括登録する（これで確実に反映される）
      setSaveStatus('最終同期中...');
      await LogService.updateUserLogList(user.id, newLogIds);

      setSaveStatus('インポート完了！');
      Alert.alert('成功', `${successCount}件のログを一括保存しました。`, [
        { text: 'OK', onPress: () => router.push('/(tabs)/mypage') }
      ]);
    } catch (e: any) {
      console.error("Bulk Import Error:", e);
      Alert.alert('中断', `途中でエラーが発生しました (${successCount}件完了): ${e.message}`);
    } finally {
      setIsLoading(false);
      setSaveStatus('');
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
      importProfile: log.profile || [],
      garminActivityId: log.garminActivityId || '',
    }));
    // インポート時は自動で主要セクションを開く
    setOpenSections(prev => ({ ...prev, basic: true, data: true, conditions: true }));
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
    setSaveStatus('保存の準備をしています...');

    // 100ms待機してUI（くるくる）を確実に表示させる
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const selectedPoint = masterPoints.find(p => p.id === formData.pointId);

      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const entry = timeRegex.test(formData.entryTime) ? formData.entryTime.split(':').map(Number) : [0, 0];
      const exit = timeRegex.test(formData.exitTime) ? formData.exitTime.split(':').map(Number) : [0, 0];

      let duration = 0;
      if (entry.length === 2 && exit.length === 2) {
        duration = (exit[0] * 60 + exit[1]) - (entry[0] * 60 + entry[1]);
        if (duration < 0) duration += 1440; // Over midnight
      }

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
        likeCount: 0,
        likedBy: [],
        spotId: formData.pointId || '',
        garminActivityId: formData.garminActivityId,
      };

      setSaveStatus('サーバーに送信中...');

      // 30秒でタイムアウトさせる
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('通信タイムアウト：電波の良い場所で再度お試しください')), 30000)
      );

      await Promise.race([
        LogService.addLog(user.id, logData as any),
        timeoutPromise
      ]);

      setSaveStatus('保存に成功しました！');

      Alert.alert('完了', 'ログを保存しました', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      console.error("Save Error:", e);
      Alert.alert('保存失敗', `エラーが発生しました: ${e.message || '不明'}`);
    } finally {
      setIsLoading(false);
      setSaveStatus('');
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
        p.area.toLowerCase().includes(s) ||
        p.zone.toLowerCase().includes(s)
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
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCreatures = useMemo(() => {
    if (!creatureSearchTerm) return [];
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
      {/* Header */}
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
            <View style={styles.importActions}>
              <TouchableOpacity style={styles.helpIconBtn} onPress={() => setHelpModalVisible(true)}>
                <Info size={16} color="#94a3b8" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.importBtn} onPress={handleImportGarmin}>
                <Text style={styles.importBtnText}>Garmin連携</Text>
              </TouchableOpacity>
            </View>
          </View>
          {openSections.basic && (
            <View style={styles.sectionBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>タイトル</Text>
                <TextInput
                  style={styles.input}
                  value={formData.title}
                  onChangeText={(val) => setFormData(p => ({ ...p, title: val }))}
                  placeholder="例: 大瀬崎でのんびりフォトダイブ"
                  placeholderTextColor="#94a3b8"
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
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Dive No.</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.diveNumber}
                    onChangeText={(val) => setFormData(p => ({ ...p, diveNumber: val }))}
                    placeholder="100"
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>エントリー</Text>
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[styles.segment, formData.entryType === 'boat' && styles.segmentActive]}
                    onPress={() => setFormData(p => ({ ...p, entryType: 'boat' }))}
                  >
                    <Text style={[styles.segmentText, formData.entryType === 'boat' && styles.segmentTextActive]}>ボート</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segment, formData.entryType === 'beach' && styles.segmentActive]}
                    onPress={() => setFormData(p => ({ ...p, entryType: 'beach' }))}
                  >
                    <Text style={[styles.segmentText, formData.entryType === 'beach' && styles.segmentTextActive]}>ビーチ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Location & Team */}
        <View style={styles.sectionCard}>
          <SectionHeader title="場所・チーム" icon={MapPin} section="location" color="#ef4444" />
          {openSections.location && (
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
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>ショップ名</Text>
                <TextInput
                  style={styles.input}
                  value={formData.shopName}
                  onChangeText={(val) => setFormData(p => ({ ...p, shopName: val }))}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>ガイド</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.guide}
                    onChangeText={(val) => setFormData(p => ({ ...p, guide: val }))}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>バディ</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.buddy}
                    onChangeText={(val) => setFormData(p => ({ ...p, buddy: val }))}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Dive Data */}
        <View style={styles.sectionCard}>
          <SectionHeader title="潜水データ" icon={Clock} section="data" color="#f59e0b" />
          {openSections.data && (
            <View style={styles.sectionBody}>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>エントリー時間</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.entryTime}
                    onChangeText={(val) => setFormData(p => ({ ...p, entryTime: val }))}
                    placeholder="10:00"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>エキジット時間</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.exitTime}
                    onChangeText={(val) => setFormData(p => ({ ...p, exitTime: val }))}
                    placeholder="10:45"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>最大水深 (m)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.maxDepth}
                    onChangeText={(val) => setFormData(p => ({ ...p, maxDepth: val }))}
                    placeholder="20.5"
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>平均水深 (m)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.avgDepth}
                    onChangeText={(val) => setFormData(p => ({ ...p, avgDepth: val }))}
                    placeholder="12.0"
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Conditions */}
        <View style={styles.sectionCard}>
          <SectionHeader title="コンディション" icon={Thermometer} section="conditions" color="#06b6d4" />
          {openSections.conditions && (
            <View style={styles.sectionBody}>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>水温 (水底 ℃)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.waterTempBottom}
                    onChangeText={(val) => setFormData(p => ({ ...p, waterTempBottom: val }))}
                    placeholder="22"
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>透明度 (m)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.transparency}
                    onChangeText={(val) => setFormData(p => ({ ...p, transparency: val }))}
                    placeholder="15"
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
              {/* More condition fields can be added here */}
            </View>
          )}
        </View>

        {/* Comment Section */}
        <View style={styles.sectionCard}>
          <SectionHeader title="コメント・メモ" icon={Save} section="comment" color="#8b5cf6" />
          {openSections.comment && (
            <View style={styles.sectionBody}>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.comment}
                onChangeText={(val) => setFormData(p => ({ ...p, comment: val }))}
                multiline
                numberOfLines={4}
                placeholder="今日のダイビングの思い出や、見つけた生き物へのメモ..."
                placeholderTextColor="#94a3b8"
              />
            </View>
          )}
        </View>

        {/* Action Button at bottom */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>ログを保存する</Text>}
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>
            {saveStatus || '処理中...'}
          </Text>
        </View>
      )}

      {/* Garmin Help Modal */}
      {helpModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Garminインポートについて</Text>
              <TouchableOpacity onPress={() => setHelpModalVisible(false)}>
                <X size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.helpText}>
                Garmin Connectから以下の形式でインポートできます：
              </Text>

              <View style={styles.helpSection}>
                <Text style={styles.helpSubTitle}>1. ZIP形式（全データ一括書き出し）</Text>
                <Text style={styles.helpDesc}>
                  Garminの「個人データのダウンロード」から取得できるZIPファイルです。
                  潜水時間、最大/平均水深、水温、さらには潜水プロフィールデータが含まれます。
                </Text>
              </View>

              <View style={styles.helpSection}>
                <Text style={styles.helpSubTitle}>2. CSV形式（個別・リスト書き出し）</Text>
                <Text style={styles.helpDesc}>
                  Garmin Connectのアクティビティリストから出力できるCSVファイルです。
                  タイトル、日付、時間、水深の基本情報を手軽に読み込めます。
                </Text>
              </View>

              <Text style={styles.helpNote}>
                ※ZIPファイル内に複数のダイブログが見つかった場合は、最新のログを対象として読み込みます。
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setHelpModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    height: 100,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  saveBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  sectionHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 10,
  },
  sectionBody: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#3b82f6',
  },
  importActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  importBtn: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  importBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  helpIconBtn: {
    padding: 6,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  selectedBadgeText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '600',
    marginRight: 6,
  },
  searchResults: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 10,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  searchResultSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 30,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#334155',
    fontWeight: '600',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 2000,
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '100%',
    maxHeight: '80%',
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalBody: {
    marginBottom: 20,
  },
  helpText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 16,
  },
  helpSection: {
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
  },
  helpSubTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  helpDesc: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  helpNote: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  modalCloseBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
});
