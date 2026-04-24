import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  DndContext, 
  PointerSensor, 
  TouchSensor, 
  useSensor, 
  useSensors,
  closestCenter,
  pointerWithin,
  useDraggable,
} from '@dnd-kit/core';
import type { DragEndEvent, CollisionDetection } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import { ChevronLeft, Save, ZoomIn, ZoomOut, Maximize, Hand, GripVertical, X, UserCircle } from 'lucide-react';
import { useClassStore } from '../store/classStore';
import { useStudentStore } from '../store/studentStore';
import type { StudentInfo } from '../store/classStore';
import { useZoomPan } from '../hooks/useZoomPan';
import {
  requestPersistentStorage,
  saveSeatingArrangement,
  loadSeatingArrangement,
  type SeatingArrangement,
} from '../services/seatingPersistService';

import Desk from '../components/Desk';
import StudentCard from '../components/StudentCard';
import CustomAlert from '../components/CustomAlert';
import './SeatingPlanPage.css';

// ─── Taşınabilir Düzen Öğesi Bileşeni ───
function DraggableLayoutItem({ id, label, className, initialPos, disabled }: any) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    disabled: disabled
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={{ ...style, ...initialPos }} 
      {...attributes} 
      {...listeners}
      className={`${className} ${!disabled ? 'draggable-item' : ''}`}
    >
      {label}
    </div>
  );
}

