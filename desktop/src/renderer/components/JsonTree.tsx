import React from 'react';
import { useColors } from '../styles';

export default function JsonTree({ data, indent = 0 }: { data: unknown; indent?: number }) {
  const colors = useColors();
  const pad = '  '.repeat(indent);

  if (data === null) return <span style={{ color: colors.textMuted }}>null</span>;
  if (data === undefined) return <span style={{ color: colors.textMuted }}>undefined</span>;

  if (typeof data === 'string') {
    return <span style={{ color: colors.codeString }}>"{data}"</span>;
  }
  if (typeof data === 'number') {
    return <span style={{ color: colors.codeNumber }}>{data}</span>;
  }
  if (typeof data === 'boolean') {
    return <span style={{ color: colors.codeBool }}>{String(data)}</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span>{'[]'}</span>;
    return (
      <span>
        {'[\n'}
        {data.map((item, i) => (
          <span key={i}>
            {pad}  <JsonTree data={item} indent={indent + 1} />
            {i < data.length - 1 ? ',' : ''}
            {'\n'}
          </span>
        ))}
        {pad}{']'}
      </span>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span>{'{}'}</span>;
    return (
      <span>
        {'{\n'}
        {entries.map(([key, value], i) => (
          <span key={key}>
            {pad}  <span style={{ color: colors.codeKey }}>"{key}"</span>: <JsonTree data={value} indent={indent + 1} />
            {i < entries.length - 1 ? ',' : ''}
            {'\n'}
          </span>
        ))}
        {pad}{'}'}
      </span>
    );
  }

  return <span>{String(data)}</span>;
}
