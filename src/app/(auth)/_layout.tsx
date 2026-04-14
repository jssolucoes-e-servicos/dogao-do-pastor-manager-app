import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function AuthLayout() {
  const { token, ready } = useAuth();

  if (ready && token) {
    return <Redirect href="/(drawer)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
