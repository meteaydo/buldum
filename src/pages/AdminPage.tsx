import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield, Database } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import {
  fetchAllCodes,
  assignEmail,
  revokeEmail,
  seedAccessCodes,
} from '../services/accessCodeService';
import type { AccessCodeDoc } from '../services/accessCodeService';
import './AdminPage.css';

/** Filtre seçenekleri */
type FilterType = 'all' | 'assigned' | 'available';

/**
 * Admin paneli — erişim kodlarını yönetme sayfası.
 * Sadece admin e-postasıyla giriş yapmış kullanıcılar erişebilir.
 */
export default function AdminPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();

  const [codes, setCodes] = useState<AccessCodeDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dialog state
  const [dialogCode, setDialogCode] = useState<AccessCodeDoc | null>(null);
  const [dialogEmail, setDialogEmail] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  /** Admin değilse ana sayfaya yönlendir */
  useEffect(() => {
    if (!isAdmin) {
      navigate('/', { replace: true });
    }
  }, [isAdmin, navigate]);

  /** Toast göster */
  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /** Kodları Firestore'dan yükle */
  const loadCodes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllCodes();
      setCodes(data);
    } catch (err) {
      console.error('Kodlar yüklenirken hata:', err);
      showToast('Kodlar yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  /** 50 kod oluştur (ilk kurulum) */
  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const count = await seedAccessCodes();
      if (count > 0) {
        showToast(`${count} adet erişim kodu oluşturuldu`);
        await loadCodes();
      } else {
        showToast('Kodlar zaten mevcut');
      }
    } catch (err) {
      console.error('Seed hatası:', err);
      showToast('Kod oluşturma başarısız');
    } finally {
      setIsSeeding(false);
    }
  };

  /** Email ata */
  const handleAssign = async () => {
    if (!dialogCode || !dialogEmail.trim()) return;

    setIsAssigning(true);
    try {
      await assignEmail(dialogCode.id, dialogEmail.trim());
      showToast(`Kod ${dialogCode.code} → ${dialogEmail.trim()} atandı`);
      setDialogCode(null);
      setDialogEmail('');
      await loadCodes();
    } catch (err) {
      console.error('Atama hatası:', err);
      showToast('Email atanamadı');
    } finally {
      setIsAssigning(false);
    }
  };

  /** Email iptal */
  const handleRevoke = async (doc: AccessCodeDoc) => {
    try {
      await revokeEmail(doc.id);
      showToast(`Kod ${doc.code} serbest bırakıldı`);
      await loadCodes();
    } catch (err) {
      console.error('İptal hatası:', err);
      showToast('İptal işlemi başarısız');
    }
  };

  // Filtrelenmiş kodlar
  const filteredCodes = codes.filter((c) => {
    if (filter === 'assigned') return c.email !== '';
    if (filter === 'available') return c.email === '';
    return true;
  });

  const assignedCount = codes.filter((c) => c.email !== '').length;
  const availableCount = codes.filter((c) => c.email === '').length;

  if (!isAdmin) return null;

  return (
    <div className="admin-layout">
      {/* Üst Başlık */}
      <header className="admin-header">
        <div className="admin-header-left">
          <button className="admin-back-btn" onClick={() => navigate('/')}>
            <ChevronLeft size={18} />
          </button>
          <h1>Erişim Kodları</h1>
        </div>
        <div className="admin-stats">
          <span className="stat-item">
            <span className="stat-dot assigned" />
            {assignedCount} atanmış
          </span>
          <span className="stat-item">
            <span className="stat-dot available" />
            {availableCount} boş
          </span>
        </div>
      </header>

      {/* İçerik */}
      <div className="admin-content">
        {/* Filtre + Seed */}
        <div className="admin-filter-bar">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Tümü ({codes.length})
          </button>
          <button
            className={`filter-btn ${filter === 'assigned' ? 'active' : ''}`}
            onClick={() => setFilter('assigned')}
          >
            Atanmış ({assignedCount})
          </button>
          <button
            className={`filter-btn ${filter === 'available' ? 'active' : ''}`}
            onClick={() => setFilter('available')}
          >
            Boş ({availableCount})
          </button>

          {codes.length === 0 && !isLoading && (
            <button
              className="btn-seed"
              onClick={handleSeed}
              disabled={isSeeding}
            >
              <Database size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {isSeeding ? '50 Kod Oluşturuluyor...' : '50 Kod Oluştur'}
            </button>
          )}
        </div>

        {/* Yükleniyor */}
        {isLoading && (
          <div className="admin-loading">
            <div className="admin-loading-spinner" />
            <span>Kodlar yükleniyor...</span>
          </div>
        )}

        {/* Boş durum */}
        {!isLoading && codes.length === 0 && (
          <div className="admin-empty">
            <Shield size={48} color="#475569" />
            <p>Henüz erişim kodu oluşturulmamış.</p>
            <p>Yukarıdaki "50 Kod Oluştur" butonuna tıklayarak başlayın.</p>
          </div>
        )}

        {/* Kod Listesi */}
        {!isLoading && filteredCodes.length > 0 && (
          <div className="codes-grid">
            {filteredCodes.map((c) => (
              <div key={c.id} className="code-row">
                <span className="code-value">{c.code}</span>
                <span className={`code-email ${c.email ? '' : 'empty'}`}>
                  {c.email || 'Atanmamış'}
                </span>
                <span className={`code-status ${c.email ? 'assigned' : 'available'}`}>
                  {c.email ? 'Aktif' : 'Boş'}
                </span>
                {c.email ? (
                  <button
                    className="code-action-btn revoke"
                    onClick={() => handleRevoke(c)}
                  >
                    İptal
                  </button>
                ) : (
                  <button
                    className="code-action-btn assign"
                    onClick={() => {
                      setDialogCode(c);
                      setDialogEmail('');
                    }}
                  >
                    Ata
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Atama Dialog'u */}
      {dialogCode && createPortal(
        <div className="assign-dialog-overlay" onClick={() => setDialogCode(null)}>
          <div className="assign-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Email Ata</h3>
            <div className="assign-dialog-code">{dialogCode.code}</div>
            <input
              type="email"
              className="assign-email-input"
              placeholder="ornek@gmail.com"
              value={dialogEmail}
              onChange={(e) => setDialogEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dialogEmail.trim()) handleAssign();
              }}
              autoFocus
            />
            <div className="assign-dialog-actions">
              <button
                className="btn-dialog-cancel"
                onClick={() => setDialogCode(null)}
              >
                Vazgeç
              </button>
              <button
                className="btn-dialog-confirm"
                onClick={handleAssign}
                disabled={!dialogEmail.trim() || isAssigning}
              >
                {isAssigning ? 'Atanıyor...' : 'Ata'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast */}
      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}
