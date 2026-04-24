import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import './SyncOverlay.css';

interface Props {
  isSyncing: boolean;
  message: string;
  isFirstLoad: boolean;
}

export default function SyncOverlay({ isSyncing, message, isFirstLoad }: Props) {
  const [show, setShow] = useState(isSyncing);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isSyncing) {
      setShow(true);
      setIsExiting(false);
    } else {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setShow(false);
      }, 500); // Sadece fadeOut animasyon süresi
      return () => clearTimeout(timer);
    }
  }, [isSyncing]);

  if (!show) return null;

  // SIFIRDAN YÜKLEME: Tam Ekran (Splash Screen)
  if (isFirstLoad) {
    return (
      <div className={`sync-splash-overlay ${isExiting ? 'sync-overlay-exit' : ''}`}>
        <div className="sync-splash-content">
          <div className="splash-logo">ClassApp</div>
          {isSyncing ? (
            <>
              <Loader2 size={48} className="splash-spinner" />
              <div className="splash-title">Sınıflar Hazırlanıyor</div>
              <div className="splash-message">{message || 'Excel dosyaları indiriliyor...'}</div>
            </>
          ) : (
            <>
              <CheckCircle2 size={48} color="#4ade80" />
              <div className="splash-title">Her Şey Hazır!</div>
              <div className="splash-message">Tüm veriler cihazınıza kaydedildi.</div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ARKA PLAN GÜNCELLEMESİ: Sağ Alt Toast (Glassmorphism)
  return (
    <div className={`sync-toast-container ${isExiting ? 'sync-overlay-exit' : ''}`}>
      <div className="sync-toast">
        <div className="toast-icon-wrapper">
          <Loader2 size={24} className="toast-spinner" />
        </div>
        <div className="toast-content">
          <span className="toast-title">
            Veriler Güncelleniyor
          </span>
          <span className="toast-message">
            {message}
          </span>
        </div>
      </div>
    </div>
  );
}
