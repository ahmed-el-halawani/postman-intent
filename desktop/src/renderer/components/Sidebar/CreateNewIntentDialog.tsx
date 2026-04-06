import React, { useState } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useColors } from '../../styles';
import type { IntentType } from '../../../shared/types';

interface CreateNewIntentDialogProps {
  onClose: () => void;
}

interface IntentCard {
  type: IntentType;
  label: string;
  description: string;
  iconBg: string;
  icon: React.ReactNode;
}

const INTENT_CARDS: IntentCard[] = [
  {
    type: 'activity',
    label: 'ACTIVITY',
    description: 'Immediate, UI-focused execution for user-facing transitions and interactions.',
    iconBg: '#ffdbd0',
    icon: (
      <svg width="20" height="25" viewBox="0 0 20 25" fill="none">
        <path
          d="M11.5 1L1 14.5H10L8.5 24L19 10.5H10L11.5 1Z"
          fill="#ea580c"
          stroke="#ea580c"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    type: 'broadcast',
    label: 'BROADCAST',
    description: 'Asynchronous messaging system for global state updates across multiple listeners.',
    iconBg: '#d7e2ff',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4.5 16.5C2.5 14.5 2.5 7.5 4.5 5.5" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7.5 14C6 12.5 6 9.5 7.5 8" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="11" cy="11" r="2" fill="#2563eb" />
        <path d="M14.5 8C16 9.5 16 12.5 14.5 14" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17.5 5.5C19.5 7.5 19.5 14.5 17.5 16.5" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: 'service',
    label: 'SERVICE',
    description: 'Persistent background operations for continuous data processing and monitoring.',
    iconBg: '#e5e2e1',
    icon: (
      <svg width="26" height="25" viewBox="0 0 26 25" fill="none">
        <circle cx="13" cy="12.5" r="4" stroke="#594139" strokeWidth="1.8" />
        <path
          d="M13 3.5v2M13 19.5v2M4.5 12.5h2M19.5 12.5h2M6.5 6l1.4 1.4M18.1 16.1l1.4 1.4M6.5 19l1.4-1.4M18.1 8.9l1.4-1.4"
          stroke="#594139"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function CreateNewIntentDialog({ onClose }: CreateNewIntentDialogProps) {
  const colors = useColors();
  const [selectedType, setSelectedType] = useState<IntentType>('activity');
  const { createTab } = useTabStore();

  const handleContinue = () => {
    const newRequest = {
      intentType: selectedType,
      action: '',
      component: '',
      data: '',
      mimeType: '',
      flags: [],
      categories: [],
      forResult: false,
      extras: [],
    };
    createTab(`New ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}`, newRequest);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(25, 28, 29, 0.2)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 3000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          borderRadius: '32px',
          maxWidth: '768px',
          width: '100%',
          boxShadow: '0px 32px 64px rgba(25, 28, 29, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '40px 40px 24px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '30px',
                fontWeight: 800,
                color: '#191c1d',
                letterSpacing: '-1.5px',
                lineHeight: '30px',
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
              }}
            >
              Create New Intent
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 500,
                color: '#5f5e5e',
                lineHeight: '20px',
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
              }}
            >
              Select the foundation for your new technical protocol
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              color: '#191c1d',
              fontSize: '20px',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Modal Grid Content — 3 cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
            padding: '24px 40px',
          }}
        >
          {INTENT_CARDS.map((card) => {
            const isSelected = selectedType === card.type;
            return (
              <button
                key={card.type}
                onClick={() => setSelectedType(card.type)}
                style={{
                  background: '#ffffff',
                  border: isSelected ? `2px solid ${colors.accent}` : '2px solid transparent',
                  borderRadius: '24px',
                  padding: '32px 32px 40px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  boxShadow: isSelected
                    ? `0px 4px 12px rgba(0,0,0,0.03), 0 0 0 1px ${colors.accent}20`
                    : '0px 4px 12px rgba(0,0,0,0.03)',
                  transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.borderColor = '#d0d0d0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                  }
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: card.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '24px',
                    flexShrink: 0,
                  }}
                >
                  {card.icon}
                </div>

                {/* Title */}
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#191c1d',
                    textTransform: 'uppercase',
                    letterSpacing: '2.1px',
                    lineHeight: '20px',
                    textAlign: 'center',
                    fontFamily: "'Inter', 'Segoe UI', sans-serif",
                  }}
                >
                  {card.label}
                </div>

                {/* Description */}
                <p
                  style={{
                    margin: 0,
                    marginTop: '15px',
                    fontSize: '11px',
                    fontWeight: 400,
                    color: '#5f5e5e',
                    lineHeight: '17.88px',
                    textAlign: 'center',
                    fontFamily: "'Inter', 'Segoe UI', sans-serif",
                  }}
                >
                  {card.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '16px',
            padding: '40px',
          }}
        >
          {/* Cancel */}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '14px',
              fontWeight: 700,
              color: '#594139',
              cursor: 'pointer',
              padding: '12px 24px',
              borderRadius: '8px',
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              letterSpacing: '-0.35px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            Cancel
          </button>

          {/* Continue Configuration */}
          <button
            onClick={handleContinue}
            style={{
              background: colors.accent,
              border: 'none',
              fontSize: '14px',
              fontWeight: 700,
              color: colors.white,
              cursor: 'pointer',
              padding: '12px 24px',
              borderRadius: '8px',
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              letterSpacing: '-0.35px',
              transition: 'background 0.15s, transform 0.1s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = colors.accentHover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = colors.accent;
            }}
          >
            Continue Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