export default function SeatingPlanPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { students, setStudents, moveOrSwapStudent, hasUnsavedChanges, setUnsaved } = useClassStore();
  const { getStudentsByClass } = useStudentStore();
  
  const [showExitAlert, setShowExitAlert] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [zoomedStudent, setZoomedStudent] = useState<StudentInfo | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  /** Kalıcı depolama iznini bir kez iste */
  useEffect(() => {
    requestPersistentStorage().catch(() => {
      // İzin alınamazsa sessizce devam et — IndexedDB yine de çalışır
    });
  }, []);

  const handleDragAttempt = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage("Öğrencinin yerini değiştirmek için Düzenle modunu seçiniz.");
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  const { containerRef, contentRef, transformStyle, scale, zoomIn, zoomOut, fitToScreen } = useZoomPan(isDragMode, handleDragAttempt);

  // Sınıf yüklendiğinde ve öğrencilerin DOM'a yerleşmesinin ardından odaklan
  useEffect(() => {
    if (students.length > 0) {
      const timeout = setTimeout(() => {
        fitToScreen();
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [students.length, fitToScreen]);

  // Düzen öğeleri pozisyonları (Piksel bazlı)
  const [layoutPositions, setLayoutPositions] = useState({
    'smart-board': { x: 0, y: 0 },
    'teacher-desk': { x: 0, y: 0 }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  /**
   * İşaretleçi önce hangi masa rect'inin içinde olduğunu arar (boş masalar için kritik).
   * Hiçbir rect içinde değilse closestCenter'a düşer.
   */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCenter(args);
  }, []);



  useEffect(() => {
    if (!classId) return;

    async function initializeSeating() {
      const storeStudents = getStudentsByClass(classId!);

      if (storeStudents.length === 0) {
        setStudents([]);
        return;
      }

      // Öğrencileri okul numaralarına göre küçükten büyüğe sırala
      const sortedStudents = [...storeStudents].sort((a, b) => {
        const numA = parseInt(a.studentNo, 10);
        const numB = parseInt(b.studentNo, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return (a.studentNo || '').localeCompare(b.studentNo || '');
      });

      // Varsayılan masa sırası: Sağ alt köşeden, sütun sütun önden arkaya
      const seatOrder: string[] = [];
      for (let pairIdx = 3; pairIdx >= 0; pairIdx--) {
        for (let rowIdx = 4; rowIdx >= 0; rowIdx--) {
          const baseIdx = rowIdx * 8 + pairIdx * 2;
          seatOrder.push(`desk-${baseIdx + 1}`);
          seatOrder.push(`desk-${baseIdx}`);
        }
      }

      // Varsayılan masaları ata
      const mapped: StudentInfo[] = sortedStudents.map((s, idx) => ({
        id: s.id,
        name: s.name,
        className: s.className,
        studentNo: s.studentNo,
        photoUrl: s.photoUrl,
        deskId: seatOrder[idx] || `desk-${idx}`,
      }));

      // Kaydedilmiş düzen varsa üzerine uygula
      const savedArrangement = await loadSeatingArrangement(classId!);
      if (savedArrangement) {
        const restoredStudents = mapped.map((student) => ({
          ...student,
          // Kaydedilmişte yoksa (yeni öğrenci) varsayılan sırasına bırak
          deskId: savedArrangement[student.id] ?? student.deskId,
        }));
        setStudents(restoredStudents);
      } else {
        setStudents(mapped);
      }
    }

    initializeSeating();
  // classId veya store verisi değiştiğinde yeniden çalışır
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, getStudentsByClass]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    if (!isDragMode) return;

    // Eğer layout öğesi taşındıysa
    if (active.id === 'smart-board' || active.id === 'teacher-desk') {
      const id = active.id as keyof typeof layoutPositions;
      setLayoutPositions(prev => ({
        ...prev,
        [id]: {
          x: prev[id].x + delta.x / scale,
          y: prev[id].y + delta.y / scale
        }
      }));
      setUnsaved(true);
      return;
    }

    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Boş masa sürüklendi → hedef masadaki öğrenciyi kaynak masaya taşı
    const isEmptyDeskDragged = activeIdStr.startsWith('desk-');
    if (isEmptyDeskDragged) {
      const targetStudent = students.find(s => s.deskId === overIdStr);
      if (targetStudent) {
        moveOrSwapStudent(targetStudent.id, activeIdStr);
      }
    } else {
      // Öğrenci kartı sürüklendi → mevcut swap/move mantığı
      moveOrSwapStudent(activeIdStr, overIdStr);
    }
  };

  const handleSave = async () => {
    if (!classId) return;

    // Her öğrencinin masa atamasını { studentId: deskId } formatında kaydet
    const arrangement: SeatingArrangement = {};
    students.forEach((student) => {
      if (student.deskId) {
        arrangement[student.id] = student.deskId;
      }
    });

    await saveSeatingArrangement(classId, arrangement);
    setUnsaved(false);

    // Başarı bildirimi
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage('Oturma planı kaydedildi ✓');
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500);
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setShowExitAlert(true);
    } else {
      navigate('/');
    }
  };

  const confirmExit = () => {
    setShowExitAlert(false);
    setUnsaved(false);
    navigate('/');
  };

  return (
    <div className="seating-plan-layout">
      <header className="seating-header">
        <div className="header-left">
          <button className="btn-icon" onClick={handleBack}>
            <ChevronLeft size={24} />
          </button>
          <h1 className="class-title">{classId}</h1>
        </div>
        <div className="header-right">
          <div className="zoom-controls">
            <button className="btn-icon" onClick={zoomOut} title="Uzaklaştır">
              <ZoomOut size={18} />
            </button>
            <span className="zoom-level">{Math.round(scale * 100)}%</span>
            <button className="btn-icon" onClick={zoomIn} title="Yakınlaştır">
              <ZoomIn size={18} />
            </button>
            <button className="btn-icon" onClick={fitToScreen} title="Ekrana Sığdır">
              <Maximize size={16} />
            </button>
          </div>

          <button 
            className="btn-primary flex-center" 
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            style={{ opacity: hasUnsavedChanges ? 1 : 0.5 }}
          >
            <Save size={16} style={{ marginRight: '4px' }} />
            Kaydet
          </button>
        </div>
      </header>

      <div className="zoom-viewport" ref={containerRef}>
        <div className="zoom-content" ref={contentRef} style={transformStyle}>
          <main className="grid-container">
            <DndContext 
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragEnd={handleDragEnd}
            >
              <div className="classroom-rows">
                {Array.from({ length: 5 }, (_, rowIdx) => (
                  <div className="desk-row" key={`row-${rowIdx}`}>
                    {Array.from({ length: 4 }, (_, pairIdx) => {
                      const baseIdx = rowIdx * 8 + pairIdx * 2;
                      const leftDeskId = `desk-${baseIdx}`;
                      const rightDeskId = `desk-${baseIdx + 1}`;
                      const leftStudent = students.find(s => s.deskId === leftDeskId);
                      const rightStudent = students.find(s => s.deskId === rightDeskId);
                      return (
                        <div className="desk-pair" key={`pair-${rowIdx}-${pairIdx}`}>
                          <Desk id={leftDeskId} isDragMode={isDragMode}>
                            {leftStudent && (
                              <StudentCard 
                                student={leftStudent} 
                                draggable
                                disabled={!isDragMode} 
                                onZoom={setZoomedStudent}
                              />
                            )}
                          </Desk>
                          <Desk id={rightDeskId} isDragMode={isDragMode}>
                            {rightStudent && (
                              <StudentCard 
                                student={rightStudent} 
                                draggable
                                disabled={!isDragMode} 
                                onZoom={setZoomedStudent}
                              />
                            )}
                          </Desk>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="class-front-area">
                <DraggableLayoutItem 
                  id="smart-board"
                  label="TAHTA"
                  className="smart-board"
                  initialPos={{ transform: `translate(${layoutPositions['smart-board'].x}px, ${layoutPositions['smart-board'].y}px)` }}
                  disabled={!isDragMode}
                />
                <DraggableLayoutItem 
                  id="teacher-desk"
                  label="MASA"
                  className="teacher-desk"
                  initialPos={{ transform: `translate(${layoutPositions['teacher-desk'].x}px, ${layoutPositions['teacher-desk'].y}px)` }}
                  disabled={!isDragMode}
                />
              </div>
            </DndContext>
          </main>
        </div>
      </div>

      <div className="bottom-toolbar">
        <div className="bottom-toolbar-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6b7280' }}>Mod:</span>
          <div className="segmented-toggle">
            <button
              className={`segment ${!isDragMode ? 'active' : ''}`}
              onClick={() => setIsDragMode(false)}
            >
              <Hand size={18} />
              <span>Kaydır</span>
            </button>
            <button
              className={`segment ${isDragMode ? 'active' : ''}`}
              onClick={() => setIsDragMode(true)}
            >
              <GripVertical size={18} />
              <span>Düzenle</span>
            </button>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="drag-hint-toast">
          {toastMessage}
        </div>
      )}

      <CustomAlert 
        isOpen={showExitAlert}
        title="Kaydedilmemiş Değişiklikler"
        message="Yaptığınız değişiklikleri kaydetmediniz. Çıkmak istediğinize emin misiniz?"
        confirmText="Yine de Çık"
        cancelText="Vazgeç"
        onConfirm={confirmExit}
        onCancel={() => setShowExitAlert(false)}
      />

      {/* Ortalanmış Zoom Overlay */}
      {zoomedStudent && createPortal(
        <div className="card-zoom-overlay" onClick={() => setZoomedStudent(null)}>
          <div className="is-zoomed-center student-card" onClick={e => e.stopPropagation()}>
            <button className="btn-zoom-close" onClick={() => setZoomedStudent(null)}>
              <X className="zoom-close-icon" strokeWidth={2.5} />
            </button>
            
            <div className="student-photo">
              {zoomedStudent.photoUrl ? (
                <img src={zoomedStudent.photoUrl} alt={zoomedStudent.name} draggable="false" />
              ) : (
                <UserCircle size={60} color="#9ca3af" />
              )}
            </div>
            <div className="student-info">
              <span className="student-name">{zoomedStudent.name}</span>
              <span className="student-no">{zoomedStudent.className} – {zoomedStudent.studentNo}</span>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
