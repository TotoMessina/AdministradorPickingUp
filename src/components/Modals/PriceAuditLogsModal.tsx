import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { fetchAuditLogs, PriceAuditRecord } from '../../services/AuditLoggerService';
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  User,
  ArrowUpRight,
  ArrowDownRight,
  X,
  FileSpreadsheet,
  RefreshCw,
  Tag
} from 'lucide-react';

interface PriceAuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PriceAuditLogsModal: React.FC<PriceAuditLogsModalProps> = ({ isOpen, onClose }) => {
  const { activeStore } = useTenant();
  const [logs, setLogs] = useState<PriceAuditRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7D' | '30D'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  const storeKey = activeStore?.id || 'demo-store';

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen, activeStore]);

  const loadLogs = async () => {
    setLoading(true);
    const data = await fetchAuditLogs(storeKey);
    setLogs(data);
    setLoading(false);
  };

  if (!isOpen) return null;

  const usersList = Array.from(new Set(logs.map(l => l.user_email)));

  const filteredLogs = logs.filter(item => {
    const matchSearch = !searchTerm.trim() ||
      item.article_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.article_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.reason.toLowerCase().includes(searchTerm.toLowerCase());

    const matchUser = selectedUserFilter === 'all' || item.user_email === selectedUserFilter;

    let matchDate = true;
    if (item.created_at) {
      const itemDate = new Date(item.created_at);
      const now = new Date();
      if (dateFilter === 'TODAY') {
        matchDate = itemDate.toDateString() === now.toDateString();
      } else if (dateFilter === '7D') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        matchDate = itemDate >= weekAgo;
      } else if (dateFilter === '30D') {
        const monthAgo = new Date();
        monthAgo.setDate(now.getDate() - 30);
        matchDate = itemDate >= monthAgo;
      }
    }

    return matchSearch && matchUser && matchDate;
  });

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '980px',
        maxHeight: '88vh',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--text-main)'
      }} className="animate-fade-in">

        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShieldCheck size={26} />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0 }}>🛡️ Historial de Auditoría de Precios</h2>
              <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Registro inmutable de quién cambió cada precio, fechas y motivos</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-app)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por artículo, código o motivo..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                color: 'var(--text-main)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <select
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value as any); setCurrentPage(1); }}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-surface)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              fontWeight: 700
            }}
          >
            <option value="ALL">📅 Todos los períodos</option>
            <option value="TODAY">Hoy</option>
            <option value="7D">Últimos 7 días</option>
            <option value="30D">Últimos 30 días</option>
          </select>

          <select
            value={selectedUserFilter}
            onChange={(e) => { setSelectedUserFilter(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-surface)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              fontWeight: 700
            }}
          >
            <option value="all">👤 Todos los usuarios ({usersList.length})</option>
            {usersList.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          <button
            onClick={loadLogs}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-surface)',
              color: 'var(--text-main)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        {/* Audit Log Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Cargando historial de auditoría...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No se encontraron registros de auditoría de precios.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 800 }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Fecha / Hora</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Artículo</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Lista</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Anterior</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Nuevo</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Motivo</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => {
                  const isUp = log.new_price > log.old_price;
                  const diffPercent = log.old_price > 0 ? (((log.new_price - log.old_price) / log.old_price) * 100).toFixed(1) : '0';

                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'Reciente'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{log.article_description}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Cód: {log.article_code}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--brand-blue)' }}>
                        {log.price_list_name}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>
                        ${log.old_price.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: isUp ? '#10b981' : '#ef4444' }}>
                        ${log.new_price.toFixed(2)}
                        <span style={{ fontSize: '0.6875rem', marginLeft: '4px', fontWeight: 700 }}>
                          ({isUp ? '+' : ''}{diffPercent}%)
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)', fontWeight: 600 }}>
                        {log.reason}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {log.user_email}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer with Pagination */}
        <div style={{ padding: '0.875rem 1.5rem', borderTop: '1px solid var(--border-light)', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 700 }}>
            Mostrando {paginatedLogs.length} de {filteredLogs.length} registros (Página {currentPage} de {totalPages})
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                background: currentPage <= 1 ? 'var(--bg-app)' : 'var(--bg-surface)',
                color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              ◀ Anterior
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                background: currentPage >= totalPages ? 'var(--bg-app)' : 'var(--bg-surface)',
                color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Siguiente ▶
            </button>

            <button
              onClick={onClose}
              style={{
                padding: '0.4rem 1.25rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#4f46e5',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginLeft: '0.5rem'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
