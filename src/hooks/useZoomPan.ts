import { useRef, useState, useCallback, useEffect } from 'react';

interface ZoomPanState {
  scale: number;
  translateX: number;
  translateY: number;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.1;

/**
 * Mobil: Tek parmak pan, çift parmak pinch-zoom.
 * PC: Mouse wheel zoom, fare ile pan (boş alana tıkla-sürükle).
 * isDragMode aktifken tek parmak pan devre dışı kalır (dnd-kit kartları taşır).
 */
export function useZoomPan(isDragMode: boolean, onDragAttempt?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ZoomPanState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  const lastPinchDistRef = useRef<number | null>(null);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const isTouchActiveRef = useRef(false);
  const isMousePanRef = useRef(false);
  const lastMousePointRef = useRef<{ x: number; y: number } | null>(null);

  // ─── Mouse Wheel Zoom (PC) ───
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    
    setState((prev) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale + delta));
      if (newScale === prev.scale) return prev;

      const scaleRatio = newScale / prev.scale;
      return {
        scale: newScale,
        translateX: mouseX - (mouseX - prev.translateX) * scaleRatio,
        translateY: mouseY - (mouseY - prev.translateY) * scaleRatio,
      };
    });
  }, []);

  // ─── Mouse Pan (PC) ───
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      let target = e.target as Element | null;
      if (target && target.nodeType === 3) {
        target = target.parentElement;
      }
      
      if (target && typeof target.closest === 'function') {
        const isInteractive = target.closest('button, a, input, select, textarea');
        if (e.button === 0 && isInteractive) return;

        // Düzenle modunda masa (.desk) da dahil — boş masalar da dnd-kit'e bırakılır
        const isDraggable = target.closest('.student-card, .draggable-item, .smart-board, .teacher-desk, .desk');
        if (isDragMode) {
          if (isDraggable) return;
        } else if (isDraggable && onDragAttempt) {
          onDragAttempt();
        }
      }

      isMousePanRef.current = true;
      lastMousePointRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [isDragMode]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isMousePanRef.current || !lastMousePointRef.current) return;
    const dx = e.clientX - lastMousePointRef.current.x;
    const dy = e.clientY - lastMousePointRef.current.y;
    lastMousePointRef.current = { x: e.clientX, y: e.clientY };
    setState((prev) => ({
      ...prev,
      translateX: prev.translateX + dx,
      translateY: prev.translateY + dy,
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isMousePanRef.current = false;
    lastMousePointRef.current = null;
  }, []);

  // ─── Touch Start ───
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      isTouchActiveRef.current = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      lastPanPointRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1) {
      let target = e.target as Element | null;
      if (target && target.nodeType === 3) {
        target = target.parentElement; // Text node ise parent'a geç
      }
      
      if (target && typeof target.closest === 'function') {
        const isInteractive = target.closest('button, a, input, select, textarea');
        if (isInteractive) return;

        // Düzenle modunda masa (.desk) da dahil — boş masalar da dnd-kit'e bırakılır
        const isDraggable = target.closest('.student-card, .draggable-item, .smart-board, .teacher-desk, .desk');
        if (isDragMode) {
          if (isDraggable) return;
        } else if (isDraggable && onDragAttempt) {
          onDragAttempt();
        }
      }

      isTouchActiveRef.current = true;
      lastPanPointRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  }, [isDragMode]);

  // ─── Touch Move ───
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
      // Çift parmak: her modda pinch-zoom + pan — tarayıcı varsayılanını engelle
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDist = Math.sqrt(dx * dx + dy * dy);
      const scaleDelta = (currentDist - lastPinchDistRef.current) * 0.005;
      lastPinchDistRef.current = currentDist;

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const px = midX - rect.left;
      const py = midY - rect.top;

      setState((prev) => {
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale + scaleDelta));
        const scaleRatio = newScale / prev.scale;
        
        let panDx = 0;
        let panDy = 0;
        if (lastPanPointRef.current) {
          panDx = midX - lastPanPointRef.current.x;
          panDy = midY - lastPanPointRef.current.y;
        }
        lastPanPointRef.current = { x: midX, y: midY };

        return {
          scale: newScale,
          translateX: px - (px - (prev.translateX + panDx)) * scaleRatio,
          translateY: py - (py - (prev.translateY + panDy)) * scaleRatio,
        };
      });
    } else if (e.touches.length === 1) {
      if (isDragMode && !isTouchActiveRef.current) {
        // Dokunuş sürüklenebilir öğe üzerinde başladı (student-card / desk) →
        // tarayıcı native pan'ini engelle, dnd-kit yönetir.
        e.preventDefault();
        return;
      }

      // Boş kanvasta başlayan dokunuş → pan devam eder (isDragMode olsa bile)
      if (lastPanPointRef.current && isTouchActiveRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - lastPanPointRef.current.x;
        const dy = e.touches[0].clientY - lastPanPointRef.current.y;
        lastPanPointRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setState((prev) => ({
          ...prev,
          translateX: prev.translateX + dx,
          translateY: prev.translateY + dy,
        }));
      }
    }
  }, [isDragMode]);

  // ─── Touch End ───
  const handleTouchEnd = useCallback(() => {
    lastPinchDistRef.current = null;
    lastPanPointRef.current = null;
    isTouchActiveRef.current = false;
  }, []);

  // ─── Ekrana Sığdır (Fit to Screen) ───
  const fitToScreen = useCallback(() => {
    const viewport = containerRef.current;
    const content = contentRef.current;
    if (!viewport || !content) {
      setState({ scale: 1, translateX: 0, translateY: 0 });
      return;
    }

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    // Doğal boyutu ölçmek için transform'u geçici olarak kaldır
    const prevTransform = content.style.transform;
    content.style.transform = 'none';
    const naturalWidth = content.scrollWidth;
    const naturalHeight = content.scrollHeight;
    
    // Dolu sıraların ve diğer önemli elemanların bounding box'ını bul
    const contentRect = content.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Sadece içi dolu sıralar (.desk-pair içinde .student-card varsa o desk-pair'i alabiliriz veya direkt student-card'ları alabiliriz)
    // Sınıfın neresi olduğunu belli etmek için tahta ve öğretmen masasını da dahil ediyoruz.
    const elementsToInclude = content.querySelectorAll('.student-card, .smart-board, .teacher-desk');
    
    if (elementsToInclude.length > 0) {
      elementsToInclude.forEach(el => {
        const rect = el.getBoundingClientRect();
        const x = rect.left - contentRect.left;
        const y = rect.top - contentRect.top;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + rect.width);
        maxY = Math.max(maxY, y + rect.height);
      });
    }

    content.style.transform = prevTransform;

    let targetWidth = naturalWidth;
    let targetHeight = naturalHeight;
    let targetMinX = 0;
    let targetMinY = 0;

    // Eğer dolu sıra veya masa varsa
    if (minX !== Infinity && minY !== Infinity) {
      const PADDING = 40; // Ekranda kenarlardan bırakılacak boşluk
      targetMinX = Math.max(0, minX - PADDING);
      targetMinY = Math.max(0, minY - PADDING);
      targetWidth = Math.min(naturalWidth, (maxX - minX) + PADDING * 2);
      targetHeight = Math.min(naturalHeight, (maxY - minY) + PADDING * 2);
    }

    const scaleX = viewportWidth / targetWidth;
    const scaleY = viewportHeight / targetHeight;
    const fitScale = Math.min(scaleX, scaleY, 1) * 0.96; // %4 ekstra güvenlik payı

    // Yatayda ve dikeyde ortalamak için offset hesapla
    const scaledTargetWidth = targetWidth * fitScale;
    const scaledTargetHeight = targetHeight * fitScale;
    
    const offsetX = Math.max(12, (viewportWidth - scaledTargetWidth) / 2) - (targetMinX * fitScale);
    
    // Sınıf ekranın çok üstüne yapışmasın diye en az 60px boşluk bırak
    const verticalPadding = 60;
    const offsetY = Math.max(verticalPadding, (viewportHeight - scaledTargetHeight) / 2) - (targetMinY * fitScale);

    setState({
      scale: Math.max(MIN_SCALE, fitScale),
      translateX: offsetX,
      translateY: offsetY,
    });
  }, []);

  const performZoom = useCallback((delta: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setState((prev) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale + delta));
      if (newScale === prev.scale) return prev;
      
      const scaleRatio = newScale / prev.scale;
      return {
        scale: newScale,
        translateX: centerX - (centerX - prev.translateX) * scaleRatio,
        translateY: centerY - (centerY - prev.translateY) * scaleRatio,
      };
    });
  }, []);

  const zoomIn = useCallback(() => performZoom(ZOOM_STEP), [performZoom]);
  const zoomOut = useCallback(() => performZoom(-ZOOM_STEP), [performZoom]);

  // ─── Event Listener'ları bağla / temizle ───
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseMove, handleMouseUp]);

  const transformStyle: React.CSSProperties = {
    transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
    transformOrigin: '0 0',
  };

  return {
    containerRef,
    contentRef,
    transformStyle,
    scale: state.scale,
    zoomIn,
    zoomOut,
    fitToScreen,
  };
}
