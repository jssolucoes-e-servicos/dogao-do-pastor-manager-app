import PostHog from 'posthog-react-native';

export const posthog = new PostHog(
  process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN || '',
  {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    disabled: !process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN,
  }
);
