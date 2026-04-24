import './CustomAlert.css';

interface CustomAlertProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function CustomAlert({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = "Evet",
  cancelText = "İptal"
}: CustomAlertProps) {
  if (!isOpen) return null;

  return (
    <div className="alert-overlay">
      <div className="alert-box glass-card">
        <h3 className="alert-title">{title}</h3>
        <p className="alert-message">{message}</p>
        <div className="alert-actions">
          <button className="btn-cancel" onClick={onCancel}>{cancelText}</button>
          <button className="btn-primary" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
