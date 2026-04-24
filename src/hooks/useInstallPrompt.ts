import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // SSR hatasını önlemek için varsayılan true, useEffect'te false yapılabilir

  useEffect(() => {
    // Cihazın PWA olarak çalışıp çalışmadığını kontrol et
    const isPwa = window.matchMedia('(display-mode: standalone)').matches || 
                  ('standalone' in window.navigator && (window.navigator as any).standalone);
    setIsStandalone(isPwa);

    // iOS cihaz tespiti
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handler = (e: Event) => {
      // Tarayıcının varsayılan yükleme istemini engelle
      e.preventDefault();
      // Olayı daha sonra kullanmak üzere sakla
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    
    // Yükleme istemini göster
    deferredPrompt.prompt();
    
    // Kullanıcının kararını bekle
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Kullanıcı PWA yüklemesini kabul etti');
      setDeferredPrompt(null);
    } else {
      console.log('Kullanıcı PWA yüklemesini reddetti');
    }
  };

  return { deferredPrompt, promptInstall, isIOS, isStandalone };
}
