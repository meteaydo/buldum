import React from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import './Desk.css';

interface Props {
  id: string;
  isDragMode?: boolean;
  children?: React.ReactNode;
}

/**
 * Masa bileşeni — her zaman droppable, düzenleme modunda boşsa ayrıca draggable.
 * Boş masayı dolu masanın üstüne sürükleyerek öğrenciyi taşıyabilirsiniz.
 */
export default function Desk({ id, isDragMode = false, children }: Props) {
  const isEmpty = !children;

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id });

  const {
    setNodeRef: setDraggableRef,
    attributes,
    listeners,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled: !isDragMode || !isEmpty,
  });

  // Her iki hook'un ref'ini birleştir
  const setNodeRef = (node: HTMLElement | null) => {
    setDroppableRef(node);
    setDraggableRef(node);
  };

  const style: React.CSSProperties = {};
  if (transform) {
    style.transform = CSS.Translate.toString(transform);
    style.zIndex = 999;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'desk',
        isOver ? 'desk-is-over' : '',
        children ? 'has-student' : '',
        isEmpty && isDragMode ? 'desk-empty-droppable' : '',
        isDragging ? 'desk-dragging' : '',
      ].filter(Boolean).join(' ')}
      {...(isEmpty && isDragMode ? { ...listeners, ...attributes } : {})}
    >
      {children ?? (
        <div className="desk-empty-label">
          {isDragMode ? '+' : 'Boş Sıra'}
        </div>
      )}
    </div>
  );
}
