import React, { useState } from 'react';
import { BaseModal } from './BaseModal';
import {
  Trash2,
  Barcode,
  Calendar,
  Filter,
  CheckCircle2,
  ChevronRight,
  FileText,
  Printer,
  Mail,
  Copy,
  Tag,
  Eye,
  AlertTriangle
} from 'lucide-react';

// --- 1. MODAL DE CREACIÓN / EDICIÓN ---
interface CreationEditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
  initialData?: any;
}

export const CreationEditionModal: React.FC<CreationEditionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [code, setCode] = useState(initialData?.code || '7791234567890');
  const [description, setDescription] = useState(initialData?.description || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [price, setPrice] = useState(initialData?.price || '0.00');
  const [stock, setStock] = useState(initialData?.stock || '0');
  const [isActive, setIsActive] = useState<boolean>(initialData?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) {
      onSave({ code, description, category, price, stock, isActive });
    }
    onClose();
  };

  const footer = (
    <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'flex-end' }}>
      <button
        type="button"
        onClick={onClose}
        style={{
          padding: '0.65rem 1.25rem',
          borderRadius: '0.625rem',
          border: '1px solid #cbd5e1',
          background: '#f8fafc',
          color: '#475569',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
          flex: 1
        }}
      >
        Cancelar
      </button>

      <button
        type="button"
        onClick={handleSubmit}
        style={{
          padding: '0.65rem 1.5rem',
          borderRadius: '0.625rem',
          border: 'none',
          background: '#6366f1',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '0.85rem',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
          flex: 1
        }}
      >
        Guardar
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Artículo' : 'Nuevo Artículo'}
      variant="creation"
      footer={footer}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Código */}
        <div>
          <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
            Código *
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: 7791234567890"
              style={{
                width: '100%',
                padding: '0.65rem 2.25rem 0.65rem 0.875rem',
                borderRadius: '0.625rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
            <Barcode size={18} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6366f1' }} />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
            Descripción *
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Nombre del artículo"
            style={{
              width: '100%',
              padding: '0.65rem 0.875rem',
              borderRadius: '0.625rem',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Categoría */}
        <div>
          <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
            Categoría *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.875rem',
              borderRadius: '0.625rem',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              outline: 'none',
              background: '#ffffff'
            }}
          >
            <option value="">Seleccionar categoría</option>
            <option value="Almacén">Almacén</option>
            <option value="Bebidas">Bebidas</option>
            <option value="Lácteos">Lácteos</option>
            <option value="Fiambrería">Fiambrería</option>
            <option value="Limpieza">Limpieza</option>
          </select>
        </div>

        {/* Precio & Stock Inicial */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
              Precio de venta *
            </label>
            <input
              type="text"
              value={`$ ${price}`}
              onChange={(e) => setPrice(e.target.value.replace('$ ', ''))}
              style={{
                width: '100%',
                padding: '0.65rem 0.875rem',
                borderRadius: '0.625rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
              Stock inicial *
            </label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.875rem',
                borderRadius: '0.625rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Active Toggle Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            style={{
              width: '44px',
              height: '24px',
              borderRadius: '99px',
              background: isActive ? '#6366f1' : '#cbd5e1',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s'
            }}
          >
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#ffffff',
              position: 'absolute',
              top: '3px',
              left: isActive ? '23px' : '3px',
              transition: 'left 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
          </button>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>
            {isActive ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </form>
    </BaseModal>
  );
};


// --- 2. MODAL DE CONFIRMACIÓN ---
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  itemTitle?: string;
  itemCode?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemTitle = 'Aceite Girasol 1L',
  itemCode = '7791234567890'
}) => {
  const footer = (
    <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'flex-end' }}>
      <button
        onClick={onClose}
        style={{
          padding: '0.65rem 1.25rem',
          borderRadius: '0.625rem',
          border: '1px solid #cbd5e1',
          background: '#f8fafc',
          color: '#475569',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
          flex: 1
        }}
      >
        Cancelar
      </button>
      <button
        onClick={() => {
          if (onConfirm) onConfirm();
          onClose();
        }}
        style={{
          padding: '0.65rem 1.5rem',
          borderRadius: '0.625rem',
          border: 'none',
          background: '#ef4444',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '0.85rem',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
          flex: 1
        }}
      >
        Eliminar
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar acción"
      variant="confirmation"
      footer={footer}
    >
      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
        {/* Red Trashcan Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#fee2e2',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem auto'
        }}>
          <Trash2 size={30} />
        </div>

        <h4 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
          ¿Estás seguro que deseas eliminar este artículo?
        </h4>
        <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
          Esta acción no se puede deshacer.
        </p>

        {/* Item Preview Box */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '0.875rem',
          marginTop: '1.25rem',
          textAlign: 'left',
          fontSize: '0.8125rem',
          color: '#475569'
        }}>
          <div><strong>Artículo:</strong> {itemTitle}</div>
          <div style={{ marginTop: '2px' }}><strong>Código:</strong> {itemCode}</div>
        </div>
      </div>
    </BaseModal>
  );
};


