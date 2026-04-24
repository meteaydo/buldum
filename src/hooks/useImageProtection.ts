import { useEffect, useCallback, useState } from 'react';

/**
 * Resimlerin kopyalanmasını, kaydedilmesini ve ekran görüntüsü alınmasını
 * caydırmak için çeşitli koruma katmanları uygular.
 * 
 * Not: Tarayıcı düzeyinde %100 koruma mümkün değildir.
 * Bu hook, caydırıcı önlemleri bir arada uygular.
 */
export function useImageProtection() {
  const [isBlurred, setIsBlurred] = useState(false);

  // Sağ tık menüsünü engelle (resimler üzerinde)
  const handleContextMenu = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Sadece resim öğelerinde ve resim içeren konteynerlerde engelle
    if (
      target.tagName === 'IMG' ||
      target.closest('.student-photo') ||
      target.closest('.card-zoom-overlay') ||
      target.closest('.protected-image')
    ) {
      e.preventDefault();
    }
  }, []);

  // Sürükle-bırak engelle (resimler üzerinde)
  const handleDragStart = useCallback((e: DragEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'IMG' ||
      target.closest('.student-photo') ||
      target.closest('.protected-image')
    ) {
      e.preventDefault();
    }
  }, []);

  // Kopyalama engelle (resim içeren alanlar için)
  const handleCopy = useCallback((e: ClipboardEvent) => {
    const selection = window.getSelection();
    if (selection) {
      const container = selection.anchorNode?.parentElement;
      if (
        container?.closest('.student-photo') ||
        container?.closest('.card-zoom-overlay') ||
        container?.closest('.protected-image')
      ) {
        e.preventDefault();
      }
    }
  }, []);

  // PrintScreen / ekran yakalama algılama
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // PrintScreen tuşunu algıla
    if (e.key === 'PrintScreen') {
      e.preventDefault();
      setIsBlurred(true);
      setTimeout(() => setIsBlurred(false), 1500);
    }
    // Ctrl+Shift+S (ekran alıntısı aracı)
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      setIsBlurred(true);
      setTimeout(() => setIsBlurred(false), 1500);
    }
    // Ctrl+P (yazdır) — resimlerin yazdırılmasını engelle
    if (e.ctrlKey && e.key === 'p') {
      e.preventDefault();
    }
  }, []);

  // Sayfa odak kaybettiğinde resimleri bulanıklaştır (ekran yakalama algılama)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      setIsBlurred(true);
    } else {
      // Sayfa tekrar görünür olduğunda kısa bir gecikmeyle blur'u kaldır
      setTimeout(() => setIsBlurred(false), 300);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleContextMenu, handleDragStart, handleCopy, handleKeyDown, handleVisibilityChange]);

  return { isBlurred };
}
