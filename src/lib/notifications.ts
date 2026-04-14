import { Platform } from 'react-native';
import { api } from './api';

export type NotificationPreferences = {
  sales: boolean;
  orders: boolean;
  ranking: boolean;
  cell: boolean;
  network: boolean;
};

export async function registerPushToken(): Promise<string | null> {
  // Notificações push não funcionam no Expo Go (SDK 53+)
  // Só funciona em builds nativos — falha silenciosa aqui
  return null;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return api.get<NotificationPreferences>('/notifications/preferences');
}

export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return api.post<NotificationPreferences>('/notifications/preferences', prefs);
}
