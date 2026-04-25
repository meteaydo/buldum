import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { signInWithGoogle, signOutUser } from '../services/authService';
import { verifyAccessCode, checkEmailIsAuthorized } from '../services/accessCodeService';
import './LoginPage.css';

/** 6 haneli kod uzunluğu */
const CODE_LENGTH = 6;

/**
 * İki aşamalı giriş sayfası:
 * 1. Google ile oturum açma
 * 2. 6 haneli erişim kodu doğrulama
 */
export default function LoginPage() {
  const { user, isAuthenticated, setCodeVerified } = useAuthStore();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [codeDigits, setCodeDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [shakeClass, setShakeClass] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  /** Otomatik Doğrulama Kontrolü */
  useEffect(() => {
    let isMounted = true;
    const checkAutoAuth = async () => {
      if (isAuthenticated && user?.email) {
        setIsCheckingAuth(true);
        try {
          const isAuthorized = await checkEmailIsAuthorized(user.email);
          if (isMounted && isAuthorized) {
            setCodeVerified(true);
          }
        } catch (err) {
          console.error("Otomatik doğrulama hatası:", err);
        } finally {
          if (isMounted) setIsCheckingAuth(false);
        }
      }
    };

    checkAutoAuth();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.email, setCodeVerified]);

  /** Google popup ile oturum aç */
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Giriş başarısız';
      // Kullanıcı popup'ı kapattıysa sessizce geç
      if (!message.includes('popup-closed-by-user')) {
        setError(message);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  /** Farklı hesapla giriş yap */
  const handleSwitchAccount = async () => {
    await signOutUser();
    setCodeDigits(Array(CODE_LENGTH).fill(''));
    setError('');
  };

  /** PIN input'larında tek hane girişi — otomatik sonraki haneye geç */
  const handleDigitChange = useCallback((index: number, value: string) => {
    // Sadece rakam kabul et
    const digit = value.replace(/\D/g, '').slice(-1);
    setError('');
    setShakeClass('');

    setCodeDigits((prev) => {
      const updated = [...prev];
      updated[index] = digit;
      return updated;
    });

    // Sonraki input'a odaklan
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  /** Backspace ile önceki haneye geç */
  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [codeDigits]);

  /** Yapıştırma desteği — 6 haneli kod yapıştırıldığında tüm hanalere dağıt */
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (pasted.length > 0) {
      const digits = pasted.split('');
      setCodeDigits((prev) => {
        const updated = [...prev];
        digits.forEach((d, i) => { updated[i] = d; });
        return updated;
      });
      // Son dolu haneye odaklan
      const focusIndex = Math.min(digits.length, CODE_LENGTH - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  }, []);

  /** Kodu doğrula */
  const handleVerify = async () => {
    const code = codeDigits.join('');
    if (code.length !== CODE_LENGTH || !user?.email) return;

    setIsVerifying(true);
    setError('');

    try {
      const isValid = await verifyAccessCode(user.email, code);
      if (isValid) {
        setCodeVerified(true);
      } else {
        setError('Geçersiz erişim kodu');
        setShakeClass('shake');
        setTimeout(() => setShakeClass(''), 600);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Doğrulama hatası';
      setError(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const isCodeComplete = codeDigits.every((d) => d.length === 1);

  return (
    <div className="login-layout">
      <div className="login-card">
        {/* Logo */}
        <img src="/elephentlogo.png" alt="BulGetir" className="login-logo" />

        {!isAuthenticated ? (
          /* ─── Aşama 1: Google Giriş ─── */
          <>
            <h1 className="login-title">BulGetir</h1>
            <p className="login-subtitle">
              Devam etmek için Google hesabınızla giriş yapın
            </p>

            <button
              className="btn-google"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
            >
              {isSigningIn ? (
                <div className="login-spinner" />
              ) : (
                <>
                  <svg className="google-icon" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google ile Giriş Yap
                </>
              )}
            </button>

            {error && <p className="code-error">{error}</p>}
          </>
        ) : (
          /* ─── Aşama 2: Kod Doğrulama ─── */
          <div className="code-step">
            <div className="user-profile">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Profil'}
                  className="user-avatar"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="user-avatar-placeholder">
                  {user?.displayName?.charAt(0) || '?'}
                </div>
              )}
              <p className="user-name">{user?.displayName}</p>
              <p className="user-email">{user?.email}</p>
            </div>

            {isCheckingAuth ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div className="login-spinner" style={{ margin: '0 auto' }} />
                <p style={{ marginTop: '1rem', color: '#64748b' }}>Yetkiler kontrol ediliyor...</p>
              </div>
            ) : (
              <>
                <p className="code-label">
                  Size verilen 6 haneli erişim kodunu girin
                </p>

                {/* PIN Input Kutuları */}
                <div className={`pin-input-group ${shakeClass}`} onPaste={handlePaste}>
                  {codeDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className={`pin-digit ${digit ? 'filled' : ''} ${error ? 'error' : ''}`}
                      autoFocus={idx === 0}
                    />
                  ))}
                </div>

                {error && <p className="code-error">{error}</p>}

                <button
                  className="btn-verify"
                  onClick={handleVerify}
                  disabled={!isCodeComplete || isVerifying}
                >
                  {isVerifying ? (
                    <div className="login-spinner" style={{ margin: '0 auto' }} />
                  ) : (
                    'Doğrula'
                  )}
                </button>

                <button className="btn-switch-account" onClick={handleSwitchAccount}>
                  Farklı hesapla giriş yap
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
