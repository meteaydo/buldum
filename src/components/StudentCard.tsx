import React, { useEffect, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { StudentInfo } from '../store/classStore';
import { UserCircle } from 'lucide-react';
import './StudentCard.css';

interface Props {
  student: StudentInfo;
  disabled?: boolean;
  /** Sürükleme desteği gerekiyorsa true yap (varsayılan: false) */
  draggable?: boolean;
  onZoom?: (student: StudentInfo) => void;
  /** Kartın boyutunu dışarıdan belirlemek için (px) */
  size?: number;
}

/**
 * Hem oturma planında hem de Spotlight arama sonuçlarında
 * kullanılan tek öğrenci kartı bileşeni.
 */
export default function StudentCard({ student, disabled = true, draggable = false, onZoom, size }: Props) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  // Sürükleme sadece draggable=true olduğunda aktif
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.id,
    disabled: !draggable || disabled,
  });

  const style: React.CSSProperties = {};

  if (transform) {
    style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0)`;
    style.zIndex = 999;
  }

  if (size) {
    style.width = `${size}px`;
    style.height = `${size}px`;
  }

  useEffect(() => {
    if (student.photoUrl) {
      setImgSrc(student.photoUrl);
    }
  }, [student.photoUrl]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!isDragging && onZoom) {
      onZoom(student);
    }
  };

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      style={style}
      className={`student-card ${isDragging ? 'is-dragging' : ''} ${draggable && !disabled ? 'is-draggable' : ''}`}
      onClick={handleClick}
      {...(draggable ? { ...listeners, ...attributes } : {})}
    >
      <div className="student-photo">
        {imgSrc ? (
          <img src={imgSrc} alt={student.name} draggable="false" />
        ) : (
          <UserCircle size={40} color="#9ca3af" />
        )}
      </div>
      <div className="student-info">
        <span className="student-name">{student.name}</span>
        <span className="student-no">{student.className} – {student.studentNo}</span>
      </div>
    </div>
  );
}
