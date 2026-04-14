import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, withDelay, withSequence,
  Easing,
} from 'react-native-reanimated';
import { useAuth } from '@/lib/auth';
import { LogoHotdog } from '@/components/logo-hotdog';
import { Toast } from '@/components/toast';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const titleOpacity = useSharedValue(0);
  const formTranslateY = useSharedValue(40);
  const formOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withDelay(100, withSpring(1, { damping: 10, stiffness: 100 }));
    logoOpacity.value = withDelay(100, withTiming(1, { duration: 400 }));
    logoRotate.value = withDelay(700, withSequence(
      withTiming(-8, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(8, { duration: 120 }),
      withTiming(-4, { duration: 100 }),
      withTiming(4, { duration: 100 }),
      withTiming(0, { duration: 80 }),
    ));
    titleTranslateY.value = withDelay(400, withSpring(0, { damping: 14 }));
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    formTranslateY.value = withDelay(600, withSpring(0, { damping: 14 }));
    formOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }, { rotate: `${logoRotate.value}deg` }],
    opacity: logoOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: titleTranslateY.value }],
    opacity: titleOpacity.value,
  }));

  const formStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formTranslateY.value }],
    opacity: formOpacity.value,
  }));

  function showError(msg: string) {
    setError(msg);
    setToastVisible(true);
  }

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      showError('Preencha usuário e senha.');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim().toLowerCase(), password);
    } catch (e: any) {
      showError(e?.message ?? 'Usuário ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Toast
        message={error}
        type="error"
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />

      <View style={styles.inner}>
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <LogoHotdog size={200} />
        </Animated.View>

        <Animated.View style={titleStyle}>
          <Text style={styles.title}>App de Gestão</Text>
          <Text style={styles.subtitle}>Identifique-se</Text>
        </Animated.View>

        <Animated.View style={[styles.form, formStyle]}>
          <TextInput
            style={styles.input}
            placeholder="Usuário"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(v) => { setUsername(v.toLowerCase().trimStart()); setToastVisible(false); }}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={password}
            onChangeText={(v) => { setPassword(v); setToastVisible(false); }}
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#ea580c" />
              : <Text style={styles.buttonText}>Entrar</Text>
            }
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerVersion}>
          v{Constants.expoConfig?.version} (build {Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '1'})
        </Text>
        <Text style={styles.footerCredit}>Desenvolvido por JS Soluções e Serviços</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ea580c' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  logoContainer: { alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#fed7aa', textAlign: 'center', marginBottom: 20 },
  form: { gap: 12 },
  input: {
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#1f2937',
  },
  button: {
    backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  buttonText: { color: '#ea580c', fontWeight: 'bold', fontSize: 16 },
  footer: { paddingBottom: 32, alignItems: 'center', gap: 4 },
  footerVersion: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  footerCredit: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
});
