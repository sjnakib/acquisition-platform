'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
  accessor?: (row: T, index?: number) => string | number | null | undefined;
}

interface DataGridProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T, index: number) => void;
  loading?: boolean;
  loadingRows?: number;
  emptyMessage?: string;
  rowHeight?: number;
  maxHeight?: number | string;
  className?: string;
}

// Style constants
const S = {
  headerH: 36,
  rowH: 40,
  footerH: 32,
  rowNumW: 44,
  headerBg: 'var(--color-surface-1)',
  headerText: 'var(--color-text-tertiary)',
  headerBorder: 'var(--color-surface-3)',
  rowEvenBg: 'var(--color-surface-0)',
  rowOddBg: 'var(--color-surface-1)',
  rowBorder: 'var(--color-surface-2)',
  rowHoverBg: 'var(--color-accent-bg)',
  cellText: 'var(--color-text-secondary)',
  cellTextPrimary: 'var(--color-text-primary)',
  rowNumText: 'var(--color-text-tertiary)',
  footerBg: 'var(--color-surface-1)',
  footerBorder: 'var(--color-surface-2)',
  accent: 'var(--accent)',
  accentBg: 'var(--color-accent-bg)',
  accentLight: 'var(--color-accent-light)',
  skelShimmer1: 'var(--color-surface-1)',
  skelShimmer2: 'var(--color-surface-2)',
  containerBorder: 'var(--color-surface-3)',
} as const;

