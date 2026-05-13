import { useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, runOnJS,
} from 'react-native-reanimated';
import { useAudioPlayer } from 'expo-audio';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { LogoHotdog } from '@/components/logo-hotdog';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from '@/lib/posthog';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

function SplashOverlay({ onDone }: { onDone: () => void }) {
  const opacity = useSharedValue(1);
  const player = useAudioPlayer(require('@/assets/audio/vignette.mp3'));

  useEffect(() => {
    player.play();
    opacity.value = withDelay(1200, withTiming(0, { duration: 500 }, (finished) => {
      if (finished) runOnJS(onDone)();
    }));
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.splash, style]} pointerEvents="none">
      <LogoHotdog size={180} />
    </Animated.View>
  );
}

function NavigationGuard({ onAuthReady }: { onAuthReady: () => void }) {
  const { token, ready } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;
    onAuthReady();
    const inAuth = segments[0] === '(auth)';
    if (!token && !inAuth) router.replace('/(auth)/login');
    else if (token && inAuth) router.replace('/(drawer)');
  }, [token, ready, segments]);

  return null;
}

function UpdateMonitor() {
  // Expo Updates não é suportado no Web ou em modo Dev sem configuração
  if (Platform.OS === 'web' || typeof Updates.useUpdateEvents !== 'function') return null;

  const { event } = Updates.useUpdateEvents();

  useEffect(() => {
    if (event?.type === Updates.UpdateEventType.UPDATE_AVAILABLE) {
      // O download começa automaticamente em segundo plano (configurado no app.json)
      // Aqui apenas avisamos que está disponível
    }
    
    if (event?.type === Updates.UpdateEventType.UPDATE_DOWNLOADED) {
      Alert.alert(
        '🚀 Nova Versão!',
        'Uma atualização foi baixada. Deseja reiniciar o app agora para aplicar as mudanças?',
        [
          { text: 'Depois', style: 'cancel' },
          { text: 'Reiniciar Agora', onPress: () => Updates.reloadAsync() }
        ]
      );
    }
    
    if (event?.type === Updates.UpdateEventType.UPDATE_ERROR) {
      console.error('Erro ao baixar atualização:', event.message);
    }
  }, [event]);

  return null;
}

function AppShell() {
  const { colors } = useTheme();
  const showSplash = useSharedValue(true);

  return (
    <>
      <StatusBar style={colors.isDark ? 'light' : 'light'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(drawer)" />
        <Stack.Screen name="new-sale" options={{ presentation: 'modal' }} />
      </Stack>
      <UpdateMonitor />
      <NavigationGuard onAuthReady={() => { showSplash.value = false; }} />
      <SplashOverlay onDone={() => { showSplash.value = false; }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <PostHogProvider client={posthog}>
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
}

const styles = StyleSheet.create({
  splash: { backgroundColor: '#ea580c', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
});
