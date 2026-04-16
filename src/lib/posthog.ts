import PostHog from 'posthog-react-native';
import { Platform } from 'react-native';

// Na web, usa localStorage como storage para o PostHog
const webStorage = Platform.OS === 'web' ? {
  getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
  removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
} : undefined;

export const posthog = new PostHog(
  process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN || '',
  {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    disabled: !process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN,
    ...(webStorage ? { customStorage: webStorage } : {}),
  }
);
