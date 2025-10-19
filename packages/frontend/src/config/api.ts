export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

import { auth } from '../firebase';

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});

  // Try Firebase ID token first
  const token = await auth.currentUser?.getIdToken();

  // Dev bypass support via env var, if no Firebase token
  const devBypass = import.meta.env.VITE_DEV_BEARER_TOKEN as string | undefined;

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (devBypass) {
    headers.set('Authorization', `Bearer ${devBypass}`);
  }

  return fetch(input, { ...init, headers });
}
