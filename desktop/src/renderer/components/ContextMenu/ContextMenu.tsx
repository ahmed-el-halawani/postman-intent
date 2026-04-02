import React, { useEffect, useRef } from 'react';
import { colors } from '../../styles';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: false;
}

export interface ContextMenuDivider {
  divider: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;

interface ContextMenuProps {
  items: ContextMenuEntry[];
  position: { x: number; y: number };
  onClose: () => void;
}

export default function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // Delay to avoid the same click closing immediately
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const el = menuRef.current;
    if (rect.right > window.innerWidth) {
      el.style.left = `${position.x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${position.y - rect.height}px`;
    }
  }, [position]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        padding: '4px 0',
        minWidth: '160px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 2000,
      }}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return (
            <div
              key={`div-${i}`}
              style={{
                height: '1px',
                background: colors.border,
                margin: '4px 0',
              }}
            />
          );
        }

        return (
          <button
            key={i}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px 14px',
              background: 'transparent',
              border: 'none',
              color: item.disabled
                ? colors.textMuted
                : item.danger
                ? colors.error
                : colors.text,
              fontSize: '12px',
              textAlign: 'left',
              cursor: item.disabled ? 'default' : 'pointer',
              opacity: item.disabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                (e.target as HTMLElement).style.background = item.danger
                  ? colors.error + '20'
                  : colors.bg;
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'transparent';
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
