import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutGrid,
  X,
  Delete,
} from 'lucide-react';
import { useStudentStore } from '../store/studentStore';
import { useTeacherStore } from '../store/teacherStore';
import type { DaySchedule } from '../store/teacherStore';
import type { StudentInfo } from '../store/classStore';
import StudentCard from '../components/StudentCard';
import TeacherCard from '../components/TeacherCard';
import VirtualKeyboard from '../components/VirtualKeyboard';
import type { ZoomedTeacherData } from '../components/TeacherCard';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import './SpotlightPage.css';

/** Mevcut konteyner boyutuna ve sonuç sayısına göre
 * en büyük kare kartı veren optimal düzeni hesaplar.
 */
function computeOptimalLayout(
  containerWidth: number,
  containerHeight: number,
  resultCount: number,
  gap: number
): { cols: number; cardSize: number } {
  if (resultCount === 0) return { cols: 1, cardSize: 0 };

  let bestCols = 1;
  let bestCardSize = 0;

  for (let cols = 1; cols <= resultCount; cols++) {
    const rows = Math.ceil(resultCount / cols);
    const cardW = (containerWidth - gap * (cols - 1)) / cols;
    const cardH = (containerHeight - gap * (rows - 1)) / rows;
    const cardSize = Math.min(cardW, cardH);

    if (cardSize > bestCardSize) {
      bestCardSize = cardSize;
      bestCols = cols;
    }
  }

  // Sonuç sayısına göre maksimum kart boyutunu ayarla
  const maxCardSize = resultCount === 1
    ? Math.min(containerWidth * 0.6, 280)
    : Math.min(containerWidth * 0.45, 200);
  return { cols: bestCols, cardSize: Math.min(bestCardSize, maxCardSize) };
}

/** Spotlight için birleşik sonuç tipi */
interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'class' | 'student' | 'teacher';
  photoUrl?: string | null;
  className?: string; // Öğrenci için sınıf bilgisi
  studentNo?: string; // Öğrenci için numara bilgisi
  /** Öğretmen sonucu için haftalık program verisi */
  weekSchedule?: Record<string, DaySchedule>;
}