// --- 3. MODAL DE FILTROS ---
interface SearchFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters?: (filters: any) => void;
}

export const SearchFiltersModal: React.FC<SearchFiltersModalProps> = ({
  isOpen,
  onClose,
  onApplyFilters
}) => {
  const [dateFrom, setDateFrom] = useState('2024-05-01');
  const [dateTo, setDateTo] = useState('2024-05-31');
  const [voucherType, setVoucherType] = useState('Todos');
  const [status, setStatus] = useState('Todos');
  const [storeBranch, setStoreBranch] = useState('Todas las sucursales');

  const handleApply = () => {
    if (onApplyFilters) onApplyFilters({ dateFrom, dateTo, voucherType, status, storeBranch });
    onClose();
  };

  const handleClear = () => {
    setDateFrom('');
    setDateTo('');
    setVoucherType('Todos');
    setStatus('Todos');
    setStoreBranch('Todas las sucursales');
  };

  const footer = (
    <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'flex-end' }}>
      <button
        onClick={handleClear}
        style={{
          padding: '0.65rem 1.25rem',
          borderRadius: '0.625rem',
          border: '1px solid #cbd5e1',
          background: '#ffffff',
          color: '#475569',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: 'pointer',
          flex: 1
        }}
      >
        Limpiar filtros
      </button>

      <button
        onClick={handleApply}
        style={{
          padding: '0.65rem 1.5rem',
          borderRadius: '0.625rem',
          border: 'none',
          background: '#6366f1',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '0.85rem',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
          flex: 1
        }}
      >
        Aplicar filtros
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Filtros de búsqueda"
      variant="filters"
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
            Fecha desde
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.875rem',
              borderRadius: '0.625rem',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              outline: 'none'
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
            Fecha hasta
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.875rem',
              borderRadius: '0.625rem',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              outline: 'none'
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
            Tipo de comprobante
          </label>
          <select
            value={voucherType}
            onChange={(e) => setVoucherType(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.875rem',
              borderRadius: '0.625rem',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              outline: 'none',
              background: '#ffffff'
            }}
          >
            <option value="Todos">Todos</option>
            <option value="Factura Venta">Factura Venta</option>
            <option value="Ticket POS">Ticket POS</option>
            <option value="Nota de Crédito">Nota de Crédito</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
            Estado
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.875rem',
              borderRadius: '0.625rem',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              outline: 'none',
              background: '#ffffff'
            }}
          >
            <option value="Todos">Todos</option>
            <option value="Completado">Completado</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Anulado">Anulado</option>
          </select>
        </div>
      </div>
    </BaseModal>
  );
};


// --- 4. MODAL DE OPCIONES CONTEXTUALES (MÓVIL) ---
interface ContextualOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption?: (optionId: string) => void;
}

