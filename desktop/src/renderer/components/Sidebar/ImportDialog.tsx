import React, { useState, useRef, useCallback } from 'react';
import { useCollectionsStore } from '../../store/collectionsStore';
import { useColors } from '../../styles';

interface ImportDialogProps {
  onClose: () => void;
}

export default function ImportDialog({ onClose }: ImportDialogProps) {
  const colors = useColors();
  const { importCollection } = useCollectionsStore();
  const [pasteValue, setPasteValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processText = useCallback((text: string) => {
    setError('');
    const result = importCollection(text);
    if (result) {
      onClose();
    } else {
      setError('Invalid format. Expected JSON with "name" and "requests" fields.');
    }
  }, [importCollection, onClose]);

  const processFile = useCallback((file: File) => {
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const result = importCollection(reader.result as string);
      if (result) {
        onClose();
      } else {
        setError(`Failed to import "${file.name}". Invalid collection format.`);
      }
    };
    reader.readAsText(file);
  }, [importCollection, onClose]);

  const handlePasteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && pasteValue.trim()) {
      processText(pasteValue.trim());
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      if (files[i].name.endsWith('.json')) {
        processFile(files[i]);
        break;
      }
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].name.endsWith('.json')) {
          processFile(files[i]);
          return;
        }
      }
      setError('Please drop a .json collection file.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.sidebarBg,
          borderRadius: '8px',
          width: '560px',
          maxWidth: '90vw',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '14px',
            background: 'transparent',
            border: 'none',
            color: colors.sidebarTextDim,
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px',
            lineHeight: 1,
            zIndex: 1,
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.color = colors.sidebarText;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.color = colors.sidebarTextDim;
          }}
        >
          ×
        </button>

        {/* Content */}
        <div style={{ padding: '20px 20px 24px' }}>
          {/* Paste input */}
          <input
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              background: colors.sidebarSurface,
              color: colors.sidebarText,
              border: `1px solid ${colors.sidebarBorder}`,
              borderRadius: '4px',
              fontSize: '13px',
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              outline: 'none',
              boxSizing: 'border-box',
            }}
            placeholder="Paste cURL, gRPCurl, Raw text or URL..."
            value={pasteValue}
            onChange={(e) => {
              setPasteValue(e.target.value);
              setError('');
            }}
            onKeyDown={handlePasteKeyDown}
            onFocus={(e) => {
              (e.target as HTMLElement).style.borderColor = colors.accentOrange;
            }}
            onBlur={(e) => {
              (e.target as HTMLElement).style.borderColor = colors.sidebarBorder;
            }}
          />

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              marginTop: '16px',
              border: `2px dashed ${isDragging ? colors.accentOrange : colors.sidebarBorder}`,
              borderRadius: '8px',
              padding: '48px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              transition: 'border-color 0.2s, background 0.2s',
              background: isDragging ? colors.accentOrange + '08' : 'transparent',
              cursor: 'default',
            }}
          >
            {/* Import icon */}
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              stroke={colors.sidebarTextDim}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Document outline */}
              <path d="M12 6h16l10 10v26H12V6z" />
              <path d="M28 6v10h10" />
              {/* Down arrow */}
              <path d="M24 20v16" strokeWidth="2" />
              <path d="M18 30l6 6 6-6" strokeWidth="2" />
            </svg>

            {/* Text */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: colors.sidebarText,
                  marginBottom: '6px',
                }}
              >
                Drop anywhere to import
              </div>
              <div style={{ fontSize: '13px', color: colors.sidebarTextDim }}>
                Or select{' '}
                <span
                  style={{
                    color: '#5b9bd5',
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.textDecoration = 'none';
                  }}
                >
                  files
                </span>
                {' '}or{' '}
                <span
                  style={{
                    color: '#5b9bd5',
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                  onClick={() => folderInputRef.current?.click()}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.textDecoration = 'none';
                  }}
                >
                  folders
                </span>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                marginTop: '12px',
                padding: '8px 12px',
                background: colors.error + '15',
                border: `1px solid ${colors.error}30`,
                borderRadius: '4px',
                fontSize: '12px',
                color: colors.error,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <input
          ref={folderInputRef}
          type="file"
          accept=".json"
          // @ts-ignore — webkitdirectory is not in React types
          webkitdirectory=""
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}
