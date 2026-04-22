// src/lib/api.ts

import { storage } from './storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await storage.getItem('token');

  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message ?? `Erro ${res.status}`);
  }

  return data as T;
}

export const api = {
  post: <T>(path: string, body: unknown, headers?: HeadersInit) => {
    const isFormData = body instanceof FormData;
    return request<T>(path, {
      method: 'POST',
      body: isFormData ? (body as any) : JSON.stringify(body),
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
    });
  },

  get: <T>(path: string, headers?: HeadersInit) =>
    request<T>(path, { method: 'GET', headers }),

  patch: <T>(path: string, body: unknown, headers?: HeadersInit) => {
    const isFormData = body instanceof FormData;
    return request<T>(path, {
      method: 'PATCH',
      body: isFormData ? (body as any) : JSON.stringify(body),
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
    });
  },
};
