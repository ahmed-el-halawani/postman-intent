import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useColors } from '../styles';

/* ── Types ─────────────────────────────────────────────────── */

interface MatchInfo {
  path: string;
  type: 'key' | 'value';
  index: number;
}

/* ── Helpers ───────────────────────────────────────────────── */

function getParentPaths(path: string): string[] {
  const parents: string[] = [];
  let current = path;
  while (current) {
    const arrMatch = current.match(/^(.*)\[(\d+)\]$/);
    if (arrMatch) {
      current = arrMatch[1];
      parents.push(current);
      continue;
    }
    const lastDot = current.lastIndexOf('.');
    if (lastDot > 0) {
      current = current.slice(0, lastDot);
      parents.push(current);
      continue;
    }
    break;
  }
  return parents;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchPattern(query: string, isRegex: boolean): RegExp | null {
  if (!query) return null;
  try {
    if (isRegex) return new RegExp(query, 'gi');
    return new RegExp(escapeRegExp(query), 'gi');
  } catch {
    return null;
  }
}

function getValueType(value: unknown): 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  return 'object';
}

function valueToString(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return String(value);
}

function getValueAtPath(data: unknown, path: string): unknown {
  if (!path) return data;
  let current: unknown = data;
  // Split path by dots, but preserve array indices like foo[0]
  const tokens: string[] = [];
  let remaining = path;
  while (remaining) {
    const dotIdx = remaining.indexOf('.');
    const bracketIdx = remaining.indexOf('[');
    if (dotIdx === -1 && bracketIdx === -1) {
      tokens.push(remaining);
      break;
    }
    if (dotIdx !== -1 && (bracketIdx === -1 || dotIdx < bracketIdx)) {
      tokens.push(remaining.slice(0, dotIdx));
      remaining = remaining.slice(dotIdx + 1);
    } else {
      tokens.push(remaining.slice(0, bracketIdx));
      remaining = remaining.slice(bracketIdx);
      const closeIdx = remaining.indexOf(']');
      if (closeIdx !== -1) {
        tokens.push(remaining.slice(1, closeIdx));
        remaining = remaining.slice(closeIdx + 1);
        if (remaining.startsWith('.')) remaining = remaining.slice(1);
      }
    }
  }

  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      current = current[Number(token)];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[token];
    } else {
      return undefined;
    }
  }
  return current;
}

function collectAllPaths(value: unknown, prefix = ''): string[] {
  const paths: string[] = [];
  if (Array.isArray(value)) {
    if (value.length > 0) {
      paths.push(prefix);
      value.forEach((item, i) => paths.push(...collectAllPaths(item, `${prefix}[${i}]`)));
    }
  } else if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    if (entries.length > 0) {
      paths.push(prefix);
      entries.forEach(([k, v]) => paths.push(...collectAllPaths(v, prefix ? `${prefix}.${k}` : k)));
    }
  }
  return paths;
}

function decodeHtmlEntities(str: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

function decodeEntitiesInData(data: unknown): unknown {
  if (typeof data === 'string') return decodeHtmlEntities(data);
  if (Array.isArray(data)) return data.map(decodeEntitiesInData);
  if (data !== null && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = decodeEntitiesInData(value);
    }
    return result;
  }
  return data;
}

/* ── Highlight Text Component ──────────────────────────────── */

function HighlightText({ text, pattern, isActive }: { text: string; pattern: RegExp | null; isActive: boolean }) {
  const colors = useColors();
  if (!pattern) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;
  let match;

  pattern.lastIndex = 0;

  while ((match = pattern.exec(remaining)) !== null) {
    if (match.index > 0) parts.push(<span key={idx++}>{remaining.slice(0, match.index)}</span>);
    parts.push(
      <mark
        key={idx++}
        style={{
          background: isActive ? colors.accentOrange : colors.accentOrange + '40',
          color: isActive ? colors.white : 'inherit',
          borderRadius: '2px',
          padding: '0 1px',
        }}
      >
        {match[0]}
      </mark>
    );
    remaining = remaining.slice(match.index + match[0].length);
    pattern.lastIndex = 0;
  }

  if (remaining) parts.push(<span key={idx++}>{remaining}</span>);
  return <>{parts}</>;
}

