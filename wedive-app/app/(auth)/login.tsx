import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useRouter, Link } from 'expo-router';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, db } from '../../src/firebase';
import { Mail, Lock, ArrowRight } from 'lucide-react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';


export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: '1066677586396-1avhn8hbahfrc1kmv9rbefi3toacjqn3.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      const idToken = userInfo.data?.idToken;
      if (!idToken) throw new Error('ID Token not found');

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      router.replace('/(tabs)/mypage');
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // play services not available or outdated
        setError('Google Play Servicesが利用できません');
      } else {
        console.error("Google Sign-In Error:", error);
        setError('Googleログインに失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    if (!trimmedEmail.includes('@')) {
      setError('有効なメールアドレスを入力してください');
      return;
    }

    setIsLoading(true);
    setError('');

    console.log("Attempting login with:", trimmedEmail);

    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      console.log("Login successful");
      router.replace('/(tabs)/mypage');
    } catch (err: any) {
      console.error("Login Error:", err.code, err.message);

      let msg = 'ログインに失敗しました';
      if (err.code === 'auth/invalid-email') {
        msg = 'メールアドレスの形式が正しくありません';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'ユーザーが見つかりません';
      } else if (err.code === 'auth/wrong-password') {
        msg = 'パスワードが間違っています';
      } else if (err.code === 'auth/invalid-credential') {
        msg = 'メールアドレスまたはパスワードが間違っています';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>WeDive</Text>
          </View>
          <Text style={styles.title}>おかえりなさい</Text>
          <Text style={styles.subtitle}>ログを記録して、ダイビングライフをもっと豊かに</Text>
        </View>

        <View style={styles.form}>
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
              placeholder="パスワード"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={styles.forgotPasswordText}>パスワードをお忘れですか？</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                <Text style={styles.loginBtnText}>ログイン</Text>
                <ArrowRight size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>または</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            disabled={isLoading}
          >
            {/* Google Icon SVG or Image here if available, using text for now */}
            <Text style={styles.googleBtnText}>Googleでログイン</Text>
          </TouchableOpacity>


          <View style={styles.footer}>
            <Text style={styles.footerText}>アカウントをお持ちではありませんか？</Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>新規登録</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  logoContainer: {
    marginBottom: 20,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0ea5e9',
    letterSpacing: -1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
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
    color: '#1e293b',
    height: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  loginBtn: {
    backgroundColor: '#0ea5e9',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0ea5e9',
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
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#94a3b8',
    fontSize: 14,
  },
  googleBtn: {
    backgroundColor: '#fff',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
  },
  googleBtnText: {
    color: '#1e293b',
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: '#0ea5e9',
    fontSize: 14,
    fontWeight: '600',
  },
});
