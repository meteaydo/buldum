import localforage from 'localforage';

/**
 * Sınıf bazlı oturma düzeni: öğrenci ID → masa ID eşlemesi.
 * Yalnızca masa atamaları tutulur; isim/fotoğraf verileri studentStore'dan alınır.
 */
export type SeatingArrangement = Record<string, string>;

/** IndexedDB'de kullanılacak anahtar öneki (versiyon etiketi ile taşmayı önler) */
const KEY_PREFIX = 'seating-plan-v1-';

/**
 * Tarayıcıdan kalıcı depolama izni ister.
 * Onaylanırsa veriler, quota baskısında dahi otomatik silinmez.
 * Kullanıcı manuel "Site verilerini temizle" yapmazsa korunur.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  const alreadyPersisted = await navigator.storage.persisted();
  if (alreadyPersisted) return true;
  return navigator.storage.persist();
}

/**
 * Belirtilen sınıfın oturma planını IndexedDB'ye kaydeder.
 * @param classId  - Sınıf adı (örn. "9A")
 * @param arrangement - { studentId: deskId } eşlemesi
 */
export async function saveSeatingArrangement(
  classId: string,
  arrangement: SeatingArrangement
): Promise<void> {
  await localforage.setItem(`${KEY_PREFIX}${classId}`, {
    arrangement,
    savedAt: new Date().toISOString(),
  });
}

/**
 * Belirtilen sınıfın kaydedilmiş oturma düzenini döner.
 * Henüz kaydedilmemişse null döner.
 */
export async function loadSeatingArrangement(
  classId: string
): Promise<SeatingArrangement | null> {
  const stored = await localforage.getItem<{
    arrangement: SeatingArrangement;
    savedAt: string;
  }>(`${KEY_PREFIX}${classId}`);

  return stored?.arrangement ?? null;
}