/* ── Json Node Component ───────────────────────────────────── */

function JsonNode({
  path,
  data,
  propertyKey,
  isLast,
  expandedPaths,
  togglePath,
  expandedStrings,
  toggleString,
  pattern,
  matchMap,
  activeMatchIndex,
  matchRefs,
}: {
  path: string;
  data: unknown;
  propertyKey?: string;
  isLast?: boolean;
  expandedPaths: Set<string>;
  togglePath: (p: string) => void;
  expandedStrings: Set<string>;
  toggleString: (p: string) => void;
  pattern: RegExp | null;
  matchMap: Map<string, number[]>;
  activeMatchIndex: number;
  matchRefs: React.MutableRefObject<Map<number, HTMLSpanElement>>;
}) {
  const colors = useColors();
  const type = getValueType(data);
  const isExpandable = type === 'array' || type === 'object';
  const isExpanded = expandedPaths.has(path);

  const matchesAtPath = matchMap.get(path) || [];

  const valueColor =
    type === 'string' ? colors.codeGreen :
    type === 'number' ? colors.codeAmber :
    type === 'boolean' ? colors.codePink :
    type === 'null' ? colors.codePurple :
    colors.textSecondary;

  const count = isExpandable
    ? Array.isArray(data) ? data.length : typeof data === 'object' && data !== null ? Object.keys(data).length : 0
    : 0;

  const isEmpty = count === 0;

  // ── Row layout helper ──
  const Row = ({ children, onToggle, isCollapsed }: { children: React.ReactNode; onToggle?: () => void; isCollapsed?: boolean }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', lineHeight: '22px' }}>
      <span
        onClick={onToggle}
        style={{
          cursor: onToggle ? 'pointer' : 'default',
          userSelect: 'none',
          color: colors.textDim,
          fontSize: '10px',
          width: '16px',
          minWidth: '16px',
          textAlign: 'center',
          display: 'inline-block',
          marginTop: '1px',
        }}
      >
        {onToggle ? (isCollapsed ? '▶' : '▼') : ''}
      </span>
      {children}
    </div>
  );

  // ── Render key with highlighting ──
  const renderKey = () => {
    if (propertyKey === undefined) return null;
    const isMatch = pattern ? pattern.test(propertyKey) : false;
    const isActiveMatch = matchesAtPath.includes(activeMatchIndex) && isMatch;

    return (
      <span
        ref={(el) => { if (el && isMatch) { const mi = matchMap.get(path)?.find((i) => i === activeMatchIndex); if (mi !== undefined) matchRefs.current.set(mi, el); }}}
        style={{ color: colors.codeCyan, flexShrink: 0 }}
      >
        {pattern && isMatch ? (
          <HighlightText text={`"${propertyKey}"`} pattern={pattern} isActive={isActiveMatch} />
        ) : (
          `"${propertyKey}"`
        )}
      </span>
    );
  };

  // ── Render primitive value ──
  const renderPrimitive = () => {
    if (type === 'string') {
      const str = data as string;
      const isExpanded = expandedStrings.has(path);
      const isTruncated = str.length > 120 && !isExpanded;
      const displayStr = isTruncated ? str.slice(0, 120) : str;
      const isValueMatch = pattern ? pattern.test(str) : false;
      const isActiveMatch = matchesAtPath.includes(activeMatchIndex) && isValueMatch;
      const canToggle = str.length > 120;

      return (
        <span
          ref={(el) => { if (el && isValueMatch) { const mi = matchMap.get(path)?.find((i) => i === activeMatchIndex); if (mi !== undefined) matchRefs.current.set(mi, el); }}}
        >
          <span
            onClick={canToggle ? () => toggleString(path) : undefined}
            style={{
              color: colors.codeGreen,
              cursor: canToggle ? 'pointer' : 'default',
            }}
            title={canToggle ? (isExpanded ? 'Click to collapse' : 'Click to expand') : undefined}
          >
            {pattern && isValueMatch ? (
              <HighlightText text={`"${displayStr}"`} pattern={pattern} isActive={isActiveMatch} />
            ) : (
              `"${displayStr}"`
            )}
          </span>
          {isTruncated && (
            <span
              onClick={() => toggleString(path)}
              style={{ color: colors.accentOrange, cursor: 'pointer', fontSize: '11px', marginLeft: '4px' }}
            >
              ... show {str.length - 120} more
            </span>
          )}
        </span>
      );
    }

    if (type === 'null') return <span style={{ color: colors.codePurple }}>null</span>;

    const valStr = String(data);
    const isValueMatch = pattern ? pattern.test(valStr) : false;
    const isActiveMatch = matchesAtPath.includes(activeMatchIndex) && isValueMatch;

    return (
      <span
        ref={(el) => { if (el && isValueMatch) { const mi = matchMap.get(path)?.find((i) => i === activeMatchIndex); if (mi !== undefined) matchRefs.current.set(mi, el); }}}
        style={{ color: valueColor }}
      >
        {pattern && isValueMatch ? (
          <HighlightText text={valStr} pattern={pattern} isActive={isActiveMatch} />
        ) : (
          valStr
        )}
      </span>
    );
  };

  // ── Collapsed expandable ──
  if (isExpandable && !isExpanded) {
    return (
      <Row onToggle={() => togglePath(path)} isCollapsed={true}>
        {propertyKey !== undefined && (
          <>
            {renderKey()}
            <span style={{ color: colors.textSecondary, marginRight: '4px' }}>: </span>
          </>
        )}
        <span
          onClick={() => togglePath(path)}
          style={{ color: colors.textSecondary, cursor: 'pointer', userSelect: 'none' }}
          title="Click to expand"
        >
          {Array.isArray(data) ? `[${isEmpty ? '' : ' ... '}]` : `{${isEmpty ? '' : ' ... '}}`}
        </span>
        {!isEmpty && (
          <span onClick={() => togglePath(path)} style={{ color: colors.textMuted, fontSize: '11px', marginLeft: '8px', cursor: 'pointer', userSelect: 'none' }}>
            {Array.isArray(data) ? `${count} items` : `${count} props`}
          </span>
        )}
        {isLast === false && <span style={{ color: colors.textSecondary, marginLeft: '2px' }}>,</span>}
      </Row>
    );
  }

  // ── Empty expandable ──
  if (isExpandable && isExpanded && isEmpty) {
    return (
      <Row onToggle={() => togglePath(path)} isCollapsed={false}>
        {propertyKey !== undefined && (
          <>
            {renderKey()}
            <span style={{ color: colors.textSecondary, marginRight: '4px' }}>: </span>
          </>
        )}
        <span style={{ color: colors.textSecondary }}>{Array.isArray(data) ? '[]' : '{}'}</span>
        {isLast === false && <span style={{ color: colors.textSecondary, marginLeft: '2px' }}>,</span>}
      </Row>
    );
  }

  // ── Expanded expandable ──
  if (isExpandable && isExpanded && !isEmpty) {
    const bracketOpen = Array.isArray(data) ? '[' : '{';
    const bracketClose = Array.isArray(data) ? ']' : '}';

    return (
      <div>
        <Row onToggle={() => togglePath(path)} isCollapsed={false}>
          {propertyKey !== undefined && (
            <>
              {renderKey()}
              <span style={{ color: colors.textSecondary, marginRight: '4px' }}>: </span>
            </>
          )}
          <span style={{ color: colors.textSecondary }}>{bracketOpen}</span>
        </Row>

        <div style={{ paddingLeft: '16px' }}>
          {Array.isArray(data)
            ? data.map((item, i) => (
                <JsonNode
                  key={i}
                  path={`${path}[${i}]`}
                  data={item}
                  isLast={i === data.length - 1}
                  expandedPaths={expandedPaths}
                  togglePath={togglePath}
                  expandedStrings={expandedStrings}
                  toggleString={toggleString}
                  pattern={pattern}
                  matchMap={matchMap}
                  activeMatchIndex={activeMatchIndex}
                  matchRefs={matchRefs}
                />
              ))
            : typeof data === 'object' && data !== null
            ? Object.entries(data).map(([key, value], i, arr) => (
                <JsonNode
                  key={key}
                  path={path ? `${path}.${key}` : key}
                  data={value}
                  propertyKey={key}
                  isLast={i === arr.length - 1}
                  expandedPaths={expandedPaths}
                  togglePath={togglePath}
                  expandedStrings={expandedStrings}
                  toggleString={toggleString}
                  pattern={pattern}
                  matchMap={matchMap}
                  activeMatchIndex={activeMatchIndex}
                  matchRefs={matchRefs}
                />
              ))
            : null}
        </div>

        <Row>
          <span style={{ color: colors.textSecondary }}>{bracketClose}</span>
          {isLast === false && <span style={{ color: colors.textSecondary, marginLeft: '2px' }}>,</span>}
        </Row>
      </div>
    );
  }

  // ── Primitive ──
  return (
    <Row>
      {propertyKey !== undefined && (
        <>
          {renderKey()}
          <span style={{ color: colors.textSecondary, marginRight: '4px' }}>: </span>
        </>
      )}
      {renderPrimitive()}
      {isLast === false && <span style={{ color: colors.textSecondary, marginLeft: '2px' }}>,</span>}
    </Row>
  );
}