export default function SpotlightPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [optimalLayout, setOptimalLayout] = useState({ cols: 1, cardSize: 120 });
  const [zoomedStudent, setZoomedStudent] = useState<StudentInfo | null>(null);
  const [zoomedTeacher, setZoomedTeacher] = useState<ZoomedTeacherData | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resultsAreaRef = useRef<HTMLDivElement>(null);
  const GAP_PX = 16;
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const navigate = useNavigate();
  const { allStudents, classNames } = useStudentStore();
  const { teacherNames, scheduleData } = useTeacherStore();
  const { deferredPrompt, promptInstall, isIOS, isStandalone } = useInstallPrompt();

  const showInstallBanner = query.trim().length === 0 && (deferredPrompt || (isIOS && !isStandalone));

  /** Store verileri + arama sorgusuyla filtrelenmiş sonuçlar */
  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }

    const normalizeForSearch = (str: string) => {
      return str
        .toLocaleLowerCase('tr-TR')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/q/g, 'k')
        .replace(/w/g, 'v');
    };

    const searchKey = normalizeForSearch(query.trim());

    const isPureNumeric = /^\d+$/.test(searchKey);
    const isGradeOnly = ['9', '10', '11', '12'].includes(searchKey);
    const isShortNumeric = isPureNumeric && searchKey.length < 3;

    const studentResults: SearchResult[] = allStudents
      .filter((s) => {
        // Kural 1: Sadece sınıf seviyesi (9,10,11,12) yazıldığında öğrencileri gösterme
        if (isGradeOnly) return false;

        // Kural 1.5: Sınıf adı formatı ("9 e", "9e", "9/a", "a 9" vb. -> 1-2 rakam ve 1 harf)
        // yazıldığında öğrenci araması yapma, sadece sınıf kartı çıksın.
        // Rakamla birlikte isim aramak için harf kısmının en az 2 karakter olması gerekir.
        const isClassLikeQuery = /^\d{1,2}[/\-\s]*[a-zğüşiöç]$/.test(searchKey) || /^[a-zğüşiöç][/\-\s]*\d{1,2}$/.test(searchKey);
        if (isClassLikeQuery) return false;

        // İsimdeki tüm kelimeleri ayır ve normalize et
        const normalizedName = normalizeForSearch(s.name);
        const nameParts = normalizedName.split(/\s+/);
        const searchParts = searchKey.split(/\s+/);

        // Kural 2: Sadece rakamla aramalarda (isShortNumeric) kısa numaraları dahil etme.
        // Bunun dışında öğrenci no ve sınıf adını da aranabilir kelimeler (token) arasına ekliyoruz.
        const studentTokens = [
          ...nameParts,
          normalizeForSearch(s.className)
        ];
        
        if (!isShortNumeric) {
          studentTokens.push(s.studentNo);
        }

        // Arama metnindeki HER kelimenin, öğrencinin bilgilerinden (isim, sınıf, no) EN AZ BİRİ ile eşleşmesi gerekir
        const isMatch = searchParts.every(searchPart =>
          studentTokens.some(token => token.startsWith(searchPart))
        );

        return isMatch;
      })
      .map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: `${s.className} – ${s.studentNo}`,
        type: 'student' as const,
        photoUrl: s.photoUrl,
        className: s.className,
        studentNo: s.studentNo,
      }));

    const classResults: SearchResult[] = classNames
      .filter((c) => {
        const normalizedC = normalizeForSearch(c);
        return normalizedC.startsWith(searchKey);
      })
      .map((c) => ({
        id: c,
        title: `${c} SINIFI`,
        subtitle: 'OTURMA DÜZENİ',
        type: 'class' as const,
      }));

    // Öğretmen arama — ad prefix eşleştirmesi
    const teacherResults: SearchResult[] = teacherNames
      .filter((name) => {
        const normalizedName = normalizeForSearch(name);
        const nameParts = normalizedName.split(/\s+/);
        const searchParts = searchKey.split(/\s+/);

        // Arama metnindeki her kelimenin, öğretmen adının kelimelerinden en az birinin başıyla eşleşmesi gerekir
        return searchParts.every(searchPart =>
          nameParts.some(namePart => namePart.startsWith(searchPart))
        );
      })
      .map((name) => ({
        id: `teacher-${name}`,
        title: name,
        subtitle: '',
        type: 'teacher' as const,
        weekSchedule: scheduleData?.ogretmenler[name],
      }));

    // Sıralama: Sınıflar → Öğretmenler → Öğrenciler
    setResults([...classResults, ...teacherResults, ...studentResults]);
  }, [query, allStudents, classNames, teacherNames, scheduleData]);

  /** Konteyner boyutu veya sonuç sayısı değiştiğinde düzeni yeniden hesapla */
  const recalcLayout = useCallback(() => {
    requestAnimationFrame(() => {
      if (!resultsAreaRef.current || results.length === 0) return;
      const rect = resultsAreaRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      setOptimalLayout(
        computeOptimalLayout(rect.width, rect.height, results.length, GAP_PX)
      );
    });
  }, [results.length, GAP_PX]);

  useEffect(() => {
    recalcLayout();
    const observer = new ResizeObserver(recalcLayout);
    if (resultsAreaRef.current) observer.observe(resultsAreaRef.current);
    return () => observer.disconnect();
  }, [recalcLayout]);

  /** Dışarıya tıklayınca arama panelini ve büyümüş kartı kapat */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      
      // Arama inputu wrapper'ı
      const isOutsideSearch = wrapperRef.current && !wrapperRef.current.contains(target);
      // Sonuç kartlarının olduğu grid alanı
      const isOutsideResults = resultsAreaRef.current && !resultsAreaRef.current.contains(target);
      // Büyüyen kart overlay'i
      const isOverlay = (target as Element).closest?.('.card-zoom-overlay');

      if (!isOverlay && isOutsideSearch && isOutsideResults) {
        setIsFocused(false);
      }
      // Not: setZoomedStudentId(null) işlemini artık direkt overlay'in onClick'i hallediyor.
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSelect = (item: SearchResult) => {
    if (item.type === 'class') {
      navigate(`/class/${item.id}`);
    }
    // Öğrenci tıklaması StudentCard'daki onZoom ile yönetilir
  };

  /** StudentCard'daki onZoom callback'ı */
  const handleStudentZoom = (student: StudentInfo) => {
    setZoomedStudent(prev => prev?.id === student.id ? null : student);
  };

  /** TeacherCard'daki onZoom callback'ı */
  const handleTeacherZoom = (data: ZoomedTeacherData) => {
    setZoomedTeacher(prev => prev?.name === data.name ? null : data);
  };

  const handleVirtualKeyPress = (key: string) => {
    setQuery(prev => prev + key);
  };
  
  const handleVirtualBackspace = () => {
    setQuery(prev => prev.slice(0, -1));
  };



  return (
    <div className="spotlight-layout">
      {/* PWA Yükleme Banner'ı */}
      {showInstallBanner && (
        <div className="install-prompt-banner">
          <img src="/elephentlogo.png" alt="Logo" className="install-logo-small" />
          <div className="install-text-col">
            <h4>BulGetir'i İndir</h4>
            {isIOS && !deferredPrompt ? (
              <p>Alt menüden <span style={{fontWeight: 600}}>Paylaş</span>'a ve ardından <span style={{fontWeight: 600}}>Ana Ekrana Ekle</span>'ye dokunun</p>
            ) : (
              <p>Hızlı erişim için ana ekrana ekle</p>
            )}
          </div>
          {deferredPrompt && (
            <button onClick={promptInstall} className="btn-install">
              Ekle
            </button>
          )}
        </div>
      )}

      {/* Bağımsız Logo (Animasyonlu) */}
      <div className={`logo-container ${query.trim().length > 0 ? 'logo-top-left' : 'logo-center'}`}>
        <img src="/elephentlogo.png" alt="Logo" className="header-logo-img" />
      </div>

      {/* Üst Menü */}
      <header className="header">
        {/* Logo artık absolute olarak spotlight-layout içinde yönetiliyor */}
      </header>

      {/* Spotlight Alanı */}
      <main className="spotlight-main">
        {/* Sonuçların gösterileceği alan (Üstte) */}
        <div
          ref={resultsAreaRef}
          className="dynamic-results-area"
          style={{
            gridTemplateColumns: `repeat(${optimalLayout.cols}, ${optimalLayout.cardSize}px)`,
            gap: `${GAP_PX}px`,
          }}
        >
          {isFocused && query.trim().length > 0 && results.length === 0 && (
            <div className="no-results" key={query}>
              {"Sonuç bulunamadı.".split("").map((char, index) => (
                <span key={index} style={{ animationDelay: `${index * 0.025}s` }}>
                  {char === " " ? "\u00A0" : char}
                </span>
              ))}
            </div>
          )}

          {isFocused &&
            query.trim().length > 0 &&
            results.length > 0 &&
            results.map((item) => {
              if (item.type === 'class') {
                return (
                  <div
                    key={item.id}
                    className="dynamic-result-card result-type-class"
                    style={{
                      width: optimalLayout.cardSize,
                      height: optimalLayout.cardSize,
                    }}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="result-icon">
                      <LayoutGrid size={32} />
                    </div>
                    <div className="result-content">
                      <div className="result-title-line">
                        <span className="result-title">{item.title}</span>
                      </div>
                      <div className="result-subtitle-line">
                        <span className="result-subtitle">{item.subtitle}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (item.type === 'teacher' && item.weekSchedule) {
                return (
                  <TeacherCard
                    key={item.id}
                    teacherName={item.title}
                    weekSchedule={item.weekSchedule}
                    size={optimalLayout.cardSize}
                    onZoom={handleTeacherZoom}
                  />
                );
              }

              // student
              return (
                <StudentCard
                  key={item.id}
                  student={{
                    id: item.studentNo || item.id,
                    name: item.title,
                    className: item.className || '',
                    studentNo: item.studentNo || '',
                    photoUrl: item.photoUrl || null,
                    deskId: null,
                  }}
                  size={optimalLayout.cardSize}
                  onZoom={handleStudentZoom}
                />
              );
            })}
        </div>

        {/* Arama Kutusu (Altta) */}
        <div className="search-section" ref={wrapperRef}>
          <div className="search-input-wrapper">
            <Search className="search-icon" size={24} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              placeholder="Kişi ya da sınıf arayın..."
              className="search-input"
              inputMode={isTouchDevice ? "none" : "text"}
              autoFocus
            />
            {query.length > 0 && (
              <button
                className="input-backspace-btn"
                onClick={(e) => {
                  e.preventDefault();
                  handleVirtualBackspace();
                }}
                type="button"
              >
                <Delete size={20} />
              </button>
            )}
          </div>
          
          <VirtualKeyboard 
            isVisible={isFocused} 
            onKeyPress={handleVirtualKeyPress}
            onBackspace={handleVirtualBackspace}
            onClose={() => {
              setIsFocused(false);
              // Input'tan focus'u çek ki cursor kaybolsun
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
            }}
          />

          <div className="bottom-info-row">
            {(allStudents.length > 0 || teacherNames.length > 0) && (
              <span className="student-count-hint">
                {allStudents.length} öğrenci · {classNames.length} sınıf · {teacherNames.length} öğretmen
              </span>
            )}
            <span className="app-version-hint">
              v{localStorage.getItem('app_version') || '1.0.0'}
            </span>
          </div>
        </div>
      </main>

      {/* Öğrenci Zoom Overlay */}
      {zoomedStudent && createPortal(
        <div className="card-zoom-overlay" onClick={() => setZoomedStudent(null)}>
          <div className="is-zoomed-center student-card" onClick={e => e.stopPropagation()}>
            <button className="btn-zoom-close" onClick={() => setZoomedStudent(null)}>
              <X className="zoom-close-icon" strokeWidth={2.5} />
            </button>
            <div className="student-photo">
              {zoomedStudent.photoUrl ? (
                <img src={zoomedStudent.photoUrl} alt={zoomedStudent.name} draggable="false" />
              ) : (
                <span style={{ fontSize: '3rem', color: '#9ca3af' }}>👤</span>
              )}
            </div>
            <div className="student-info">
              <span className="student-name">{zoomedStudent.name}</span>
              <span className="student-no">{zoomedStudent.className} – {zoomedStudent.studentNo}</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Öğretmen Zoom Overlay */}
      {zoomedTeacher && createPortal(
        <div className="card-zoom-overlay" onClick={() => setZoomedTeacher(null)}>
          <div className="is-zoomed-center teacher-zoom-card" onClick={e => e.stopPropagation()}>
            <button className="btn-zoom-close" onClick={() => setZoomedTeacher(null)}>
              <X className="zoom-close-icon" strokeWidth={2.5} />
            </button>
            <TeacherCard
              teacherName={zoomedTeacher.name}
              weekSchedule={zoomedTeacher.weekSchedule}
            />
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
