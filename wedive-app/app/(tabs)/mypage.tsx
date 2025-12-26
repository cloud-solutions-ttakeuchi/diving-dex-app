import React, { useState } from 'react';
import { StyleSheet, Pressable, ScrollView, Image, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { LogOut, ChevronRight, Bookmark, Heart, Settings, Activity, BookOpen, Grid, User as UserIcon, Award, Star, MapPin, Plus, Clock, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { DiveLog } from '../../src/types';

const { width } = Dimensions.get('window');

type TabType = 'dashboard' | 'logbook' | 'collection' | 'favorites';

export default function MyPageScreen() {
  const router = useRouter();
  const { user, logs, isLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

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
        return (
          <View style={styles.tabContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Diving Stats</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{logs.length || 0}</Text>
                  <Text style={styles.statLabel}>Total Dives</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{user.favoriteCreatureIds?.length || 0}</Text>
                  <Text style={styles.statLabel}>Creatures</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{user.bookmarkedPointIds?.length || 0}</Text>
                  <Text style={styles.statLabel}>Spots</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Badges</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badgeIcon}><Award color="#fbbf24" size={24} /></View>
                <View style={[styles.badgeIcon, { backgroundColor: '#f0fdf4' }]}><Activity color="#22c55e" size={24} /></View>
                {/* Placeholder badges */}
              </View>
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
            <View style={styles.emptyState}>
              <Grid size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>Your creature collection is empty.</Text>
            </View>
          </View>
        );
      case 'favorites':
        return (
          <View style={styles.tabContent}>
            <View style={styles.emptyState}>
              <Heart size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>Save your favorite spots and creatures.</Text>
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
              <Plus size={20} color="#0ea5e9" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn}>
              <Settings size={20} color="#64748b" />
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
              <tab.icon size={20} color={activeTab === tab.id ? '#0ea5e9' : '#94a3b8'} />
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {renderContent()}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTRIBUTION</Text>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/details/spot/add')}
          >
            <View style={styles.menuLeft}>
              <MapPin size={20} color="#0ea5e9" />
              <Text style={styles.menuLabel}>Propose a Spot</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/details/creature/add')}
          >
            <View style={styles.menuLeft}>
              <Sparkles size={20} color="#8b5cf6" />
              <Text style={styles.menuLabel}>Propose a Creature</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIVITY</Text>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/(tabs)/search?tab=spots')}
          >
            <View style={styles.menuLeft}>
              <Bookmark size={20} color="#0ea5e9" />
              <Text style={styles.menuLabel}>Bookmarked Spots</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/(tabs)/search?tab=creatures')}
          >
            <View style={styles.menuLeft}>
              <Heart size={20} color="#ef4444" />
              <Text style={styles.menuLabel}>Favorite Creatures</Text>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </Pressable>
        </View>

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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    gap: 4,
  },
  rankText: {
    fontSize: 10,
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#0ea5e9',
  },
  tabContent: {
    padding: 20,
    backgroundColor: '#f8fafc',
    minHeight: 200,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#94a3b8',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'transparent',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
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
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
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
});
