import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import localforage from 'localforage';

/**
 * program.json'dan gelen tek bir ders saatinin yapısı.
 * Boş ders saati → boş dizi [] olarak gelir.
 */
export interface LessonEntry {
  ders: string;
  sinif: string;
}

/** Bir öğretmenin tek bir gününün ders programı (key: "1"–"10") */
export type DaySchedule = Record<string, LessonEntry[]>;

/** Bir öğretmenin haftalık programı (key: gün adı) */
export type WeekSchedule = Record<string, DaySchedule>;

/** program.json'dan gelen tüm veri yapısı */
export interface TeacherScheduleData {
  format: string;
  versiyon: number;
  ogretmenler: Record<string, WeekSchedule>;
}

interface TeacherStoreState {
  /** JSON'dan gelen ham öğretmen verileri */
  scheduleData: TeacherScheduleData | null;
  /** Hızlı arama için tüm öğretmen adları listesi */
  teacherNames: string[];
  /** Veriyi store'a yükler ve isim listesini oluşturur */
  setScheduleData: (data: TeacherScheduleData) => void;
  /** Öğretmen adına göre haftalık programı döner */
  getTeacherSchedule: (name: string) => WeekSchedule | undefined;
  /** IndexedDB'den verilerin yüklenip yüklenmediğini belirtir */
  hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

// localforage'ı Zustand persist için uyumlu hale getiren adapter
const storageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await localforage.getItem(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await localforage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await localforage.removeItem(name);
  },
};

export const useTeacherStore = create<TeacherStoreState>()(
  persist(
    (set, get) => ({
      scheduleData: null,
      teacherNames: [],
      hasHydrated: false,
      setHasHydrated: (state) => set({ hasHydrated: state }),

      setScheduleData: (data) => {
        const names = Object.keys(data.ogretmenler).sort((a, b) =>
          a.localeCompare(b, 'tr-TR')
        );
        set({ scheduleData: data, teacherNames: names });
      },

      getTeacherSchedule: (name) => {
        const data = get().scheduleData;
        if (!data) return undefined;
        return data.ogretmenler[name];
      },
    }),
    {
      name: 'teacher-store', // IndexedDB'de bu isimle saklanacak
      storage: createJSONStorage(() => storageAdapter),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
      },
    }
  )
);
