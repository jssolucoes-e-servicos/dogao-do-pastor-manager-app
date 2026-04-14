import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence, withDelay,
} from 'react-native-reanimated';

type ToastType = 'error' | 'success' | 'info';

type Props = {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
};

const COLORS: Record<ToastType, { bg: string; text: string }> = {
  error:   { bg: '#7f1d1d', text: '#fecaca' },
  success: { bg: '#14532d', text: '#bbf7d0' },
  info:    { bg: '#1e3a5f', text: '#bfdbfe' },
};

export function Toast({ message, type = 'error', visible, onHide, duration = 3000 }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-8);

  useEffect(() => {
    if (!visible) return;
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(duration, withTiming(0, { duration: 300 })),
    );
    translateY.value = withSequence(
      withTiming(0, { duration: 200 }),
      withDelay(duration, withTiming(-8, { duration: 300 })),
    );
    const timer = setTimeout(onHide, duration + 500);
    return () => clearTimeout(timer);
  }, [visible, message]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  const colors = COLORS[type];

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 999,
  },
  text: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