export function DataGrid<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  loading = false,
  loadingRows = 10,
  emptyMessage = 'No data found',
  rowHeight = S.rowH,
  maxHeight = 520,
  className,
}: DataGridProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;
    const getter = col.accessor ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number | null | undefined);
    return [...data].sort((a, b) => {
      const va = getter(a, 0) ?? '';
      const vb = getter(b, 0) ?? '';
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const computedWidths = useMemo(() => {
    const w: Record<string, number> = {};
    const sample = sortedData.slice(0, 50);
    for (const col of columns) {
      if (columnWidths[col.key] !== undefined) { w[col.key] = columnWidths[col.key]!; continue; }
      let maxChars = col.header.length;
      const getter = col.accessor ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number | null | undefined);
      for (const row of sample) {
        const val = getter(row, 0);
        const len = val != null ? String(val).length : 0;
        if (len > maxChars) maxChars = len;
      }
      const auto = Math.max(col.minWidth ?? 80, Math.min(col.maxWidth ?? 400, maxChars * 9 + 32));
      w[col.key] = col.width ?? auto;
    }
    return w;
  }, [columns, sortedData, columnWidths]);

  const totalWidth = useMemo(
    () => Object.values(computedWidths).reduce((s, w) => s + (w ?? 100), 0) + S.rowNumW,
    [computedWidths]
  );

  const onResizeStart = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { key, startX: e.clientX, startWidth: computedWidths[key] ?? 100 };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, resizingRef.current.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizingRef.current!.key]: newWidth }));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [computedWidths]);

  const onSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return key; }
      setSortDir('asc');
      return key;
    });
  }, []);

  const virtualizer = useVirtualizer({
    count: loading ? loadingRows : sortedData.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 15,
  });

  if (!loading && sortedData.length === 0) {
    return (
      <div className={`rounded-lg border ${className ?? ''}`} style={{ borderColor: S.containerBorder, background: S.rowEvenBg }}>
        <div className="flex items-center justify-center py-16 text-[13px] select-none" style={{ color: S.cellText }}>
          {emptyMessage}
        </div>
      </div>
    );
  }

  const sortIcon = (col: ColumnDef<T>) => {
    const isSorted = sortKey === col.key;
    if (col.sortable === false) return null;
    if (isSorted) {
      return sortDir === 'desc'
        ? <ArrowDown className="h-3 w-3 flex-shrink-0" style={{ color: S.accent }} />
        : <ArrowUp className="h-3 w-3 flex-shrink-0" style={{ color: S.accent }} />;
    }
    return <ArrowUpDown className="h-3 w-3 flex-shrink-0" style={{ opacity: 0, color: S.headerText }} />;
  };

  return (
    <div className={`rounded-lg border overflow-hidden ${className ?? ''}`} style={{ borderColor: S.containerBorder, background: S.rowEvenBg }}>
      {/* Scroll container */}
      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight }}>
        <div style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}>
          {/* Header row — sticky top */}
          <div
            className="flex sticky top-0 z-20 border-b select-none"
            style={{ height: S.headerH, background: S.headerBg, borderColor: S.headerBorder }}
          >
            <div
              className="flex-shrink-0 sticky left-0 z-30 flex items-center justify-end px-2 text-[10px] font-semibold border-r"
              style={{ width: S.rowNumW, height: S.headerH, background: S.headerBg, borderColor: S.headerBorder, color: S.rowNumText }}
            >
              #
            </div>
            {columns.map((col) => {
              const w = computedWidths[col.key] ?? 100;
              return (
                <div
                  key={col.key}
                  className="relative flex-shrink-0 flex items-center gap-1 px-3 text-[11px] font-medium uppercase tracking-[0.06em] border-r select-none"
                  style={{
                    width: w, height: S.headerH, borderColor: S.headerBorder, color: S.headerText,
                    justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                  }}
                  onClick={() => col.sortable !== false && onSort(col.key)}
                >
                  <span className="truncate">{col.header}</span>
                  {sortIcon(col)}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-20"
                    onMouseDown={(e) => onResizeStart(col.key, e)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent-light)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  />
                </div>
              );
            })}
          </div>

          {/* Body */}
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {loading
              ? virtualizer.getVirtualItems().map((vi) => (
                  <div
                    key={vi.key}
                    className="flex absolute top-0 left-0 border-b"
                    style={{ height: vi.size, width: '100%', transform: `translateY(${vi.start}px)`, borderColor: S.rowBorder }}
                  >
                    <div className="flex-shrink-0 sticky left-0 z-10 flex items-center justify-end px-2 border-r" style={{ width: S.rowNumW, borderColor: S.rowBorder, background: S.rowEvenBg }}>
                      <div className="h-3 w-8 rounded" style={{ background: `linear-gradient(90deg, ${S.skelShimmer1} 25%, ${S.skelShimmer2} 50%, ${S.skelShimmer1} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    </div>
                    {columns.map((col) => {
                      const w = computedWidths[col.key] ?? 100;
                      return (
                        <div key={col.key} className="flex-shrink-0 flex items-center px-3 border-r" style={{ width: w, height: vi.size, borderColor: S.rowBorder }}>
                          <div className="h-3 rounded w-3/4" style={{ background: `linear-gradient(90deg, ${S.skelShimmer1} 25%, ${S.skelShimmer2} 50%, ${S.skelShimmer1} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                        </div>
                      );
                    })}
                  </div>
                ))
              : virtualizer.getVirtualItems().map((vi) => {
                  const row = sortedData[vi.index];
                  if (!row) return null;
                  const isEven = vi.index % 2 === 0;
                  const rowBg = isEven ? S.rowEvenBg : S.rowOddBg;
                  return (
                    <div
                      key={rowKey(row, vi.index)}
                      className="flex absolute top-0 left-0 border-b transition-colors"
                      style={{
                        height: vi.size, width: '100%', transform: `translateY(${vi.start}px)`,
                        borderColor: S.rowBorder, background: rowBg,
                        cursor: onRowClick ? 'pointer' : 'default',
                      }}
                      onClick={() => onRowClick?.(row, vi.index)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = S.rowHoverBg }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = rowBg }}
                    >
                      <div
                        className="flex-shrink-0 sticky left-0 z-10 flex items-center justify-end px-2 text-[11px] border-r select-none tabular-nums"
                        style={{ width: S.rowNumW, height: vi.size, borderColor: S.rowBorder, background: rowBg, color: S.rowNumText }}
                      >
                        {vi.index + 1}
                      </div>
                      {columns.map((col) => {
                        const w = computedWidths[col.key] ?? 100;
                        const val = col.accessor
                          ? col.accessor(row, vi.index)
                          : ((row as Record<string, unknown>)[col.key] as string | number | null | undefined);
                        return (
                          <div
                            key={col.key}
                            className="flex-shrink-0 flex items-center px-3 border-r text-[13px]"
                            style={{
                              width: w, height: vi.size, borderColor: S.rowBorder,
                              justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                            }}
                          >
                            {col.render ? (
                              col.render(row, vi.index)
                            ) : (
                              <span className="truncate" style={{ color: S.cellText }}>
                                {val != null && val !== '' ? String(val) : '—'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
          </div>
        </div>
      </div>

      {/* Footer */}
      {!loading && (
        <div
          className="flex items-center px-3 border-t text-[11px] select-none"
          style={{ height: S.footerH, background: S.footerBg, borderColor: S.footerBorder, color: S.rowNumText, fontFamily: 'var(--font-jetbrains-mono)' }}
        >
          {sortedData.length.toLocaleString()} row{sortedData.length !== 1 ? 's' : ''}
          {sortKey && (
            <span style={{ color: S.cellText, marginLeft: '0.5em' }}>
              {'·'} sorted by {columns.find((c) => c.key === sortKey)?.header ?? sortKey}
            </span>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
