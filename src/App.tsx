import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SpotlightPage from './pages/SpotlightPage';
import SeatingPlanPage from './pages/SeatingPlanPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import SyncOverlay from './components/SyncOverlay';
import { syncExcelFiles } from './services/excelSyncService';
import { syncTeacherSchedule } from './services/teacherSyncService';
import { useStudentStore } from './store/studentStore';
import { useTeacherStore } from './store/teacherStore';
import { useAuthStore } from './store/authStore';
import { onAuthChange } from './services/authService';
import UpdateOverlay from './components/UpdateOverlay';
import { useVersionCheck } from './hooks/useVersionCheck';
import { useImageProtection } from './hooks/useImageProtection';

function App() {
  const { isUpdating } = useVersionCheck();
  const { isBlurred } = useImageProtection();

  // Auth state
  const { isLoading: isAuthLoading, isAuthenticated, isCodeVerified, setUser, setLoading } = useAuthStore();

  // Ekran görüntüsü algılandığında resimleri bulanıklaştır
  useEffect(() => {
    if (isBlurred) {
      document.body.classList.add('image-protection-blur');
    } else {
      document.body.classList.remove('image-protection-blur');
    }
    return () => document.body.classList.remove('image-protection-blur');
  }, [isBlurred]);

  // Firebase Auth state dinleyicisi — sayfa yenilemede oturumu otomatik algılar
  useEffect(() => {
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        setUser({
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [setUser, setLoading]);

  const [syncState, setSyncState] = useState({ isSyncing: false, message: 'Sunucu ile bağlantı kuruluyor...' });
  const { allStudents, hasHydrated } = useStudentStore();
  const teacherHydrated = useTeacherStore((s) => s.hasHydrated);
  const teacherNames = useTeacherStore((s) => s.teacherNames);

  // Eğer hiç öğrenci ve öğretmen yoksa "İlk Yükleme" (Splash Screen) modundayız
  const isFirstLoad = allStudents.length === 0 && teacherNames.length === 0;

  // Her iki store'un da hydrate olmasını bekle
  const isReady = hasHydrated && teacherHydrated;

  // Sync sadece tam yetkilendirme sonrasında başlar
  useEffect(() => {
    if (!isAuthenticated || !isCodeVerified) return;

    let isMounted = true;
    
    // Uygulama yüklendikten (hydrate olduktan) sonra senkronizasyonu başlat
    setSyncState({ isSyncing: true, message: 'Sunucu ile bağlantı kuruluyor...' });

    // IndexedDB'deki verilerin silinmemesi için persist isteği
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(console.error);
    }

    const progressHandler = (msg: string) => {
      if (isMounted) {
        setSyncState({ isSyncing: true, message: msg });
      }
    };

    // Her iki sync işlemini paralel başlat, tamamlandığında overlay'i kapat
    Promise.all([
      syncExcelFiles(progressHandler),
      syncTeacherSchedule(progressHandler),
    ]).then(() => {
      if (isMounted) {
        setSyncState(prev => ({ ...prev, isSyncing: false }));
      }
    }).catch(err => {
      console.error(err);
      if (isMounted) {
        setSyncState({ isSyncing: false, message: 'Senkronizasyon hatası.' });
      }
    });

    return () => { isMounted = false; };
  }, [isReady, isAuthenticated, isCodeVerified]);

  // Auth yüklenene kadar boş ekran göster
  if (isAuthLoading) return null;

  // Giriş yapılmamış veya kod doğrulanmamış → Login sayfası
  if (!isAuthenticated || !isCodeVerified) {
    return (
      <>
        <UpdateOverlay isUpdating={isUpdating} />
        <LoginPage />
      </>
    );
  }

  // IndexedDB'den veriler okunana kadar uygulamayı render etme
  if (!isReady) return null;

  return (
    <>
      <UpdateOverlay isUpdating={isUpdating} />
      <SyncOverlay 
        isSyncing={syncState.isSyncing} 
        message={syncState.message} 
        isFirstLoad={isFirstLoad} 
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SpotlightPage />} />
          <Route path="/class/:classId" element={<SeatingPlanPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
