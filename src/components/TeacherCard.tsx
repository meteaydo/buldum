import React from 'react';
import { GraduationCap, BookOpen, Coffee } from 'lucide-react';
import type { DaySchedule, LessonEntry } from '../store/teacherStore';
import './TeacherCard.css';

/** Türkçe gün isimleri — haftanın günlerini saptamak için */
const GUN_ISIMLERI: string[] = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi',
];

/** Zoom overlay'ında kullanılan öğretmen verisi */
export interface ZoomedTeacherData {
  name: string;
  weekSchedule: Record<string, DaySchedule>;
}

interface TeacherCardProps {
  teacherName: string;
  weekSchedule: Record<string, DaySchedule>;
  /** Kartın boyutunu dışarıdan belirlemek için (px) */
  size?: number;
  /** Kart tıklanınca zoom callback'i */
  onZoom?: (data: ZoomedTeacherData) => void;
}

/**
 * Bugünün gün adını döner (Pazartesi, Salı, vb.)
 * Hafta sonu ise null döner.
 */
function getTodayName(): string | null {
  const dayIndex = new Date().getDay(); // 0=Pazar .. 6=Cumartesi
  // Hafta sonu kontrolü
  if (dayIndex === 0 || dayIndex === 6) return null;
  return GUN_ISIMLERI[dayIndex];
}

/** Tek bir ders satırı — dolu veya boş */
interface LessonRow {
  period: string;
  lesson: LessonEntry | null;
}

/**
 * Bir günün tüm ders saatlerini (boş dahil) sıralı döner.
 */
function getAllLessons(daySchedule: DaySchedule | undefined): LessonRow[] {
  if (!daySchedule) return [];

  const sortedPeriods = Object.keys(daySchedule).sort(
    (a, b) => parseInt(a) - parseInt(b)
  );

  return sortedPeriods.map((period) => {
    const lessons = daySchedule[period];
    return {
      period,
      lesson: lessons && lessons.length > 0 ? lessons[0] : null,
    };
  });
}

/** Öğretmen adını "Title Case"e çevir (BÜYÜK HARF → İlk Harfler Büyük) */
function toDisplayName(name: string): string {
  return name
    .toLocaleLowerCase('tr-TR')
    .split(' ')
    .map((word) => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1))
    .join(' ');
}

/**
 * Spotlight arama sonuçlarında gösterilen öğretmen kartı.
 * Bugünün ders programını boş dersler dahil listeler.
 */
export default function TeacherCard({ teacherName, weekSchedule, size, onZoom }: TeacherCardProps) {
  const todayName = getTodayName();
  const todaySchedule = todayName ? weekSchedule[todayName] : undefined;
  const allLessons = getAllLessons(todaySchedule);

  const style: React.CSSProperties = {};
  if (size) {
    style.width = `${size}px`;
    style.height = `${size}px`;
  }

  const displayName = toDisplayName(teacherName);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onZoom) {
      onZoom({ name: teacherName, weekSchedule });
    }
  };

  return (
    <div
      className="dynamic-result-card result-type-teacher"
      style={style}
      onClick={handleClick}
    >
      {/* Üst kısım: İkon ve isim */}
      <div className="teacher-card-header">
        <div className="teacher-icon-wrapper">
          <GraduationCap className="teacher-icon" />
        </div>
        <span className="teacher-name">{displayName}</span>
      </div>

      {/* Ders listesi */}
      <div className="teacher-schedule-list">
        {todayName === null ? (
          <div className="teacher-no-lesson">
            <Coffee size={16} />
            <span>Hafta sonu</span>
          </div>
        ) : allLessons.length === 0 ? (
          <div className="teacher-no-lesson">
            <Coffee size={16} />
            <span>Bugün ders yok</span>
          </div>
        ) : (
          allLessons.map(({ period, lesson }) => (
            <div
              key={period}
              className={`teacher-lesson-row ${!lesson ? 'lesson-empty' : ''}`}
            >
              <span className={`lesson-period ${!lesson ? 'lesson-period-empty' : ''}`}>
                {period}
              </span>
              {lesson ? (
                <>
                  <span className="lesson-class">{lesson.sinif}</span>
                  <span className="lesson-name">
                    <BookOpen size={10} className="lesson-book-icon" />
                    {lesson.ders}
                  </span>
                </>
              ) : (
                <span className="lesson-empty-text">Boş</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Gün etiketi */}
      {todayName && (
        <div className="teacher-day-badge">
          {todayName}
        </div>
      )}
    </div>
  );
}
