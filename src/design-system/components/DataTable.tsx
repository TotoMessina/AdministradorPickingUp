import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, PackageX, Loader2 } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  mobileCardRender?: (row: T) => React.ReactNode;
  style?: React.CSSProperties;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay registros disponibles',
  onRowClick,
  mobileCardRender,
  style
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [data, sortKey, sortOrder]);

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        borderRadius: 'var(--ds-radius-lg, 0.75rem)',
        border: '1px solid var(--border-light)',
        background: 'var(--bg-surface)',
        boxShadow: 'var(--ds-shadow-sm, 0 2px 8px rgba(0,0,0,0.04))',
        ...style
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--ds-font-size-md, 0.875rem)' }}>
        <thead>
          <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)' }}>
            {columns.map(col => {
              const isSorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    padding: '0.75rem 1rem',
                    fontWeight: 'var(--ds-font-weight-extrabold, 800)',
                    color: 'var(--text-muted)',
                    textAlign: col.align || 'left',
                    width: col.width,
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {col.header}
                    {col.sortable && (
                      <span style={{ color: isSorted ? 'var(--brand-blue)' : 'var(--text-muted)' }}>
                        {isSorted ? (
                          sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.5 }} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700 }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--brand-blue)' }} />
                  <span>Cargando datos...</span>
                </div>
              </td>
            </tr>
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <PackageX size={32} style={{ opacity: 0.5 }} />
                  <span style={{ fontWeight: 700 }}>{emptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            sortedData.map((row, idx) => (
              <tr
                key={row.id || row.code || idx}
                onClick={() => onRowClick && onRowClick(row)}
                style={{
                  borderBottom: '1px solid var(--border-light)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.15s ease'
                }}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: col.align || 'left',
                      color: 'var(--text-main)'
                    }}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Mobile Touch Card List View (< 768px) */}
      {mobileCardRender && sortedData.length > 0 && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem' }} className="md:hidden">
          {sortedData.map((row, idx) => (
            <div
              key={row.id || row.code || idx}
              onClick={() => onRowClick && onRowClick(row)}
              style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.625rem',
                padding: '0.85rem',
                cursor: onRowClick ? 'pointer' : 'default'
              }}
            >
              {mobileCardRender(row)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
