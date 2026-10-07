import { useEffect } from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const KEY = 'spud.pendingTitlePath';

export async function savePendingTitle(path: string) {
  try { await SecureStore.setItemAsync(KEY, path); } catch { /* best effort */ }
}

/** After sign-in, forward to a shared title the user opened while signed out. */
export function usePendingTitleRedirect(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      try {
        const path = await SecureStore.getItemAsync(KEY);
        if (!path || !active) return;
        await SecureStore.deleteItemAsync(KEY);
        if (active && /^\/title\/(movie|show)\/\d+$/.test(path)) router.push(path as any);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [enabled]);
}
