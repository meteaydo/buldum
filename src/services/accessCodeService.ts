import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';

/** Firestore koleksiyon adı */
const COLLECTION_NAME = 'accessCodes';

/** Erişim kodu doküman yapısı */
export interface AccessCodeDoc {
  id: string;        // Firestore doküman ID'si
  code: string;      // 6 haneli benzersiz kod
  email: string;     // Atanmış e-posta ("" = atanmamış)
}

/**
 * Verilen email + kod çiftinin Firestore'da eşleşip eşleşmediğini kontrol eder.
 * Giriş akışında kullanılır.
 */
export async function verifyAccessCode(email: string, code: string): Promise<boolean> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('code', '==', code),
    where('email', '==', email.toLowerCase().trim())
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Belirtilen e-posta adresinin herhangi bir koda atanıp atanmadığını kontrol eder.
 * Kullanıcı Google ile giriş yaptığında otomatik doğrulama için kullanılır.
 */
export async function checkEmailIsAuthorized(email: string): Promise<boolean> {
  if (!email) return false;
  const q = query(
    collection(db, COLLECTION_NAME),
    where('email', '==', email.toLowerCase().trim())
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Admin paneli için tüm erişim kodlarını getirir.
 * Koda göre sıralı döner.
 */
export async function fetchAllCodes(): Promise<AccessCodeDoc[]> {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  const codes: AccessCodeDoc[] = snapshot.docs.map((d) => ({
    id: d.id,
    code: d.data().code as string,
    email: d.data().email as string,
  }));
  // Koda göre sırala
  return codes.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Bir erişim koduna e-posta atar.
 * Admin panelinden çağrılır.
 */
export async function assignEmail(docId: string, email: string): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, docId);
  await updateDoc(ref, { email: email.toLowerCase().trim() });
}

/**
 * Bir erişim kodundan e-posta atamasını kaldırır.
 * Admin panelinden çağrılır.
 */
export async function revokeEmail(docId: string): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, docId);
  await updateDoc(ref, { email: '' });
}

/**
 * 6 haneli benzersiz rastgele kod üretir.
 * Mevcut kodlarla çakışmayı önler.
 */
function generateUniqueCode(existingCodes: Set<string>): string {
  let code: string;
  do {
    // 100000–999999 arası rastgele sayı
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (existingCodes.has(code));
  existingCodes.add(code);
  return code;
}

/**
 * Firestore'a 50 adet benzersiz 6 haneli erişim kodu ekler.
 * Sadece koleksiyon boşsa çalışır (çift çalıştırmayı önler).
 *
 * @returns Oluşturulan kod sayısı (0 = zaten mevcuttu)
 */
export async function seedAccessCodes(): Promise<number> {
  const existing = await getDocs(collection(db, COLLECTION_NAME));

  // Zaten kod varsa tekrar oluşturma
  if (!existing.empty) {
    return 0;
  }

  const CODE_COUNT = 50;
  const usedCodes = new Set<string>();
  const batch = writeBatch(db);

  for (let i = 0; i < CODE_COUNT; i++) {
    const code = generateUniqueCode(usedCodes);
    const ref = doc(collection(db, COLLECTION_NAME));
    batch.set(ref, {
      code,
      email: '',
    });
  }

  await batch.commit();
  return CODE_COUNT;
}
