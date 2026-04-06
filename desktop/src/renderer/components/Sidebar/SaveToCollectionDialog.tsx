import React, { useState } from 'react';
import { useCollectionsStore } from '../../store/collectionsStore';
import { useTabStore } from '../../store/tabStore';
import { useColors, useStyles } from '../../styles';

export default function SaveToCollectionDialog() {
  const colors = useColors();
  const { monoInput, accentButton, ghostButton, label } = useStyles();
  const { collections, createCollection, addRequest } = useCollectionsStore();
  const { getActiveTab, setShowSaveDialog, tabs, activeTabId } = useTabStore();

  const tab = getActiveTab();
  const [requestName, setRequestName] = useState(
    tab?.request.action || tab?.request.component || 'Untitled Request'
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    collections.length > 0 ? collections[0].id : ''
  );
  const [isCreatingCollection, setIsCreatingCollection] = useState(collections.length === 0);
  const [newCollectionName, setNewCollectionName] = useState('');

  const handleSave = () => {
    if (!requestName.trim()) return;

    let collectionId = selectedCollectionId;

    if (isCreatingCollection) {
      if (!newCollectionName.trim()) return;
      collectionId = createCollection(newCollectionName.trim());
    }

    if (!collectionId || !tab) return;

    addRequest(collectionId, requestName.trim(), tab.request);

    // Update the tab to link to the saved request
    const store = useTabStore.getState();
    const collection = useCollectionsStore.getState().collections.find((c) => c.id === collectionId);
    if (collection) {
      const saved = collection.requests[collection.requests.length - 1];
      useTabStore.setState({
        tabs: store.tabs.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                name: requestName.trim(),
                savedRequestRef: { collectionId, requestId: saved.id },
                isDirty: false,
              }
            : t
        ),
      });
    }

    setShowSaveDialog(false);
  };

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
      onClick={() => setShowSaveDialog(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '20px',
          width: '380px',
          maxWidth: '90vw',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: colors.text,
            marginBottom: '16px',
          }}
        >
          Save to Collection
        </div>

        {/* Request name */}
        <div style={{ marginBottom: '12px' }}>
          <div style={label}>Request Name</div>
          <input
            autoFocus
            style={monoInput}
            value={requestName}
            onChange={(e) => setRequestName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="My Request"
          />
        </div>

        {/* Collection selector */}
        <div style={{ marginBottom: '16px' }}>
          <div style={label}>Collection</div>

          {!isCreatingCollection && collections.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <select
                style={{
                  ...monoInput,
                  cursor: 'pointer',
                }}
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.requests.length} requests)
                  </option>
                ))}
              </select>
              <button
                onClick={() => setIsCreatingCollection(true)}
                style={{
                  ...ghostButton,
                  fontSize: '11px',
                  padding: '4px 8px',
                  alignSelf: 'flex-start',
                }}
              >
                + New Collection
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                style={monoInput}
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="New collection name..."
              />
              {collections.length > 0 && (
                <button
                  onClick={() => setIsCreatingCollection(false)}
                  style={{
                    ...ghostButton,
                    fontSize: '11px',
                    padding: '4px 8px',
                    alignSelf: 'flex-start',
                  }}
                >
                  Use Existing
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => setShowSaveDialog(false)}
            style={{
              ...ghostButton,
              fontSize: '12px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
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
