// src/lib/notifications.ts

import { Platform } from 'react-native';
import { api } from './api';
import { INotificationPreferences } from '@/interfaces';

export async function registerPushToken(): Promise<string | null> {
  // Notificações push não funcionam no Expo Go (SDK 53+)
  // Só funciona em builds nativos — falha silenciosa aqui
  return null;
}

export async function getNotificationPreferences(): Promise<INotificationPreferences> {
  return api.get<INotificationPreferences>('/notifications/preferences');
}

export async function updateINotificationPreferences(
  prefs: Partial<INotificationPreferences>,
): Promise<INotificationPreferences> {
  return api.post<INotificationPreferences>('/notifications/preferences', prefs);
}
