import React, { useState, useMemo } from 'react';
import { StyleSheet, Pressable, ScrollView, Image, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { LogOut, ChevronRight, Bookmark, Heart, Settings, Activity, BookOpen, Grid, User as UserIcon, Award, Star, MapPin, Plus, Clock, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { usePoints } from '../../src/hooks/usePoints';
import { useCreatures } from '../../src/hooks/useCreatures';
import { useUserStats } from '../../src/hooks/useUserStats';
import { DiveLog, Creature, Point } from '../../src/types';
import { ImageWithFallback } from '../../src/components/ImageWithFallback';

const { width } = Dimensions.get('window');
const NO_IMAGE_CREATURE = require('../../assets/images/no-image-creature.png');
const NO_IMAGE_POINT = require('../../assets/images/no-image-point.png');

type TabType = 'dashboard' | 'logbook' | 'collection' | 'favorites' | 'wanted' | 'plan';

export default function MyPageScreen() {
  const router = useRouter();
  const { user, logs, isLoading: authLoading, signOut } = useAuth();

  const { data: points = [], isLoading: loadingPoints } = usePoints();
  const { data: creatures = [], isLoading: loadingCreatures } = useCreatures();
  // usePointCreatures is no longer needed for mastery calculation!
  const { data: stats, isLoading: loadingStats } = useUserStats();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const isLoading = authLoading || loadingPoints || loadingCreatures || loadingStats;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  // Derived Data
  const mapLogToIds = (logs: DiveLog[]) => {
    return Array.from(new Set(logs.flatMap(l => [l.creatureId, ...(l.sightedCreatures || [])]).filter((id): id is string => !!id)));
  };

  const uniqueCreatureIds = useMemo(() => mapLogToIds(logs || []), [logs]);

  const discoveredCreatures = useMemo(() =>
    uniqueCreatureIds.map(id => creatures.find(c => c.id === id)).filter((c): c is Creature => c !== undefined),
    [uniqueCreatureIds, creatures]);

  const favoriteCreatures = useMemo(() =>
    (user?.favoriteCreatureIds || []).map(id => creatures.find(c => c.id === id)).filter((c): c is Creature => c !== undefined),
    [user?.favoriteCreatureIds, creatures]);

  const wantedCreatures = useMemo(() =>
    (user?.wanted || []).map(id => creatures.find(c => c.id === id)).filter((c): c is Creature => c !== undefined),
    [user?.wanted, creatures]);

  const bookmarkedPoints = useMemo(() =>
    (user?.bookmarkedPointIds || []).map(id => points.find(p => p.id === id)).filter((p): p is Point => p !== undefined),
    [user?.bookmarkedPointIds, points]);

  // Use server-side calculated stats directly
  const pointMastery = stats?.points || [];

  const completionRate = creatures.length > 0 ? Math.round((uniqueCreatureIds.length / creatures.length) * 100) : 0;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { padding: 40 }]}>
        <View style={styles.guestIconBg}>
          <UserIcon size={48} color="#94a3b8" />
        </View>
        <Text style={styles.guestTitle}>ログインが必要です</Text>
        <Text style={styles.guestText}>
          ログブックの記録やコレクション、お気に入りの保存にはログインが必要です。
        </Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginBtnText}>ログインする</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signupBtn} onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.signupBtnText}>アカウント作成</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        const trustScore = user.trustScore || 0;
        const currentRankProgress = Math.min(100, (trustScore % 100));

        return (
          <View style={styles.tabContent}>
            {/* Rank Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBg, { backgroundColor: '#f0f9ff' }]}>
                  <Award size={20} color="#0ea5e9" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.cardInfoLabel}>CURRENT RANK</Text>
                  <Text style={styles.cardInfoValue}>Explorer Level {Math.floor(trustScore / 100) + 1}</Text>
                </View>
                <View style={styles.tpBadge}>
                  <Text style={styles.tpText}>{trustScore} TP</Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${currentRankProgress}%` }]} />
              </View>
              <View style={styles.rankFooter}>
                <Text style={styles.rankFooterText}>Next Rank: {100 - (trustScore % 100)} TP remaining</Text>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: '#eff6ff' }]}>
                <Activity size={20} color="#3b82f6" />
                <Text style={styles.statCardNumber}>{logs.length || 0}</Text>
                <Text style={styles.statCardLabel}>Dives</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
                <Grid size={20} color="#22c55e" />
                <Text style={styles.statCardNumber}>{uniqueCreatureIds.length}</Text>
                <Text style={styles.statCardLabel}>Collection</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#fff7ed' }]}>
                <MapPin size={20} color="#f97316" />
                <Text style={styles.statCardNumber}>{user.bookmarkedPointIds?.length || 0}</Text>
                <Text style={styles.statCardLabel}>Points</Text>
              </View>
            </View>

            {/* Mastery Section */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBg, { backgroundColor: '#fdf2f8' }]}>
                  <Sparkles size={20} color="#ec4899" />
                </View>
                <Text style={styles.cardTitleCompact}>Creature Discovery</Text>
                <Text style={styles.masteryPercentage}>{completionRate}%</Text>
              </View>
              <View style={[styles.progressContainer, { backgroundColor: '#fce7f3' }]}>
                <View style={[styles.progressBar, { width: `${completionRate}%`, backgroundColor: '#ec4899' }]} />
              </View>
              <Text style={styles.masterySubtext}>
                {uniqueCreatureIds.length} / {creatures.length} species found
              </Text>
            </View>

            {/* Point Mastery Section */}
            <View style={styles.masterySection}>
              <Text style={styles.sectionTitleMain}>Point Mastery</Text>
              {pointMastery.length > 0 ? (
                pointMastery.map(pm => (
                  <TouchableOpacity
                    key={pm.pointId}
                    style={styles.masteryCard}
                    onPress={() => router.push(`/details/spot/${pm.pointId}`)}
                  >
                    <View style={styles.masteryHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.masteryPointName}>{pm.pointName}</Text>
                        <Text style={styles.masterySubInfo}>{pm.diveCount} dives · {pm.discoveredCount} / {pm.totalCount} species</Text>
                      </View>
                      <View style={styles.masteryRateContainer}>
                        <Text style={[styles.masteryRateText, { color: pm.masteryRate === 100 ? '#10b981' : '#0ea5e9' }]}>
                          {pm.masteryRate}%
                        </Text>
                      </View>
                    </View>
                    <View style={styles.masteryProgressBg}>
                      <View style={[
                        styles.masteryProgressBar,
                        { width: `${pm.masteryRate}%`, backgroundColor: pm.masteryRate === 100 ? '#10b981' : '#0ea5e9' }
                      ]} />
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.masteryCreatureRow}
                      contentContainerStyle={{ paddingRight: 16 }}
                    >
                      {pm.creaturesAtPoint && pm.creaturesAtPoint.map(creature => {
                        const isDiscovered = creature.isDiscovered;
                        return (
                          <View key={creature.id} style={styles.masteryIconWrapper}>
                            {isDiscovered ? (
                              <Image
                                source={creature.imageUrl ? { uri: creature.imageUrl } : NO_IMAGE_CREATURE}
                                style={styles.masteryIcon}
                              />
                            ) : (
                              <View style={styles.masteryIconLocked}>
                                <Text style={styles.masteryIconLockedText}>?</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.card}>
                  <Text style={styles.emptyMasteryText}>ログを記録すると、スポットごとの攻略率が表示されます。</Text>
                </View>
              )}
            </View>
          </View>
        );

      case 'logbook':
        return (
          <View style={styles.tabContent}>
            {logs.length > 0 ? (
              <View style={{ gap: 12 }}>
                {logs.map((log: DiveLog) => (
                  <TouchableOpacity
                    key={log.id}
                    style={styles.logCard}
                    onPress={() => router.push(`/log/${log.id}` as any)}
                  >
                    <View style={styles.logCardHeader}>
                      <View>
                        <Text style={styles.logDate}>{log.date}</Text>
                        <Text style={styles.logTitle}>{log.title}</Text>
                      </View>
                      <View style={styles.diveNumBadge}>
                        <Text style={styles.diveNumText}>#{log.diveNumber || '-'}</Text>
                      </View>
                    </View>
                    <View style={styles.logCardFooter}>
                      <View style={styles.logMeta}>
                        <MapPin size={12} color="#64748b" />
                        <Text style={styles.logMetaText}>{log.location.pointName}</Text>
                      </View>
                      <View style={styles.logMeta}>
                        <Clock size={12} color="#64748b" />
                        <Text style={styles.logMetaText}>{log.time.duration} min</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <BookOpen size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>まだログがありません。ダイビングを記録しましょう！</Text>
                <TouchableOpacity
                  style={styles.addLogBtnInline}
                  onPress={() => router.push('/log/add')}
                >
                  <Plus size={20} color="#fff" />
                  <Text style={styles.addLogBtnInlineText}>最初のログを追加</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      case 'collection':
        return (
          <View style={styles.tabContent}>
            <View style={styles.creatureGrid}>
              {discoveredCreatures.map(creature => (
                <TouchableOpacity
                  key={creature.id}
                  style={styles.creatureSmallCard}
                  onPress={() => router.push(`/details/creature/${creature.id}`)}
                >
                  <ImageWithFallback
                    source={creature.imageUrl ? { uri: creature.imageUrl } : null}
                    fallbackSource={NO_IMAGE_CREATURE}
                    style={styles.creatureSmallThumb}
                  />
                  <View style={styles.creatureSmallInfo}>
                    <Text style={styles.creatureSmallName} numberOfLines={1}>{creature.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {discoveredCreatures.length === 0 && (
                <View style={styles.emptyState}>
                  <Grid size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>まだ発見した生物がいません。</Text>
                </View>
              )}
            </View>
          </View>
        );

      case 'favorites':
        return (
          <View style={styles.tabContent}>
            {bookmarkedPoints.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text style={styles.sectionTitle}>お気に入りのスポット</Text>
                <View style={{ gap: 12 }}>
                  {bookmarkedPoints.map(point => (
                    <TouchableOpacity
                      key={point.id}
                      style={styles.pointRowCard}
                      onPress={() => router.push(`/details/spot/${point.id}`)}
                    >
                      <ImageWithFallback
                        source={point.imageUrl ? { uri: point.imageUrl } : null}
                        fallbackSource={NO_IMAGE_POINT}
                        style={styles.pointRowThumb}
                      />
                      <View style={styles.pointRowInfo}>
                        <Text style={styles.pointRowName}>{point.name}</Text>
                        <Text style={styles.pointRowArea}>{point.area || point.region}</Text>
                      </View>
                      <ChevronRight size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View>
              <Text style={styles.sectionTitle}>お気に入りの生物</Text>
              <View style={styles.creatureGrid}>
                {favoriteCreatures.map(creature => (
                  <TouchableOpacity
                    key={creature.id}
                    style={styles.creatureSmallCard}
                    onPress={() => router.push(`/details/creature/${creature.id}`)}
                  >
                    <ImageWithFallback
                      source={creature.imageUrl ? { uri: creature.imageUrl } : null}
                      fallbackSource={NO_IMAGE_CREATURE}
                      style={styles.creatureSmallThumb}
                    />
                    <View style={styles.creatureSmallInfo}>
                      <Text style={styles.creatureSmallName} numberOfLines={1}>{creature.name}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              {favoriteCreatures.length === 0 && bookmarkedPoints.length === 0 && (
                <View style={styles.emptyState}>
                  <Heart size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>お気に入りがありません。</Text>
                </View>
              )}
            </View>
          </View>
        );

      case 'wanted':
        return (
          <View style={styles.tabContent}>
            <View style={styles.creatureGrid}>
              {wantedCreatures.map(creature => (
                <TouchableOpacity
                  key={creature.id}
                  style={styles.creatureSmallCard}
                  onPress={() => router.push(`/details/creature/${creature.id}`)}
                >
                  <ImageWithFallback
                    source={creature.imageUrl ? { uri: creature.imageUrl } : null}
                    fallbackSource={NO_IMAGE_CREATURE}
                    style={styles.creatureSmallThumb}
                  />
                  {uniqueCreatureIds.includes(creature.id) && (
                    <View style={styles.checkBadge}>
                      <Star size={10} color="#fff" fill="#fff" />
                    </View>
                  )}
                  <View style={styles.creatureSmallInfo}>
                    <Text style={styles.creatureSmallName} numberOfLines={1}>{creature.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {wantedCreatures.length === 0 && (
                <View style={styles.emptyState}>
                  <Bookmark size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>いつか見たい生物を登録しましょう。</Text>
                </View>
              )}
            </View>
          </View>
        );

      case 'plan':
        return (
          <View style={styles.tabContent}>
            <View style={{ gap: 12 }}>
              {bookmarkedPoints.map(point => (
                <TouchableOpacity
                  key={point.id}
                  style={styles.pointRowCard}
                  onPress={() => router.push(`/details/spot/${point.id}`)}
                >
                  <ImageWithFallback
                    source={point.imageUrl ? { uri: point.imageUrl } : null}
                    fallbackSource={NO_IMAGE_POINT}
                    style={styles.pointRowThumb}
                  />
                  <View style={styles.pointRowInfo}>
                    <Text style={styles.pointRowName}>{point.name}</Text>
                    <Text style={styles.pointRowArea}>{point.area || point.region}</Text>
                  </View>
                  <ChevronRight size={20} color="#cbd5e1" />
                </TouchableOpacity>
              ))}
              {bookmarkedPoints.length === 0 && (
                <View style={styles.emptyState}>
                  <MapPin size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>行きたいスポットをブックマークしましょう。</Text>
                </View>
              )}
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.profileRow}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: user.profileImage || 'https://via.placeholder.com/150' }}
                style={styles.avatar}
              />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{user.name || 'Diver'}</Text>
              <Text style={styles.role}>{user.role === 'admin' ? 'Admin' : 'Diver'}</Text>
              <View style={styles.rankBadge}>
                <Star size={10} color="#0ea5e9" fill="#0ea5e9" />
                <Text style={styles.rankText}>Explorer Rank</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.settingsBtn, { marginRight: 8 }]}
              onPress={() => router.push('/log/add')}
            >
              <Plus size={24} color="#0ea5e9" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn}>
              <Settings size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabBar}>
          {[
            { id: 'dashboard', icon: Activity, label: '概況' },
            { id: 'logbook', icon: BookOpen, label: 'ログ' },
            { id: 'collection', icon: Grid, label: '図鑑' },
            { id: 'favorites', icon: Heart, label: '推し' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, activeTab === tab.id && styles.activeTabItem]}
              onPress={() => setActiveTab(tab.id as TabType)}
            >
              <tab.icon size={24} color={activeTab === tab.id ? '#0ea5e9' : '#94a3b8'} />
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {renderContent()}


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <Pressable style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Settings size={20} color="#64748b" />
              <Text style={styles.menuLabel}>Account Settings</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </Pressable>
          <Pressable style={[styles.menuItem, styles.lastItem]} onPress={handleSignOut}>
            <View style={styles.menuLeft}>
              <LogOut size={20} color="#94a3b8" />
              <Text style={styles.menuLabel}>Log Out</Text>
            </View>
          </Pressable>
        </View>

        <Text style={styles.footerText}>WeDive Mobile v1.0.0</Text>
      </ScrollView>

      {activeTab === 'logbook' && logs.length > 0 && (
        <TouchableOpacity
          style={styles.addLogBtnFab}
          onPress={() => router.push('/log/add')}
        >
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
  },
  tabContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  cardInfoValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 2,
  },
  tpBadge: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tpText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#0ea5e9',
    borderRadius: 4,
  },
  rankFooter: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  rankFooterText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  statCardNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1e293b',
    marginTop: 8,
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  cardTitleCompact: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    marginLeft: 12,
    flex: 1,
  },
  masteryPercentage: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ec4899',
  },
  masterySubtext: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  contributionSection: {
    marginTop: 8,
  },
  sectionTitleMain: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 16,
    marginLeft: 4,
  },
  contributionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contributionBtnText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  masterySection: {
    marginTop: 8,
  },
  masteryCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  masteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  masteryPointName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  masterySubInfo: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  masteryRateContainer: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  masteryRateText: {
    fontSize: 14,
    fontWeight: '900',
  },
  masteryProgressBg: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  masteryProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  emptyMasteryText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    padding: 12,
    fontWeight: '500',
  },
  masteryCreatureRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingRight: 8,
  },
  masteryIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masteryIcon: {
    width: '100%',
    height: '100%',
  },
  masteryIconLocked: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#bfd8ea', // Game coin-like color for locked
  },
  masteryIconLockedText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    marginRight: 16,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  profileInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  role: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    gap: 4,
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  tabBarScroll: {
    flexGrow: 0,
    backgroundColor: '#fff',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: '#0ea5e9',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#0ea5e9',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'transparent',
  },
  badgeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fefce8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'transparent',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 12,
    fontWeight: '500',
  },
  section: {
    backgroundColor: 'transparent',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 12,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderRadius: 12,
    marginBottom: 4,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  footerText: {
    textAlign: 'center',
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 20,
  },
  addLogBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  addLogBtnInlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 2,
  },
  diveNumBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  diveNumText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
  },
  logCardFooter: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 12,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logMetaText: {
    fontSize: 12,
    color: '#64748b',
  },
  addLogBtnFab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  guestIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  guestText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  loginBtn: {
    backgroundColor: '#0ea5e9',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupBtn: {
    backgroundColor: '#fff',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  signupBtnText: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  creatureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  creatureSmallCard: {
    width: (width - 40 - 24) / 3,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  creatureSmallThumb: {
    width: '100%',
    aspectRatio: 1,
  },
  creatureSmallInfo: {
    padding: 8,
  },
  creatureSmallName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
  },
  masteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  masteryInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  masteryPointArea: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pointRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  pointRowThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  pointRowInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pointRowName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  pointRowArea: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  contributionText: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
    marginLeft: 12,
    fontWeight: '700',
  },
});
