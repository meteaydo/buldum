import { useState, useEffect } from 'react';

const VERSION_URL = '/version.md';
const STORAGE_KEY = 'app_version';
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 dakika

export const useVersionCheck = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const checkForUpdates = async () => {
    try {
      // Önbelleği kırmak için timestamp ekliyoruz
      const response = await fetch(`${VERSION_URL}?t=${new Date().getTime()}`, {
        cache: 'no-store',
      });
      
      if (!response.ok) return;

      const latestVersion = (await response.text()).trim();
      const currentVersion = localStorage.getItem(STORAGE_KEY);

      if (!currentVersion) {
        // İlk yüklemede mevcut versiyonu kaydet ama güncelleniyor ekranı çıkarma
        localStorage.setItem(STORAGE_KEY, latestVersion);
        return;
      }

      if (latestVersion !== currentVersion) {
        // Versiyon değişmiş, güncelleme ekranını göster ve sayfayı yenile
        setIsUpdating(true);
        localStorage.setItem(STORAGE_KEY, latestVersion);
        
        // Kullanıcının splash screen'i görebilmesi için kısa bir bekleme
        setTimeout(() => {
          // PWA cache'lerini temizle (Service Worker'a update fırsatı vermek için)
          if ('caches' in window) {
            caches.keys().then(names => {
              for (const name of names) {
                caches.delete(name);
              }
            });
          }
          
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error('Versiyon kontrolü sırasında hata:', error);
    }
  };

  useEffect(() => {
    // İlk yüklemede kontrol et
    checkForUpdates();

    // Periyodik olarak kontrol et
    const intervalId = setInterval(checkForUpdates, CHECK_INTERVAL_MS);

    // Sekme tekrar aktif olduğunda kontrol et (visibility change)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { isUpdating };
};
