import React, { useState } from 'react';
import { StyleSheet, Modal, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { Text, View } from './Themed';
import { useAuth } from '../src/context/AuthContext';
import { Shield, ChevronRight, Check } from 'lucide-react-native';
import { CURRENT_TERMS_VERSION } from '../src/constants';
import { usePathname } from 'expo-router';

export const TermsAgreementModal = () => {
  const { user, updateUser, isAuthenticated, signOut, deleteAccount, isLoading: isAuthLoading } = useAuth();
  const pathname = usePathname();
  const [agreed, setAgreed] = useState(false);
  const [confirmMode, setConfirmMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);

  // Check if user has agreed to the CURRENT version
  const hasAgreedToLatest = user?.agreedTermsVersion === CURRENT_TERMS_VERSION;

  // Do not show if:
  // 1. Still loading auth state
  // 2. Not authenticated (Guest)
  // 3. User is effectively a guest ('guest' ID)
  // 4. Already agreed to latest
  // 5. On unprotected public pages (Home, Search, AI)
  // 6. On auth pages (Signup/Login)
  const isPublicPage = pathname === '/' || pathname === '/search' || pathname === '/ai' || pathname.startsWith('/(auth)');

  if (isAuthLoading || !isAuthenticated || !user || user.id === 'guest' || hasAgreedToLatest || isPublicPage) return null;

  // Detect if "New User" flow or "Update" flow
  const isNewUser = user.status === 'provisional' || (!user.status && !!user.createdAt && !user.agreedTermsVersion);

  const handleAgree = async () => {
    if (!agreed) return;
    setIsSyncing(true);
    try {
      await updateUser({
        isTermsAgreed: true,
        agreedAt: new Date().toISOString(),
        agreedTermsVersion: CURRENT_TERMS_VERSION,
        status: 'active'
      });
    } catch (e) {
      console.error('Failed to agree terms', e);
      Alert.alert('エラー', '手続きに失敗しました。通信環境を確認して再度お試しください。');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExecuteDisagree = async () => {
    setIsSyncing(true);
    try {
      if (isNewUser) {
        await signOut();
      } else {
        await deleteAccount();
      }
    } catch (e) {
      console.error("Disagree action failed", e);
      Alert.alert('エラー', '処理に失敗しました。');
      setIsSyncing(false);
      setConfirmMode(false);
    }
  };

  return (
    <Modal visible={true} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {confirmMode ? (
            <View style={styles.confirmContent}>
              <Text style={styles.confirmTitle}>
                {isNewUser ? '利用を中止しますか？' : '退会しますか？'}
              </Text>
              <Text style={styles.confirmMessage}>
                {isNewUser
                  ? '利用規約に同意いただけない場合、WeDiveをご利用いただけません。ログアウトしてもよろしいですか？'
                  : '最新の利用規約に同意いただけない場合、サービスの継続利用ができません。退会すると全てのデータが削除されます。本当によろしいですか？'}
              </Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setConfirmMode(false)}
                  disabled={isSyncing}
                >
                  <Text style={styles.cancelBtnText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.executeBtn}
                  onPress={handleExecuteDisagree}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.executeBtnText}>
                      {isNewUser ? 'ログアウト' : '退会する'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Shield size={48} color="#0ea5e9" style={styles.icon} />
                <Text style={styles.title}>{isNewUser ? 'WeDiveへようこそ' : '利用規約の更新'}</Text>
                <Text style={styles.subtitle}>
                  {isNewUser
                    ? 'サービスをご利用いただくには、以下の内容への同意が必要です。'
                    : 'サービスを引き続きご利用いただくには、最新の規約への同意が必要です。'}
                </Text>
              </View>

              <View style={styles.links}>
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => setTermsVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkText}>利用規約を確認</Text>
                  <ChevronRight size={20} color="#94a3b8" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => setPrivacyVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkText}>プライバシーポリシーを確認</Text>
                  <ChevronRight size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAgreed(!agreed)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                  {agreed && <Check size={14} color="#fff" />}
                </View>
                <Text style={styles.checkboxLabel}>上記の内容を確認し、同意します</Text>
              </TouchableOpacity>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.agreeBtn, (!agreed || isSyncing) && styles.agreeBtnDisabled]}
                  onPress={handleAgree}
                  disabled={!agreed || isSyncing}
                >
                  {isSyncing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.agreeBtnText}>
                      {isNewUser ? '同意して登録' : '同意して続ける'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.disagreeBtn}
                  onPress={() => setConfirmMode(true)}
                  disabled={isSyncing}
                >
                  <Text style={styles.disagreeBtnText}>
                    {isNewUser ? '同意せずログアウト' : '同意せず退会する'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* 詳細表示用サブモーダル */}
        <Modal visible={termsVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.subModalContainer}>
            <View style={styles.subModalHeader}>
              <Text style={styles.subModalTitle}>利用規約</Text>
              <TouchableOpacity onPress={() => setTermsVisible(false)}>
                <Text style={styles.closeText}>閉じる</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.subModalBody}>
              <Text style={styles.legalText}>
                <Text style={{ fontWeight: 'bold' }}>最終更新日: 2025年12月13日</Text>{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>第1条（適用）</Text>{"\n"}
                本規約は、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>第2条（利用登録）</Text>{"\n"}
                登録希望者が当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>第3条（禁止事項）</Text>{"\n"}
                ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。{"\n"}
                ・法令または公序良俗に違反する行為{"\n"}
                ・犯罪行為に関連する行為{"\n"}
                ・本サービスに含まれる知的財産権を侵害する行為{"\n"}
                ・他人の個人情報を不正に収集する行為{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>第4条（本サービスの提供の停止等）</Text>{"\n"}
                当社は、事前の通知なく本サービスの全部または一部を停止または中断できるものとします。
              </Text>
            </ScrollView>
          </View>
        </Modal>

        <Modal visible={privacyVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.subModalContainer}>
            <View style={styles.subModalHeader}>
              <Text style={styles.subModalTitle}>プライバシーポリシー</Text>
              <TouchableOpacity onPress={() => setPrivacyVisible(false)}>
                <Text style={styles.closeText}>閉じる</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.subModalBody}>
              <Text style={styles.legalText}>
                <Text style={{ fontWeight: 'bold' }}>最終更新日: 2025年12月13日</Text>{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>1. 個人情報の収集</Text>{"\n"}
                本サービスでは、ログイン時に取得する情報のほか、ユーザーがアップロードしたログデータを適切に管理します。{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>2. 利用目的</Text>{"\n"}
                サービスの提供、運営、お問い合わせへの回答に利用します。{"\n\n"}
                <Text style={{ fontWeight: 'bold' }}>3. 第三者提供の制限</Text>{"\n"}
                法令に基づく場合を除き、事前の同意なく第三者に提供することはありません。
              </Text>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  links: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 8,
    marginBottom: 24,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'transparent',
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  actions: {
    gap: 12,
    backgroundColor: 'transparent',
  },
  agreeBtn: {
    backgroundColor: '#0f172a',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agreeBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  agreeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disagreeBtn: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  disagreeBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  subModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  subModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  subModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  closeText: {
    color: '#0ea5e9',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subModalBody: {
    padding: 20,
    backgroundColor: '#fff',
  },
  legalText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 24,
  },
  confirmContent: {
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmMessage: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'transparent',
  },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  executeBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  executeBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