/* ── SearchableJsonTree ────────────────────────────────────── */

export default function SearchableJsonTree({ data }: { data: unknown }) {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [expandedStrings, setExpandedStrings] = useState<Set<string>>(new Set());
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const matchRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const initialExpandDone = useRef(false);

  const cleanData = useMemo(() => decodeEntitiesInData(data), [data]);

  const pattern = useMemo(() => buildSearchPattern(searchQuery, isRegex), [searchQuery, isRegex]);

  // Auto-expand all paths on first mount
  useEffect(() => {
    if (initialExpandDone.current) return;
    initialExpandDone.current = true;
    const allPaths = collectAllPaths(cleanData);
    setExpandedPaths(new Set(allPaths));
  }, [cleanData]);

  // Compute all matches
  const { matchList, matchMap } = useMemo(() => {
    const matches: MatchInfo[] = [];
    const map = new Map<string, number[]>();
    if (!pattern) return { matchList: matches, matchMap: map };

    const pat = pattern;

    function scan(path: string, key: string | undefined, value: unknown) {
      if (key !== undefined) {
        pat.lastIndex = 0;
        if (pat.test(key)) {
          const idx = matches.length;
          matches.push({ path, type: 'key', index: idx });
          if (!map.has(path)) map.set(path, []);
          map.get(path)!.push(idx);
        }
      }

      const valStr = valueToString(value);
      pat.lastIndex = 0;
      if (pat.test(valStr)) {
        const idx = matches.length;
        matches.push({ path, type: 'value', index: idx });
        if (!map.has(path)) map.set(path, []);
        map.get(path)!.push(idx);
      }

      if (Array.isArray(value)) {
        value.forEach((item, i) => scan(`${path}[${i}]`, undefined, item));
      } else if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([k, v]) => scan(path ? `${path}.${k}` : k, k, v));
      }
    }

    scan('', undefined, cleanData);
    return { matchList: matches, matchMap: map };
  }, [cleanData, pattern]);

  // Auto-expand paths and truncated strings that contain matches
  useEffect(() => {
    matchRefs.current.clear();

    // Auto-expand truncated strings that contain matches
    const stringsToExpand = new Set<string>();
    matchList.forEach((m) => {
      if (m.type === 'value') {
        const val = getValueAtPath(cleanData, m.path);
        if (typeof val === 'string' && val.length > 120) {
          stringsToExpand.add(m.path);
        }
      }
    });
    if (stringsToExpand.size > 0) {
      setExpandedStrings((prev) => {
        const next = new Set(prev);
        stringsToExpand.forEach((p) => next.add(p));
        return next;
      });
    }

    if (matchList.length === 0) {
      setActiveMatchIndex(0);
      return;
    }
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      matchList.forEach((m) => getParentPaths(m.path).forEach((p) => next.add(p)));
      return next;
    });
    setActiveMatchIndex(0);
  }, [matchList, cleanData]);

  // Scroll active match into view
  useEffect(() => {
    const el = matchRefs.current.get(activeMatchIndex);
    if (el && document.contains(el) && containerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeMatchIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
      if (e.key === 'Enter' && matchList.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          setActiveMatchIndex((prev) => (prev - 1 + matchList.length) % matchList.length);
        } else {
          setActiveMatchIndex((prev) => (prev + 1) % matchList.length);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, matchList.length]);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleString = useCallback((path: string) => {
    setExpandedStrings((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedPaths(new Set(collectAllPaths(cleanData)));
  }, [cleanData]);

  const collapseAll = useCallback(() => setExpandedPaths(new Set()), []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(cleanData, null, 2));
  }, [cleanData]);

  const matchCountText =
    matchList.length === 0
      ? searchQuery ? 'No matches' : ''
      : matchList.length === 1
      ? '1 match'
      : `${matchList.length} matches`;

  const isInvalidRegex = isRegex && searchQuery && !pattern;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: `1px solid ${colors.borderLight}`, background: colors.surface, flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: colors.textMuted, fontSize: '12px', pointerEvents: 'none' }}>🔍</span>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search JSON..."
            style={{ width: '100%', padding: '5px 8px 5px 28px', background: colors.surfaceLight, color: colors.text, border: `1px solid ${isInvalidRegex ? colors.error : colors.border}`, borderRadius: '4px', fontSize: '12px', fontFamily: "'Inter', 'Segoe UI', sans-serif", outline: 'none' }}
          />
        </div>

        {matchCountText && (
          <span style={{ fontSize: '11px', color: matchList.length > 0 ? colors.textDim : colors.textMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>{matchCountText}</span>
        )}

        <button onClick={() => setIsRegex(!isRegex)} title={isRegex ? 'Regex ON' : 'Regex OFF'} style={{ padding: '4px 8px', background: isRegex ? colors.accentOrange + '20' : 'transparent', color: isRegex ? colors.accentOrange : colors.textMuted, border: `1px solid ${isRegex ? colors.accentOrange : colors.border}`, borderRadius: '3px', fontSize: '11px', fontFamily: "'Consolas', monospace", cursor: 'pointer', fontWeight: isRegex ? 700 : 400 }}>.*</button>

        <span style={{ fontSize: '10px', color: colors.textMuted, border: `1px solid ${colors.border}`, borderRadius: '3px', padding: '2px 5px', fontFamily: "'Consolas', monospace" }}>⌘F</span>

        <div style={{ flex: 1 }} />

        {matchList.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: colors.textDim, marginRight: '4px' }}>{activeMatchIndex + 1} / {matchList.length}</span>
            <button onClick={() => setActiveMatchIndex((prev) => (prev - 1 + matchList.length) % matchList.length)} style={{ padding: '3px 6px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '3px', color: colors.textDim, fontSize: '11px', cursor: 'pointer' }} title="Previous (Shift+Enter)">▲</button>
            <button onClick={() => setActiveMatchIndex((prev) => (prev + 1) % matchList.length)} style={{ padding: '3px 6px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '3px', color: colors.textDim, fontSize: '11px', cursor: 'pointer' }} title="Next (Enter)">▼</button>
          </div>
        )}

        <button onClick={expandAll} title="Expand all" style={{ padding: '4px 6px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '3px', color: colors.textDim, fontSize: '11px', cursor: 'pointer' }}>⤢</button>
        <button onClick={collapseAll} title="Collapse all" style={{ padding: '4px 6px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '3px', color: colors.textDim, fontSize: '11px', cursor: 'pointer' }}>⤡</button>
        <button onClick={handleCopy} title="Copy JSON" style={{ padding: '4px 6px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '3px', color: colors.textDim, fontSize: '11px', cursor: 'pointer' }}>📋</button>
      </div>

      {/* JSON Tree */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', padding: '12px 16px', background: colors.codeBg, fontFamily: "'Consolas', 'Courier New', monospace", fontSize: '13px' }}>
        <JsonNode
          path=""
          data={cleanData}
          expandedPaths={expandedPaths}
          togglePath={togglePath}
          expandedStrings={expandedStrings}
          toggleString={toggleString}
          pattern={pattern}
          matchMap={matchMap}
          activeMatchIndex={activeMatchIndex}
          matchRefs={matchRefs}
        />
      </div>
    </div>
  );
}
