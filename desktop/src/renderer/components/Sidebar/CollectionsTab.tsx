import React, { useState } from 'react';
import { useCollectionsStore } from '../../store/collectionsStore';
import { useTabStore } from '../../store/tabStore';
import { colors, ghostButton, label, badge } from '../../styles';
import type { IntentType } from '../../../shared/types';
import ContextMenu, { type ContextMenuEntry } from '../ContextMenu/ContextMenu';

const TYPE_COLORS: Record<IntentType, string> = {
  activity: colors.intentActivity,
  broadcast: colors.intentBroadcast,
  service: colors.intentService,
};

interface MenuState {
  type: 'collection' | 'request' | 'savedResponse';
  collectionId: string;
  requestId?: string;
  responseId?: string;
  position: { x: number; y: number };
}

// Move-to-collection dialog state
interface MoveDialogState {
  fromCollectionId: string;
  requestId: string;
  requestName: string;
}

export default function CollectionsTab() {
  const {
    collections,
    expandedIds,
    toggleExpanded,
    createCollection,
    renameCollection,
    deleteCollection,
    duplicateCollection,
    exportCollection,
    deleteRequest,
    duplicateRequest,
    addBlankRequest,
    moveRequestToCollection,
    renameRequest,
    deleteResponse,
    renameResponse,
  } = useCollectionsStore();

  const { openSavedRequest, createTab, openSavedResponseTab } = useTabStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingRequestId, setRenamingRequestId] = useState<string | null>(null);
  const [renameRequestValue, setRenameRequestValue] = useState('');
  const [renamingCollectionForRequest, setRenamingCollectionForRequest] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [moveDialog, setMoveDialog] = useState<MoveDialogState | null>(null);
  const [expandedRequestIds, setExpandedRequestIds] = useState<Set<string>>(new Set());
  const [renamingResponseId, setRenamingResponseId] = useState<string | null>(null);
  const [renamingResponseCollectionId, setRenamingResponseCollectionId] = useState<string | null>(null);
  const [renamingResponseRequestId, setRenamingResponseRequestId] = useState<string | null>(null);
  const [renameResponseValue, setRenameResponseValue] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    createCollection(newName.trim());
    setNewName('');
    setIsCreating(false);
  };

  const handleRenameCollection = (id: string) => {
    if (!renameValue.trim()) return;
    renameCollection(id, renameValue.trim());
    setRenamingId(null);
  };

  const handleRenameRequest = (collectionId: string, requestId: string) => {
    if (!renameRequestValue.trim()) return;
    renameRequest(collectionId, requestId, renameRequestValue.trim());
    setRenamingRequestId(null);
    setRenamingCollectionForRequest(null);
  };

  const handleDeleteCollection = (id: string, name: string, hasRequests: boolean) => {
    if (hasRequests) {
      if (!window.confirm(`Delete collection "${name}" and all its requests?`)) return;
    }
    deleteCollection(id);
  };

  const handleCollectionContextMenu = (e: React.MouseEvent, collectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({
      type: 'collection',
      collectionId,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleRequestContextMenu = (e: React.MouseEvent, collectionId: string, requestId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({
      type: 'request',
      collectionId,
      requestId,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleRenameResponse = (collectionId: string, requestId: string, responseId: string) => {
    if (!renameResponseValue.trim()) return;
    renameResponse(collectionId, requestId, responseId, renameResponseValue.trim());
    setRenamingResponseId(null);
    setRenamingResponseCollectionId(null);
    setRenamingResponseRequestId(null);
  };

  const handleSavedResponseContextMenu = (
    e: React.MouseEvent,
    collectionId: string,
    requestId: string,
    responseId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({
      type: 'savedResponse',
      collectionId,
      requestId,
      responseId,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const getSavedResponseMenuItems = (collectionId: string, requestId: string, responseId: string): ContextMenuEntry[] => {
    const collection = collections.find((c) => c.id === collectionId);
    const req = collection?.requests.find((r) => r.id === requestId);
    const sr = req?.savedResponses.find((s) => s.id === responseId);
    if (!sr) return [];
    return [
      {
        label: 'Open in New Tab',
        onClick: () => openSavedResponseTab(sr),
      },
      { divider: true },
      {
        label: 'Rename',
        onClick: () => {
          setRenamingResponseId(responseId);
          setRenamingResponseCollectionId(collectionId);
          setRenamingResponseRequestId(requestId);
          setRenameResponseValue(sr.name);
        },
      },
      { divider: true },
      {
        label: 'Delete',
        danger: true,
        onClick: () => deleteResponse(collectionId, requestId, responseId),
      },
    ];
  };

  const getCollectionMenuItems = (collectionId: string): ContextMenuEntry[] => {
    const collection = collections.find((c) => c.id === collectionId);
    if (!collection) return [];
    return [
      {
        label: 'New Request',
        onClick: () => addBlankRequest(collectionId),
      },
      {
        label: 'Open New Tab from Collection',
        onClick: () => {
          const req = collection.requests[0];
          if (req) {
            openSavedRequest(collectionId, req.id, req.name, req.request);
          } else {
            addBlankRequest(collectionId);
          }
        },
      },
      { divider: true },
      {
        label: 'Rename',
        onClick: () => {
          setRenamingId(collectionId);
          setRenameValue(collection.name);
        },
      },
      {
        label: 'Duplicate Collection',
        onClick: () => duplicateCollection(collectionId),
      },
      {
        label: 'Export as JSON',
        onClick: () => exportCollection(collectionId),
      },
      { divider: true },
      {
        label: 'Delete',
        danger: true,
        onClick: () => handleDeleteCollection(collectionId, collection.name, collection.requests.length > 0),
      },
    ];
  };

  const getRequestMenuItems = (collectionId: string, requestId: string): ContextMenuEntry[] => {
    const collection = collections.find((c) => c.id === collectionId);
    const req = collection?.requests.find((r) => r.id === requestId);
    if (!collection || !req) return [];

    const otherCollections = collections.filter((c) => c.id !== collectionId);

    return [
      {
        label: 'Open in New Tab',
        onClick: () => openSavedRequest(collectionId, requestId, req.name, req.request),
      },
      { divider: true },
      {
        label: 'Rename',
        onClick: () => {
          setRenamingRequestId(requestId);
          setRenamingCollectionForRequest(collectionId);
          setRenameRequestValue(req.name);
        },
      },
      {
        label: 'Duplicate',
        onClick: () => duplicateRequest(collectionId, requestId),
      },
      {
        label: 'Move to...',
        disabled: otherCollections.length === 0,
        onClick: () => {
          setMoveDialog({
            fromCollectionId: collectionId,
            requestId,
            requestName: req.name,
          });
        },
      },
      { divider: true },
      {
        label: 'Delete',
        danger: true,
        onClick: () => deleteRequest(collectionId, requestId),
      },
    ];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span style={{ ...label, margin: 0, flex: 1 }}>Collections</span>
        <button
          onClick={() => setIsCreating(true)}
          style={{
            ...ghostButton,
            fontSize: '11px',
            padding: '2px 8px',
          }}
        >
          + New
        </button>
      </div>

      {/* New collection input */}
      {isCreating && (
        <div style={{ padding: '6px 10px', borderBottom: `1px solid ${colors.border}` }}>
          <input
            autoFocus
            style={{
              width: '100%',
              padding: '5px 8px',
              background: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.accent}`,
              borderRadius: '3px',
              fontSize: '11px',
              outline: 'none',
            }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setIsCreating(false);
            }}
            onBlur={() => {
              if (newName.trim()) handleCreate();
              else setIsCreating(false);
            }}
            placeholder="Collection name..."
          />
        </div>
      )}

      {/* Collection tree */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {collections.length === 0 && !isCreating && (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: colors.textMuted }}>
              No collections yet. Click "+ New" to create one.
            </span>
          </div>
        )}

        {collections.map((collection) => {
          const isExpanded = expandedIds.has(collection.id);
          const isRenaming = renamingId === collection.id;

          return (
            <div key={collection.id}>
              {/* Collection header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderBottom: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                }}
                onClick={() => toggleExpanded(collection.id)}
                onContextMenu={(e) => handleCollectionContextMenu(e, collection.id)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = colors.bg;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {/* Chevron */}
                <span
                  style={{
                    fontSize: '10px',
                    color: colors.textDim,
                    transition: 'transform 0.15s',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    display: 'inline-block',
                    width: '12px',
                    textAlign: 'center',
                  }}
                >
                  ▶
                </span>

                {/* Name (editable) */}
                {isRenaming ? (
                  <input
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '2px 4px',
                      background: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.accent}`,
                      borderRadius: '2px',
                      fontSize: '11px',
                      outline: 'none',
                    }}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameCollection(collection.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={() => handleRenameCollection(collection.id)}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      color: colors.text,
                      fontWeight: 600,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(collection.id);
                      setRenameValue(collection.name);
                    }}
                  >
                    {collection.name}
                  </span>
                )}

                {/* Count badge */}
                <span
                  style={{
                    fontSize: '9px',
                    color: colors.textMuted,
                    background: colors.bg,
                    padding: '0 5px',
                    borderRadius: '8px',
                  }}
                >
                  {collection.requests.length}
                </span>
              </div>

              {/* Requests list */}
              {isExpanded && (
                <div style={{ background: colors.bg + '40' }}>
                  {collection.requests.length === 0 && (
                    <div style={{ padding: '8px 10px 8px 28px' }}>
                      <span style={{ fontSize: '10px', color: colors.textMuted, fontStyle: 'italic' }}>
                        Empty — right-click to add a request
                      </span>
                    </div>
                  )}

                  {collection.requests.map((req) => {
                    const isRenamingReq =
                      renamingRequestId === req.id && renamingCollectionForRequest === collection.id;

                    return (
                      <React.Fragment key={req.id}>
                      <div
                        onClick={() =>
                          openSavedRequest(collection.id, req.id, req.name, req.request)
                        }
                        onContextMenu={(e) => handleRequestContextMenu(e, collection.id, req.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 10px 5px 28px',
                          borderBottom: `1px solid ${colors.border}`,
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = colors.bg;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        {/* Type badge */}
                        <span
                          style={{
                            ...badge(TYPE_COLORS[req.request.intentType]),
                            fontSize: '8px',
                            padding: '1px 5px',
                          }}
                        >
                          {req.request.intentType.slice(0, 3)}
                        </span>

                        {/* Request name */}
                        {isRenamingReq ? (
                          <input
                            autoFocus
                            style={{
                              flex: 1,
                              padding: '1px 4px',
                              background: colors.bg,
                              color: colors.text,
                              border: `1px solid ${colors.accent}`,
                              borderRadius: '2px',
                              fontSize: '11px',
                              outline: 'none',
                            }}
                            value={renameRequestValue}
                            onChange={(e) => setRenameRequestValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameRequest(collection.id, req.id);
                              if (e.key === 'Escape') {
                                setRenamingRequestId(null);
                                setRenamingCollectionForRequest(null);
                              }
                            }}
                            onBlur={() => handleRenameRequest(collection.id, req.id)}
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              color: colors.text,
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setRenamingRequestId(req.id);
                              setRenamingCollectionForRequest(collection.id);
                              setRenameRequestValue(req.name);
                            }}
                          >
                            {req.name}
                          </span>
                        )}

                        {/* Saved responses expand toggle */}
                        {req.savedResponses && req.savedResponses.length > 0 && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRequestIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(req.id)) next.delete(req.id);
                                else next.add(req.id);
                                return next;
                              });
                            }}
                            style={{
                              fontSize: '9px',
                              color: colors.success,
                              opacity: 0.7,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                            title={`${req.savedResponses.length} saved response(s) — click to expand`}
                          >
                            <span style={{
                              display: 'inline-block',
                              transform: expandedRequestIds.has(req.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.15s',
                              fontSize: '8px',
                            }}>▶</span>
                            {req.savedResponses.length}R
                          </span>
                        )}
                      </div>

                      {/* Expanded saved responses sub-items */}
                      {expandedRequestIds.has(req.id) && req.savedResponses && req.savedResponses.length > 0 && (
                        <div style={{ background: colors.bg + '60' }}>
                          {req.savedResponses.map((sr) => {
                            const isRenamingSr =
                              renamingResponseId === sr.id &&
                              renamingResponseCollectionId === collection.id &&
                              renamingResponseRequestId === req.id;

                            return (
                              <div
                                key={sr.id}
                                onClick={() => openSavedResponseTab(sr)}
                                onContextMenu={(e) => handleSavedResponseContextMenu(e, collection.id, req.id, sr.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '7px 10px 7px 44px',
                                  borderBottom: `1px solid ${colors.border}`,
                                  fontSize: '11px',
                                  color: colors.textDim,
                                  cursor: 'pointer',
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = colors.bg;
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                                }}
                              >
                                {/* Status dot */}
                                <span
                                  style={{
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    background: sr.response.error ? colors.error : colors.success,
                                    flexShrink: 0,
                                  }}
                                />

                                {/* Response name — editable on double-click */}
                                {isRenamingSr ? (
                                  <input
                                    autoFocus
                                    style={{
                                      flex: 1,
                                      padding: '2px 4px',
                                      background: colors.bg,
                                      color: colors.text,
                                      border: `1px solid ${colors.accent}`,
                                      borderRadius: '2px',
                                      fontSize: '11px',
                                      outline: 'none',
                                    }}
                                    value={renameResponseValue}
                                    onChange={(e) => setRenameResponseValue(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameResponse(collection.id, req.id, sr.id);
                                      if (e.key === 'Escape') {
                                        setRenamingResponseId(null);
                                        setRenamingResponseCollectionId(null);
                                        setRenamingResponseRequestId(null);
                                      }
                                    }}
                                    onBlur={() => handleRenameResponse(collection.id, req.id, sr.id)}
                                  />
                                ) : (
                                  <span
                                    style={{
                                      flex: 1,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      color: colors.text,
                                    }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setRenamingResponseId(sr.id);
                                      setRenamingResponseCollectionId(collection.id);
                                      setRenamingResponseRequestId(req.id);
                                      setRenameResponseValue(sr.name);
                                    }}
                                  >
                                    {sr.name}
                                  </span>
                                )}

                                {/* Activity result indicator */}
                                {sr.activityResult && (
                                  <span
                                    style={{
                                      fontSize: '9px',
                                      color: colors.warning,
                                      fontWeight: 600,
                                      opacity: 0.8,
                                      padding: '0 4px',
                                      background: colors.warning + '15',
                                      borderRadius: '3px',
                                    }}
                                    title="Includes activity result"
                                  >
                                    AR
                                  </span>
                                )}

                                {/* Time */}
                                {sr.responseTime != null && (
                                  <span style={{ fontSize: '10px', color: colors.textMuted }}>
                                    {sr.responseTime}ms
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {menuState && (
        <ContextMenu
          items={
            menuState.type === 'collection'
              ? getCollectionMenuItems(menuState.collectionId)
              : menuState.type === 'savedResponse'
              ? getSavedResponseMenuItems(menuState.collectionId, menuState.requestId!, menuState.responseId!)
              : getRequestMenuItems(menuState.collectionId, menuState.requestId!)
          }
          position={menuState.position}
          onClose={() => setMenuState(null)}
        />
      )}

      {/* Move to Collection Dialog */}
      {moveDialog && (
        <MoveToCollectionDialog
          fromCollectionId={moveDialog.fromCollectionId}
          requestId={moveDialog.requestId}
          requestName={moveDialog.requestName}
          collections={collections}
          onMove={(toCollectionId) => {
            moveRequestToCollection(moveDialog.fromCollectionId, toCollectionId, moveDialog.requestId);
            setMoveDialog(null);
          }}
          onClose={() => setMoveDialog(null)}
        />
      )}
    </div>
  );
}

// ── Move to Collection Dialog ────────────────────────────────

function MoveToCollectionDialog({
  fromCollectionId,
  requestId,
  requestName,
  collections,
  onMove,
  onClose,
}: {
  fromCollectionId: string;
  requestId: string;
  requestName: string;
  collections: Array<{ id: string; name: string }>;
  onMove: (toCollectionId: string) => void;
  onClose: () => void;
}) {
  const otherCollections = collections.filter((c) => c.id !== fromCollectionId);
  const [selected, setSelected] = useState(otherCollections[0]?.id || '');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2500,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '20px',
          width: '320px',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 700, color: colors.text, marginBottom: '12px' }}>
          Move "{requestName}"
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: colors.textDim, marginBottom: '4px', textTransform: 'uppercase' }}>
            Move to collection
          </div>
          <select
            style={{
              width: '100%',
              padding: '7px 10px',
              background: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '4px',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {otherCollections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              border: `1px solid ${colors.border}`,
              borderRadius: '4px',
              background: 'transparent',
              color: colors.textDim,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onMove(selected)}
            disabled={!selected}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: '4px',
              background: colors.accent,
              color: colors.white,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: selected ? 1 : 0.5,
            }}
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
