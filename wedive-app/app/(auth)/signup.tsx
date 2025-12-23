import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, Modal } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useRouter, Link } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../src/firebase';
import { Mail, Lock, User as UserIcon, Check } from 'lucide-react-native';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    const trimmedEmail = email.trim();

    if (!name || !trimmedEmail || !password) {
      setError('すべての項目を入力してください');
      return;
    }

    if (!trimmedEmail.includes('@')) {
      setError('有効なメールアドレスを入力してください');
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. Create User
      const userCredential = await createUserWithEmailAndPassword(auth as any, trimmedEmail, password);
      const user = userCredential.user;

      // 2. Update Profile Name
      await updateProfile(user, { displayName: name });

      // 3. Create Firestore Document
      await setDoc(doc(db as any, 'users', user.uid), {
        id: user.uid,
        name: name,
        email: trimmedEmail,
        role: 'user',
        status: 'active', // Added for Web compatibility
        isTermsAgreed: true,
        agreedAt: new Date().toISOString(),
        agreedTermsVersion: '1.0.0',
        trustScore: 0,
        logs: [],
        favorites: {
          points: [],
          areas: [],
          shops: [],
          gear: { tanks: [] }
        },
        favoriteCreatureIds: [],
        wanted: [],
        bookmarkedPointIds: [],
        createdAt: serverTimestamp(),
      });

      router.replace('/(tabs)/mypage');
    } catch (err: any) {
      console.error("Signup Error:", err);
      Alert.alert(
        "Signup Error Debug",
        `Code: ${err.code}\nMessage: ${err.message}\nEmail: ${trimmedEmail}`
      );

      let msg = '登録に失敗しました';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'このメールアドレスは既に使用されています';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'メールアドレスの形式が正しくありません';
      } else if (err.code === 'auth/weak-password') {
        msg = 'パスワードが弱すぎます';
      } else if (err.code === 'auth/missing-email') {
        msg = 'メールアドレスを入力してください';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>アカウント作成</Text>
            <Text style={styles.subtitle}>WeDiveへようこそ！ダイビングライフを記録しましょう</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <UserIcon size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="ユーザー名"
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Mail size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="メールアドレス"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Lock size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="パスワード (6文字以上)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.agreementContainer}>
              <TouchableOpacity
                style={[styles.checkbox, agreed && styles.checkboxActive]}
                onPress={() => setAgreed(!agreed)}
                activeOpacity={0.7}
              >
                {agreed && <Check size={14} color="#fff" />}
              </TouchableOpacity>
              <View style={styles.agreementTextContainer}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => setTermsVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.linkText}>利用規約</Text>
                  </TouchableOpacity>
                  <Text style={styles.agreementText}> と </Text>
                  <TouchableOpacity
                    onPress={() => setPrivacyVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.linkText}>プライバシーポリシー</Text>
                  </TouchableOpacity>
                  <Text style={styles.agreementText}>に同意します</Text>
                </View>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.signupBtn, (!agreed || isLoading) && styles.signupBtnDisabled]}
              onPress={handleSignup}
              disabled={isLoading || !agreed}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.signupBtnText}>同意して登録する</Text>
                  <Check size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>すでにアカウントをお持ちですか？</Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>ログイン</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>

      </KeyboardAvoidingView>

      {/* 利用規約モーダル */}
      <Modal visible={termsVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>利用規約</Text>
            <TouchableOpacity onPress={() => setTermsVisible(false)}>
              <Text style={styles.closeText}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalText}>
              <Text style={{ fontWeight: 'bold' }}>最終更新日: 2025年12月13日</Text>{'\n\n'}

              <Text style={{ fontWeight: 'bold' }}>第1条（適用）</Text>{'\n'}
              本規約は、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。{'\n\n'}

              <Text style={{ fontWeight: 'bold' }}>第2条（利用登録）</Text>{'\n'}
              登録希望者が当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。{'\n\n'}

              <Text style={{ fontWeight: 'bold' }}>第3条（禁止事項）</Text>{'\n'}
              ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。{'\n'}
              ・法令または公序良俗に違反する行為{'\n'}
              ・犯罪行為に関連する行為{'\n'}
              ・本サービスの内容等、本サービスに含まれる著作権、商標権ほか知的財産権を侵害する行為{'\n'}
              ・他人の個人情報などを不正に収集したり蓄積したりする行為{'\n\n'}

              <Text style={{ fontWeight: 'bold' }}>第4条（本サービスの提供の停止等）</Text>{'\n'}
              当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。{'\n\n'}

              <Text style={{ fontWeight: 'bold' }}>第5条（免責事項）</Text>{'\n'}
              当社の債務不履行責任は、当社の故意または重過失によらない場合には免責されるものとします。
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* プライバシーポリシーモーダル */}
      <Modal visible={privacyVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>プライバシーポリシー</Text>
            <TouchableOpacity onPress={() => setPrivacyVisible(false)}>
              <Text style={styles.closeText}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalText}>
              <Text style={{ fontWeight: 'bold' }}>最終更新日: 2025年12月13日</Text>{'\n\n'}

              <Text style={{ fontWeight: 'bold' }}>1. 個人情報の収集</Text>{'\n'}
              当アプリでは、Googleアカウントを使用したログイン時に、メールアドレス、プロフィール名、アイコン画像を取得します。また、ユーザーがアップロードしたダイビングログデータ（位置情報、写真、深度データ等）をサーバーに保存します。{'\n\n'}

              <Text style={{ fontWeight: 'bold' }}>2. 利用目的</Text>{'\n'}
              収集した情報は、以下の目的で利用します。{'\n'}
              ・本サービスの提供・運営のため{'\n'}
              ・ユーザーからのお問い合わせに回答するため{'\n'}
              ・重要なお知らせなど必要に応じたご連絡のため{'\n\n'}

              <Text style={{ fontWeight: 'bold' }}>3. 第三者への提供</Text>{'\n'}
              当社は、法令に基づく場合を除き、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。{'\n\n'}

              <Text style={{ fontWeight: 'bold' }}>4. データの保護</Text>{'\n'}
              ユーザーのデータは、適切に管理されたデータベース（Google Cloud Platform / Firebase）に保存され、セキュリティ対策を講じています。{'\n\n'}

              <Text style={{ fontWeight: 'bold' }}>5. お問い合わせ</Text>{'\n'}
              本ポリシーに関するお問い合わせは、運営者までご連絡ください。
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  signupBtn: {
    backgroundColor: '#0f172a',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  signupBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  footerText: {
    color: '#64748b',
    fontSize: 14,
  },
  linkText: {
    color: '#0ea5e9',
    fontWeight: 'bold',
    fontSize: 14,
  },
  agreementContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 16,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#94a3b8',
    marginRight: 10,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  agreementTextContainer: {
    flex: 1,
  },
  agreementText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
  },
  signupBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.7,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeText: {
    color: '#0ea5e9',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  modalText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 24,
    marginBottom: 40,
  },
});
