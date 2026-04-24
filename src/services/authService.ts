import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';

const googleProvider = new GoogleAuthProvider();

/**
 * Google popup ile oturum açar.
 * Başarılı olursa Firebase User döner.
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Aktif oturumu kapatır.
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Firebase Auth state değişikliklerini dinler.
 * Sayfa yenilendiğinde mevcut oturumu otomatik algılar.
 *
 * @returns Dinleyiciyi durduran unsubscribe fonksiyonu
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
