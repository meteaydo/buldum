import React from 'react';
import './VirtualKeyboard.css';
import { Delete } from 'lucide-react';

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  isVisible: boolean;
}

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'ı', 'o', 'p', 'ğ', 'ü'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ş', 'i'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'ö', 'ç'],
];

export default function VirtualKeyboard({ onKeyPress, onBackspace, isVisible }: VirtualKeyboardProps) {
  if (!isVisible) return null;

  return (
    <div 
      className="virtual-keyboard-container" 
      onMouseDown={(e) => e.preventDefault()} 
      onTouchStart={(e) => e.preventDefault()}
    >
      {ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="vk-row">
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
        </div>
      ))}
      <div className="vk-row">
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
          className="vk-key vk-backspace" 
          onClick={(e) => {
            e.preventDefault();
            onBackspace();
          }}
          type="button"
        >
          <Delete size={22} />
        </button>
      </div>
    </div>
  );
}
