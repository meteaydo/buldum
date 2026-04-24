import './VirtualKeyboard.css';
import { Delete, Keyboard, ChevronDown } from 'lucide-react';

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onClose: () => void;
  isVisible: boolean;
}

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'e', 'r', 't', 'y', 'u', 'ı', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'i'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

export default function VirtualKeyboard({ onKeyPress, onBackspace, onClose, isVisible }: VirtualKeyboardProps) {
  if (!isVisible) return null;

  return (
    <div 
      className="virtual-keyboard-container" 
      onMouseDown={(e) => e.preventDefault()} 
    >
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="vk-row">
          {rowIndex === 3 && <div className="vk-spacer" style={{ flexGrow: 0.2 }} />}
          {row.map((key) => (
            <button 
              key={key} 
              className="vk-key"
              onClick={(e) => {
                e.preventDefault();
                onKeyPress(key);
              }}
              type="button"
            >
              {key}
            </button>
          ))}
          {rowIndex === 3 && (
            <button 
              className="vk-key vk-backspace" 
              onClick={(e) => {
                e.preventDefault();
                onBackspace();
              }}
              type="button"
            >
              <Delete size={22} />
            </button>
          )}
        </div>
      ))}
      <div className="vk-row vk-bottom-row">
        <div className="vk-spacer" />
        <button 
          className="vk-key vk-space" 
          onClick={(e) => {
            e.preventDefault();
            onKeyPress(' ');
          }}
          type="button"
        >
          boşluk
        </button>
        <button 
          className="vk-key vk-hide-btn" 
          onClick={(e) => {
            e.preventDefault();
            onClose();
          }}
          type="button"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-2px' }}>
            <Keyboard size={18} />
            <ChevronDown size={14} style={{ marginTop: '-4px' }} />
          </div>
        </button>
      </div>
    </div>
  );
}
