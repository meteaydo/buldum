import { create } from 'zustand';

/** Oturum açmış kullanıcının temel bilgileri */
export interface AuthUser {
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

/** localStorage anahtarı — kod doğrulama durumunu persist eder */
const CODE_VERIFIED_KEY = 'auth_code_verified';
const VERIFIED_EMAIL_KEY = 'auth_verified_email';

interface AuthState {
  /** Firebase Auth'dan gelen kullanıcı bilgisi */
  user: AuthUser | null;
  /** Firebase Auth durumu yüklendi mi */
  isLoading: boolean;
  /** Google ile oturum açılmış mı */
  isAuthenticated: boolean;
  /** 6 haneli erişim kodu doğrulandı mı */
  isCodeVerified: boolean;
  /** Aktif kullanıcı admin mi */
  isAdmin: boolean;

  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setCodeVerified: (verified: boolean) => void;
  clearAuth: () => void;
}

/**
 * Sayfa yenilemede kod doğrulama durumunu localStorage'dan okur.
 * Email değiştiyse (farklı hesapla giriş) doğrulamayı sıfırlar.
 */
function loadCodeVerified(email: string | null): boolean {
  if (!email) return false;
  const verified = localStorage.getItem(CODE_VERIFIED_KEY);
  const verifiedEmail = localStorage.getItem(VERIFIED_EMAIL_KEY);
  return verified === 'true' && verifiedEmail === email;
}

/** Admin email'i .env'den okunur */
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string || '').toLowerCase().trim();

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isCodeVerified: false,
  isAdmin: false,

  setUser: (user) => {
    const email = user?.email?.toLowerCase().trim() ?? null;
    const isCodeVerified = loadCodeVerified(email);
    const isAdmin = email === ADMIN_EMAIL;

    set({
      user,
      isAuthenticated: user !== null,
      isCodeVerified: isAdmin || isCodeVerified, // Admin koda gerek duymaz
      isAdmin,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setCodeVerified: (verified) => {
    set((state) => {
      if (state.user?.email) {
        if (verified) {
          localStorage.setItem(CODE_VERIFIED_KEY, 'true');
          localStorage.setItem(VERIFIED_EMAIL_KEY, state.user.email);
        } else {
          localStorage.removeItem(CODE_VERIFIED_KEY);
          localStorage.removeItem(VERIFIED_EMAIL_KEY);
        }
      }
      return { isCodeVerified: verified };
    });
  },

  clearAuth: () => {
    localStorage.removeItem(CODE_VERIFIED_KEY);
    localStorage.removeItem(VERIFIED_EMAIL_KEY);
    set({
      user: null,
      isAuthenticated: false,
      isCodeVerified: false,
      isAdmin: false,
    });
  },
}));
