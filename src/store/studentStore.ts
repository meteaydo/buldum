import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import localforage from 'localforage';

/**
 * Excel'den parse edilen tek bir öğrenci verisi.
 * `className`: başlık hücresinden çıkarılan sınıf adı (örn. "9A")
 */
export interface ParsedStudent {
  id: string;         // studentNo - uygulama genelinde birincil anahtar
  studentNo: string;
  name: string;
  photoUrl: string | null;
  className: string;  // Hangi sınıfa ait (örn. "9A", "10B")
}

interface StudentStoreState {
  /** Parse edilmiş tüm öğrenciler (birden fazla sınıf dosyasından birikebilir) */
  allStudents: ParsedStudent[];
  /** Sistemde tanımlı sınıf adları listesi */
  classNames: string[];
  /** Öğrencileri ekler; aynı id varsa üzerine yazar (yeniden import senaryosu) */
  upsertStudents: (students: ParsedStudent[]) => void;
  /** Belirli bir sınıfa ait öğrencileri döner */
  getStudentsByClass: (className: string) => ParsedStudent[];
  /** id ile tek öğrenci bulur */
  getStudentById: (id: string) => ParsedStudent | undefined;
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

export const useStudentStore = create<StudentStoreState>()(
  persist(
    (set, get) => ({
      allStudents: [],
      classNames: [],
      hasHydrated: false,
      setHasHydrated: (state) => set({ hasHydrated: state }),

      upsertStudents: (incoming) => {
        set((state) => {
          // Mevcut listeye birleştir; aynı id varsa güncelle
          const map = new Map<string, ParsedStudent>();
          state.allStudents.forEach((s) => map.set(s.id, s));
          incoming.forEach((s) => map.set(s.id, s));

          const merged = Array.from(map.values());
          const classSet = new Set(merged.map((s) => s.className));

          return {
            allStudents: merged,
            classNames: Array.from(classSet).sort(),
          };
        });
      },

      getStudentsByClass: (className) =>
        get().allStudents.filter((s) => s.className === className),

      getStudentById: (id) =>
        get().allStudents.find((s) => s.id === id),
    }),
    {
      name: 'student-store', // IndexedDB'de bu isimle saklanacak
      storage: createJSONStorage(() => storageAdapter),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
      },
    }
  )
);