export const ContextualOptionsModal: React.FC<ContextualOptionsModalProps> = ({
  isOpen,
  onClose,
  onSelectOption
}) => {
  const options = [
    { id: 'detail', label: 'Ver detalle', icon: <Eye size={18} /> },
    { id: 'print', label: 'Imprimir comprobante', icon: <Printer size={18} /> },
    { id: 'email', label: 'Enviar por email', icon: <Mail size={18} /> },
    { id: 'duplicate', label: 'Duplicar venta', icon: <Copy size={18} /> }
  ];

  const footer = (
    <button
      onClick={onClose}
      style={{
        width: '100%',
        padding: '0.75rem',
        borderRadius: '0.75rem',
        border: '1px solid #cbd5e1',
        background: '#f8fafc',
        color: '#475569',
        fontWeight: 800,
        fontSize: '0.875rem',
        cursor: 'pointer'
      }}
    >
      Cancelar
    </button>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Opciones"
      variant="options"
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {options.map((opt) => (
          <div
            key={opt.id}
            onClick={() => {
              if (onSelectOption) onSelectOption(opt.id);
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1rem',
              borderRadius: '0.75rem',
              border: '1px solid #f1f5f9',
              background: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#334155', fontWeight: 700, fontSize: '0.875rem' }}>
              <div style={{ color: '#6366f1' }}>{opt.icon}</div>
              <span>{opt.label}</span>
            </div>
            <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
          </div>
        ))}
      </div>
    </BaseModal>
  );
};


// --- 5. MODAL INFORMATIVO / DETALLE DE VENTA ---
interface SaleDetailInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleData?: any;
}

export const SaleDetailInfoModal: React.FC<SaleDetailInfoModalProps> = ({
  isOpen,
  onClose,
  saleData
}) => {
  const items = saleData?.items || [
    { desc: 'Aceite Girasol 1L', price: 1450, qty: 2, total: 2900 },
    { desc: 'Azúcar 1kg', price: 890, qty: 1, total: 890 },
    { desc: 'Yerba Mate 1kg', price: 2150, qty: 1, total: 2150 }
  ];

  const totalAmount = items.reduce((sum: number, i: any) => sum + (i.total || (i.price * i.qty)), 0);

  const footer = (
    <button
      onClick={onClose}
      style={{
        width: '100%',
        padding: '0.75rem 1.5rem',
        borderRadius: '0.625rem',
        border: 'none',
        background: '#6366f1',
        color: '#ffffff',
        fontWeight: 800,
        fontSize: '0.875rem',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
      }}
    >
      Cerrar
    </button>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de Venta"
      variant="info"
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Ticket Top Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8125rem' }}>
          <div>
            <div style={{ color: '#64748b' }}>Comprobante</div>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>FV 00032581</div>
            <div style={{ color: '#64748b', marginTop: '6px' }}>Cliente</div>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>Consumidor Final</div>
          </div>
          <div>
            <div style={{ color: '#64748b' }}>Fecha</div>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>30/05/2024 12:19</div>
          </div>
        </div>

        {/* Products List */}
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            PRODUCTOS ({items.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
            {items.map((item: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.desc}</span>
                <div style={{ display: 'flex', gap: '1rem', color: '#475569' }}>
                  <span>${item.price.toLocaleString('es-AR')}</span>
                  <span>x {item.qty}</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>${item.total.toLocaleString('es-AR')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals Summary */}
        <div style={{
          background: '#f8fafc',
          borderRadius: '0.75rem',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          fontSize: '0.8125rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
            <span>Subtotal</span>
            <span>${totalAmount.toLocaleString('es-AR')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
            <span>Descuento</span>
            <span>$0,00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.2rem', color: '#6366f1', marginTop: '4px' }}>
            <span>Total</span>
            <span>${totalAmount.toLocaleString('es-AR')}</span>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};
