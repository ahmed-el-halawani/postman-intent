import React from 'react';
import { useTabStore } from '../../store/tabStore';
import { useColors, useStyles } from '../../styles';

export default function UnsavedChangesDialog() {
  const colors = useColors();
  const { accentButton, ghostButton } = useStyles();
  const { confirmDiscardClose, saveAndCloseTab, setShowUnsavedDialog } = useTabStore();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => setShowUnsavedDialog(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '20px',
          width: '340px',
          maxWidth: '90vw',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: colors.text,
            marginBottom: '8px',
          }}
        >
          Unsaved Changes
        </div>
        <div
          style={{
            fontSize: '12px',
            color: colors.textDim,
            marginBottom: '20px',
            lineHeight: 1.5,
          }}
        >
          This tab has unsaved changes. Do you want to save before closing?
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => setShowUnsavedDialog(false)}
            style={{
              ...ghostButton,
              fontSize: '12px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={confirmDiscardClose}
            style={{
              ...ghostButton,
              fontSize: '12px',
              color: colors.textDim,
            }}
          >
            Don&apos;t Save
          </button>
          <button
            onClick={saveAndCloseTab}
            style={{
              ...accentButton,
              fontSize: '12px',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
