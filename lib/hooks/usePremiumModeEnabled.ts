import { useEffect, useState } from 'react';
import { settingsStore } from '@/lib/store/settings-store';

export function usePremiumModeEnabled() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return settingsStore.getSettings().premiumModeEnabled;
  });

  useEffect(() => {
    const sync = () => {
      setEnabled(settingsStore.getSettings().premiumModeEnabled);
    };

    sync();
    return settingsStore.subscribe(sync);
  }, []);

  return enabled;
}
