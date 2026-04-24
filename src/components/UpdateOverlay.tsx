import React from 'react';
import './SyncOverlay.css'; // Aynı stilleri kullanabiliriz, mevcut tasarımla uyumlu olması için.

interface UpdateOverlayProps {
  isUpdating: boolean;
}

const UpdateOverlay: React.FC<UpdateOverlayProps> = ({ isUpdating }) => {
  if (!isUpdating) return null;

  return (
    <div className="sync-overlay">
      <div className="sync-content">
        <div className="sync-spinner" />
        <h2 className="sync-title">Uygulama Güncelleniyor</h2>
        <p className="sync-message">Yeni versiyon yükleniyor, lütfen bekleyin...</p>
      </div>
    </div>
  );
};

export default UpdateOverlay;
