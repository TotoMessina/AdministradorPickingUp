import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase, isValidUUID } from '../../lib/supabase';
import {
  X,
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  CreditCard,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Download,
  Save,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileCheck,
  TrendingUp,
  Receipt,
  Check
} from 'lucide-react';

export interface SupplierItem {
  id?: string;
  code: string;
  name: string;
  cuit: string;
  phone: string;
  email: string;
  address: string;
  vat_condition: string;
  balance: number;
  is_active: boolean;
  created_at?: string;
}

export interface SupplierInvoiceItem {
  id?: string;
  supplier_id: string;
  supplier_name: string;
  invoice_number: string;
  invoice_type: string;
  amount: number;
  paid_amount: number;
  status: 'Pendiente' | 'Pagado Parcial' | 'Pagado';
  issue_date: string;
  created_at?: string;
}

export interface SupplierPaymentItem {
  id?: string;
  supplier_id: string;
  supplier_name: string;
  invoice_id?: string;
  payment_method: 'Efectivo' | 'Transferencia' | 'Cheque';
  amount: number;
  reference_number: string;
  notes: string;
  date: string;
  created_at?: string;
}

interface SuppliersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'suppliers' | 'checking_account' | 'invoices';
}

export const SuppliersManagementModal: React.FC<SuppliersManagementModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'suppliers'
}) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const { addNotification } = useNotifications();

  const storeKey = activeStore?.id || 'demo-store';

  const [activeTab, setActiveTab] = useState<'suppliers' | 'checking_account' | 'invoices'>(initialTab);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoiceItem[]>([]);
  const [payments, setPayments] = useState<SupplierPaymentItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Form State (Create/Edit Supplier)
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [supplierFormData, setSupplierFormData] = useState<SupplierItem>({
    code: '',
    name: '',
    cuit: '',
    phone: '',
    email: '',
    address: '',
    vat_condition: 'Responsable Inscripto',
    balance: 0,
    is_active: true
  });

  // Modal Form State (Register Invoice)
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [invoiceFormData, setInvoiceFormData] = useState({
    supplier_id: '',
    invoice_number: '',
    invoice_type: 'Factura A',
    amount: '',
    issue_date: new Date().toISOString().split('T')[0]
  });

  // Modal Form State (Register Payment)
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    supplier_id: '',
    payment_method: 'Efectivo' as const,
    amount: '',
    reference_number: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeStore]);

  const loadData = async () => {
    setLoading(true);

    let loadedSuppliers: SupplierItem[] = [];
    let loadedInvoices: SupplierInvoiceItem[] = [];
    let loadedPayments: SupplierPaymentItem[] = [];

    // Local Storage
    try {
      const rawSupp = localStorage.getItem(`pickingup_suppliers_${storeKey}`);
      if (rawSupp) loadedSuppliers = JSON.parse(rawSupp);

      const rawInv = localStorage.getItem(`pickingup_supplier_invoices_${storeKey}`);
      if (rawInv) loadedInvoices = JSON.parse(rawInv);

      const rawPay = localStorage.getItem(`pickingup_supplier_payments_${storeKey}`);
      if (rawPay) loadedPayments = JSON.parse(rawPay);
    } catch {}

    // Supabase DB
    if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
      try {
        const { data: dbSuppliers } = await supabase
          .from('suppliers')
          .select('*')
          .eq('store_id', activeStore.id)
          .order('created_at', { ascending: false });

        if (dbSuppliers && dbSuppliers.length > 0) {
          loadedSuppliers = dbSuppliers.map((s: any) => ({
            ...s,
            balance: Number(s.balance) || 0
          }));
        }

        const { data: dbInvoices } = await supabase
          .from('supplier_invoices')
          .select('*, suppliers(name)')
          .eq('store_id', activeStore.id)
          .order('created_at', { ascending: false });

        if (dbInvoices && dbInvoices.length > 0) {
          loadedInvoices = dbInvoices.map((i: any) => ({
            id: i.id,
            supplier_id: i.supplier_id,
            supplier_name: i.suppliers?.name || 'Proveedor',
            invoice_number: i.invoice_number,
            invoice_type: i.invoice_type,
            amount: Number(i.amount) || 0,
            paid_amount: Number(i.paid_amount) || 0,
            status: i.status,
            issue_date: new Date(i.issue_date || i.created_at).toLocaleDateString('es-AR')
          }));
        }

        const { data: dbPayments } = await supabase
          .from('supplier_payments')
          .select('*, suppliers(name)')
          .eq('store_id', activeStore.id)
          .order('created_at', { ascending: false });

        if (dbPayments && dbPayments.length > 0) {
          loadedPayments = dbPayments.map((p: any) => ({
            id: p.id,
            supplier_id: p.supplier_id,
            supplier_name: p.suppliers?.name || 'Proveedor',
            payment_method: p.payment_method,
            amount: Number(p.amount) || 0,
            reference_number: p.reference_number || '-',
            notes: p.notes || '-',
            date: new Date(p.created_at).toLocaleDateString('es-AR')
          }));
        }
      } catch (err) {
        console.error('Error loading suppliers data from DB:', err);
      }
    }

    setSuppliers(loadedSuppliers);
    setInvoices(loadedInvoices);
    setPayments(loadedPayments);
    setLoading(false);
  };

  const syncSuppliers = (updated: SupplierItem[]) => {
    setSuppliers(updated);
    try {
      localStorage.setItem(`pickingup_suppliers_${storeKey}`, JSON.stringify(updated));
    } catch {}
  };

  const syncInvoices = (updated: SupplierInvoiceItem[]) => {
    setInvoices(updated);
    try {
      localStorage.setItem(`pickingup_supplier_invoices_${storeKey}`, JSON.stringify(updated));
    } catch {}
  };

  const syncPayments = (updated: SupplierPaymentItem[]) => {
    setPayments(updated);
    try {
      localStorage.setItem(`pickingup_supplier_payments_${storeKey}`, JSON.stringify(updated));
    } catch {}
  };

  // --- CRUD SUPPLIER HANDLERS ---
  const handleOpenCreateSupplier = () => {
    const autoCode = `PROV-${Math.floor(100 + Math.random() * 900)}`;
    setEditingSupplier(null);
    setSupplierFormData({
      code: autoCode,
      name: '',
      cuit: '',
      phone: '',
      email: '',
      address: '',
      vat_condition: 'Responsable Inscripto',
      balance: 0,
      is_active: true
    });
    setIsSupplierFormOpen(true);
  };

  const handleOpenEditSupplier = (supp: SupplierItem) => {
    setEditingSupplier(supp);
    setSupplierFormData({ ...supp });
    setIsSupplierFormOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierFormData.name.trim()) return;

    const cleanSupplier: SupplierItem = {
      ...supplierFormData,
      code: supplierFormData.code.trim().toUpperCase(),
      name: supplierFormData.name.trim().toUpperCase(),
      cuit: supplierFormData.cuit.trim(),
      balance: Number(supplierFormData.balance) || 0,
      created_at: editingSupplier?.created_at || new Date().toISOString()
    };

    let updatedList: SupplierItem[];
    if (editingSupplier) {
      updatedList = suppliers.map(s => s.code === editingSupplier.code ? cleanSupplier : s);
    } else {
      updatedList = [cleanSupplier, ...suppliers];
    }

    syncSuppliers(updatedList);

    if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
      try {
        const { error: suppError } = await supabase
          .from('suppliers')
          .upsert({
            store_id: activeStore.id,
            code: cleanSupplier.code,
            name: cleanSupplier.name,
            cuit: cleanSupplier.cuit,
            phone: cleanSupplier.phone,
            email: cleanSupplier.email,
            address: cleanSupplier.address,
            vat_condition: cleanSupplier.vat_condition,
            balance: cleanSupplier.balance,
            is_active: cleanSupplier.is_active
          }, { onConflict: 'store_id,code' });

        if (suppError) {
          console.error('Error saving supplier to DB:', suppError);
          addNotification({
            title: 'Error al Guardar Proveedor en Servidor',
            message: `No se pudo sincronizar en la base de datos: ${suppError.message}`,
            type: 'error'
          });
        }
      } catch (err: any) {
        console.error('Error saving supplier to DB:', err);
        addNotification({
          title: 'Error de Conexión en Base de Datos',
          message: `Falla de comunicación con Supabase: ${err?.message || 'Error desconocido'}`,
          type: 'error'
        });
      }
    }

    setIsSupplierFormOpen(false);
    addNotification({
      title: editingSupplier ? 'Proveedor Actualizado' : 'Nuevo Proveedor Registrado',
      message: `El proveedor "${cleanSupplier.name}" fue guardado con éxito.`,
      type: 'success'
    });
  };

  // --- INVOICE HANDLERS ---
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(invoiceFormData.amount);
    if (!invoiceFormData.supplier_id || isNaN(amountVal) || amountVal <= 0) {
      alert('Por favor seleccioná un proveedor e ingresá un monto válido.');
      return;
    }

    const supplierObj = suppliers.find(s => s.id === invoiceFormData.supplier_id || s.code === invoiceFormData.supplier_id);
    const suppName = supplierObj ? supplierObj.name : 'Proveedor';
    const suppCode = supplierObj ? supplierObj.code : invoiceFormData.supplier_id;

    const newInvoice: SupplierInvoiceItem = {
      id: `inv-${Date.now()}`,
      supplier_id: invoiceFormData.supplier_id,
      supplier_name: suppName,
      invoice_number: invoiceFormData.invoice_number.trim() || `FC-${Date.now().toString().slice(-6)}`,
      invoice_type: invoiceFormData.invoice_type,
      amount: amountVal,
      paid_amount: 0,
      status: 'Pendiente',
      issue_date: new Date(invoiceFormData.issue_date).toLocaleDateString('es-AR')
    };

    const updatedInvoices = [newInvoice, ...invoices];
    syncInvoices(updatedInvoices);

    // Increase supplier balance (Positive balance = We owe money)
    const updatedSuppliers = suppliers.map(s => {
      if (s.id === invoiceFormData.supplier_id || s.code === suppCode) {
        return { ...s, balance: s.balance + amountVal };
      }
      return s;
    });
    syncSuppliers(updatedSuppliers);

    if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
      try {
        const { error: invError } = await supabase.from('supplier_invoices').insert({
          store_id: activeStore.id,
          supplier_id: supplierObj?.id || invoiceFormData.supplier_id,
          invoice_number: newInvoice.invoice_number,
          invoice_type: newInvoice.invoice_type,
          amount: amountVal,
          paid_amount: 0,
          status: 'Pendiente',
          issue_date: invoiceFormData.issue_date
        });

        if (invError) {
          console.error('Error persisting invoice to DB:', invError);
          addNotification({
            title: 'Error de Sincronización de Comprobante',
            message: `No se pudo registrar la factura en la base de datos: ${invError.message}`,
            type: 'error'
          });
        }

        if (supplierObj?.id) {
          const { error: suppUpdErr } = await supabase
            .from('suppliers')
            .update({ balance: (supplierObj.balance + amountVal) })
            .eq('id', supplierObj.id);

          if (suppUpdErr) {
            console.error('Error updating supplier balance in DB:', suppUpdErr);
          }
        }
      } catch (err: any) {
        console.error('Error persisting invoice to DB:', err);
        addNotification({
          title: 'Error de Conexión en Servidor',
          message: `Falla al guardar comprobante en Supabase: ${err?.message || 'Error de red'}`,
          type: 'error'
        });
      }
    }

    setIsInvoiceFormOpen(false);
    setInvoiceFormData({
      supplier_id: '',
      invoice_number: '',
      invoice_type: 'Factura A',
      amount: '',
      issue_date: new Date().toISOString().split('T')[0]
    });

    addNotification({
      title: 'Comprobante Registrado',
      message: `Se registró la ${newInvoice.invoice_type} N° ${newInvoice.invoice_number} por $${amountVal.toFixed(2)} para ${suppName}.`,
      type: 'success'
    });
  };

  // --- PAYMENT HANDLERS ---
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const payAmount = parseFloat(paymentFormData.amount);
    if (!paymentFormData.supplier_id || isNaN(payAmount) || payAmount <= 0) {
      alert('Por favor seleccioná un proveedor e ingresá un monto de pago válido.');
      return;
    }

    const supplierObj = suppliers.find(s => s.id === paymentFormData.supplier_id || s.code === paymentFormData.supplier_id);
    const suppName = supplierObj ? supplierObj.name : 'Proveedor';
    const suppCode = supplierObj ? supplierObj.code : paymentFormData.supplier_id;

    const newPayment: SupplierPaymentItem = {
      id: `pay-${Date.now()}`,
      supplier_id: paymentFormData.supplier_id,
      supplier_name: suppName,
      payment_method: paymentFormData.payment_method,
      amount: payAmount,
      reference_number: paymentFormData.reference_number || '-',
      notes: paymentFormData.notes || '-',
      date: new Date().toLocaleDateString('es-AR')
    };

    const updatedPayments = [newPayment, ...payments];
    syncPayments(updatedPayments);

    // Deduct from supplier balance (Allow negative values = Credit in favor of store!)
    let newCalculatedBalance = 0;
    const updatedSuppliers = suppliers.map(s => {
      if (s.id === paymentFormData.supplier_id || s.code === suppCode) {
        newCalculatedBalance = s.balance - payAmount;
        return { ...s, balance: newCalculatedBalance };
      }
      return s;
    });
    syncSuppliers(updatedSuppliers);

    if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
      try {
        const { error: payError } = await supabase.from('supplier_payments').insert({
          store_id: activeStore.id,
          supplier_id: supplierObj?.id || paymentFormData.supplier_id,
          payment_method: newPayment.payment_method,
          amount: payAmount,
          reference_number: newPayment.reference_number,
          notes: newPayment.notes,
          created_by: user.id
        });

        if (payError) {
          console.error('Error persisting payment to DB:', payError);
          addNotification({
            title: 'Error de Sincronización de Pago',
            message: `No se pudo registrar el pago en la base de datos: ${payError.message}`,
            type: 'error'
          });
        }

        if (supplierObj?.id) {
          const { error: suppUpdErr } = await supabase
            .from('suppliers')
            .update({ balance: newCalculatedBalance })
            .eq('id', supplierObj.id);

          if (suppUpdErr) {
            console.error('Error updating supplier balance in DB:', suppUpdErr);
          }
        }
      } catch (err: any) {
        console.error('Error persisting payment to DB:', err);
        addNotification({
          title: 'Error de Conexión al Guardar Pago',
          message: `Falla de comunicación con Supabase: ${err?.message || 'Error de red'}`,
          type: 'error'
        });
      }
    }

    setIsPaymentFormOpen(false);
    setPaymentFormData({
      supplier_id: '',
      payment_method: 'Efectivo',
      amount: '',
      reference_number: '',
      notes: ''
    });

    const isCreditInFavor = newCalculatedBalance < 0;
    addNotification({
      title: isCreditInFavor ? 'Pago Registrado (Saldo a Favor Registrado)' : 'Pago Registrado Exitosamente',
      message: isCreditInFavor
        ? `Se pagaron $${payAmount.toFixed(2)} a ${suppName}. Quedan $${Math.abs(newCalculatedBalance).toFixed(2)} como Saldo a Favor.`
        : `Se emitió un pago de $${payAmount.toFixed(2)} (${newPayment.payment_method}) a ${suppName}.`,
      type: 'success'
    });
  };

  const handleExportCSV = () => {
    const headers = ['Codigo', 'Razon_Social', 'CUIT', 'Telefono', 'Email', 'Condicion_IVA', 'Estado_Saldo', 'Monto_Balance'];
    const rows = suppliers.map(s => [
      s.code,
      `"${s.name.replace(/"/g, '""')}"`,
      s.cuit,
      s.phone,
      s.email,
      `"${s.vat_condition.replace(/"/g, '""')}"`,
      s.balance > 0 ? 'DEUDA' : (s.balance < 0 ? 'A_FAVOR' : 'AL_DIA'),
      s.balance.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `proveedores_cta_cte_${activeStore?.slug || 'tienda'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Total Metrics
  const totalDebt = suppliers.filter(s => s.balance > 0).reduce((sum, s) => sum + s.balance, 0);
  const totalCreditInFavor = suppliers.filter(s => s.balance < 0).reduce((sum, s) => sum + Math.abs(s.balance), 0);
  const suppliersWithDebtCount = suppliers.filter(s => s.balance > 0).length;
  const suppliersWithCreditCount = suppliers.filter(s => s.balance < 0).length;
  const totalPaymentsMonth = payments.reduce((sum, p) => sum + p.amount, 0);

  // Filtered suppliers
  const filteredSuppliers = suppliers.filter(s => {
    const term = searchTerm.toLowerCase().trim();
    return !term ||
      s.code.toLowerCase().includes(term) ||
      s.name.toLowerCase().includes(term) ||
      s.cuit.includes(term);
  });

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '92vh',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }} className="animate-fade-in">

        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.75rem',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.05em' }}>
                ADMINISTRACIÓN DE PROVEEDORES Y CUENTAS CORRIENTES
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>
                Proveedores y Cuentas por Pagar — {activeStore?.name || 'Mi Negocio'}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleExportCSV}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.875rem',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Download size={15} /> Exportar CSV
            </button>
            <button
              id="btn-close-suppliers-modal"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{ background: 'var(--bg-surface)', padding: '0.875rem 1.125rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>DEUDA TOTAL CON PROVEEDORES</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: totalDebt > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>
              ${totalDebt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{suppliersWithDebtCount} proveedores pendientes</div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '0.875rem 1.125rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>SALDO A FAVOR TOTAL (CRÉDITO)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
              ${totalCreditInFavor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{suppliersWithCreditCount} proveedores a favor</div>
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '0.875rem 1.125rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL PAGOS EMITIDOS</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
              ${totalPaymentsMonth.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{payments.length} recibos de pago</div>
          </div>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-surface)',
          padding: '0 1.5rem'
        }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => setActiveTab('suppliers')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'suppliers' ? '3px solid #ea580c' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'suppliers' ? '#ea580c' : 'var(--text-muted)',
                fontWeight: activeTab === 'suppliers' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Users size={16} /> 🤝 Gestión de Proveedores ({suppliers.length})
            </button>

            <button
              onClick={() => setActiveTab('checking_account')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'checking_account' ? '3px solid #ea580c' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'checking_account' ? '#ea580c' : 'var(--text-muted)',
                fontWeight: activeTab === 'checking_account' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <CreditCard size={16} /> 💳 Cuentas Corrientes y Pagos ({payments.length})
            </button>

            <button
              onClick={() => setActiveTab('invoices')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'invoices' ? '3px solid #ea580c' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'invoices' ? '#ea580c' : 'var(--text-muted)',
                fontWeight: activeTab === 'invoices' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Receipt size={16} /> 🧾 Ingreso de Comprobantes ({invoices.length})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setIsPaymentFormOpen(true)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.625rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-app)',
                color: '#10b981',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <DollarSign size={15} /> 💸 Registrar Pago
            </button>

            <button
              onClick={handleOpenCreateSupplier}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.625rem',
                border: 'none',
                background: '#ea580c',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Plus size={16} /> + Nuevo Proveedor
            </button>
          </div>
        </div>

        {/* TAB 1: SUPPLIERS LIST */}
        {activeTab === 'suppliers' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Filter Bar */}
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              background: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '450px' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar por Razón Social, CUIT o Código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Total: <strong>{filteredSuppliers.length} proveedores</strong>
              </div>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
              <div style={{
                border: '1px solid var(--border-light)',
                borderRadius: '0.875rem',
                overflow: 'hidden',
                background: 'var(--bg-surface)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{
                      background: 'var(--bg-app)',
                      borderBottom: '1px solid var(--border-light)',
                      fontWeight: 800,
                      color: 'var(--text-main)'
                    }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Razón Social / Proveedor</th>
                      <th style={{ padding: '0.75rem 1rem' }}>CUIT / IVA</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Contacto (Tel / Email)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Estado de Saldo / Balance</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No hay proveedores cargados aún en esta sucursal.
                        </td>
                      </tr>
                    ) : (
                      filteredSuppliers.map(s => {
                        const isDebt = s.balance > 0;
                        const isCredit = s.balance < 0;

                        return (
                          <tr key={s.code} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>{s.code}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{s.name}</div>
                              {s.address && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>📍 {s.address}</div>}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{s.cuit || 'Sin CUIT'}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.vat_condition}</div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              {s.phone && <div style={{ fontSize: '0.75rem' }}>📞 {s.phone}</div>}
                              {s.email && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>✉️ {s.email}</div>}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, fontSize: '0.9rem' }}>
                              {isDebt && (
                                <span style={{ color: '#ef4444' }}>
                                  ${s.balance.toFixed(2)} (DEUDA)
                                </span>
                              )}
                              {isCredit && (
                                <span style={{ color: '#0284c7', background: 'rgba(2, 132, 199, 0.12)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                                  +${Math.abs(s.balance).toFixed(2)} (A FAVOR)
                                </span>
                              )}
                              {!isDebt && !isCredit && (
                                <span style={{ color: '#10b981' }}>
                                  $0.00 (AL DÍA)
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                <button
                                  onClick={() => handleOpenEditSupplier(s)}
                                  title="Editar Proveedor"
                                  style={{
                                    padding: '0.35rem',
                                    borderRadius: '0.375rem',
                                    border: '1px solid var(--border-light)',
                                    background: 'var(--bg-app)',
                                    color: '#ea580c',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Edit2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CHECKING ACCOUNT & PAYMENTS */}
        {activeTab === 'checking_account' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                📜 Historial de Pagos y Movimientos de Cuenta Corriente
              </h3>
              <button
                onClick={() => setIsPaymentFormOpen(true)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#10b981',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <DollarSign size={15} /> Registrar Pago Nuevo
              </button>
            </div>

            <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--bg-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', fontWeight: 800, color: 'var(--text-main)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Fecha</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Proveedor</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Medio de Pago</th>
                    <th style={{ padding: '0.75rem 1rem' }}>N° Referencia</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Notas</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Monto Pagado ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No se registraron pagos a proveedores aún.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p, idx) => (
                      <tr key={p.id || idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-muted)' }}>{p.date}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--text-main)' }}>{p.supplier_name}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 800, fontSize: '0.75rem' }}>
                            💳 {p.payment_method}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>{p.reference_number}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{p.notes}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: '#10b981', fontSize: '0.9rem' }}>
                          ${p.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: INVOICES LOG */}
        {activeTab === 'invoices' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                🧾 Comprobantes de Compra e Inserción de Facturas
              </h3>
              <button
                onClick={() => setIsInvoiceFormOpen(true)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#ea580c',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Plus size={15} /> + Ingresar Factura / Comprobante
              </button>
            </div>

            <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--bg-surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', fontWeight: 800, color: 'var(--text-main)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Fecha Emisión</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Tipo Comprobante</th>
                    <th style={{ padding: '0.75rem 1rem' }}>N° Factura</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Proveedor</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Monto Total ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay facturas de compra cargadas aún.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv, idx) => (
                      <tr key={inv.id || idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-muted)' }}>{inv.issue_date}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#ea580c' }}>{inv.invoice_type}</td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 800 }}>{inv.invoice_number}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{inv.supplier_name}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            background: inv.status === 'Pagado' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: inv.status === 'Pagado' ? '#10b981' : '#ef4444',
                            fontWeight: 800,
                            fontSize: '0.75rem'
                          }}>
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                          ${inv.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: CREATE / EDIT SUPPLIER */}
      {isSupplierFormOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '600px',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }} className="animate-fade-in">
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border-light)',
              background: '#ea580c',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                {editingSupplier ? `✏️ Editar Proveedor: ${editingSupplier.code}` : '➕ Alta de Nuevo Proveedor'}
              </h3>
              <button onClick={() => setIsSupplierFormOpen(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Código *
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierFormData.code}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, code: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 800, color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    CUIT
                  </label>
                  <input
                    type="text"
                    placeholder="30-71234567-8"
                    value={supplierFormData.cuit}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, cuit: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Razón Social / Nombre Proveedor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Distribuidora Central S.A."
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Teléfono
                  </label>
                  <input
                    type="text"
                    placeholder="011 4567-8900"
                    value={supplierFormData.phone}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Email Contacto
                  </label>
                  <input
                    type="email"
                    placeholder="ventas@proveedor.com"
                    value={supplierFormData.email}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Condición IVA
                </label>
                <select
                  value={supplierFormData.vat_condition}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, vat_condition: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}
                >
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Monotributo">Monotributo</option>
                  <option value="Exento">Exento</option>
                  <option value="Consumidor Final">Consumidor Final</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsSupplierFormOpen(false)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#ea580c', color: '#ffffff', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Save size={16} /> Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTER INVOICE */}
      {isInvoiceFormOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '1rem', width: '100%', maxWidth: '550px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }} className="animate-fade-in">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', background: '#ea580c', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>🧾 Registrar Factura / Comprobante</h3>
              <button onClick={() => setIsInvoiceFormOpen(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Seleccionar Proveedor *
                </label>
                <select
                  required
                  value={invoiceFormData.supplier_id}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, supplier_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 800, color: 'var(--text-main)' }}
                >
                  <option value="">-- Seleccionar Proveedor --</option>
                  {suppliers.map(s => (
                    <option key={s.code} value={s.id || s.code}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Tipo Comprobante
                  </label>
                  <select
                    value={invoiceFormData.invoice_type}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoice_type: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}
                  >
                    <option value="Factura A">Factura A</option>
                    <option value="Factura B">Factura B</option>
                    <option value="Factura C">Factura C</option>
                    <option value="Nota de Débito">Nota de Débito</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    N° Factura / Comprobante
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0001-0004928"
                    value={invoiceFormData.invoice_number}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoice_number: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Monto Total ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={invoiceFormData.amount}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, amount: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 900, fontSize: '1rem', color: '#ea580c' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsInvoiceFormOpen(false)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#ea580c', color: '#ffffff', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Save size={16} /> Guardar Comprobante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTER PAYMENT */}
      {isPaymentFormOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '1rem', width: '100%', maxWidth: '550px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }} className="animate-fade-in">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', background: '#10b981', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>💸 Registrar Pago a Proveedor</h3>
              <button onClick={() => setIsPaymentFormOpen(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Seleccionar Proveedor *
                </label>
                <select
                  required
                  value={paymentFormData.supplier_id}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, supplier_id: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 800, color: 'var(--text-main)' }}
                >
                  <option value="">-- Seleccionar Proveedor --</option>
                  {suppliers.map(s => (
                    <option key={s.code} value={s.id || s.code}>
                      {s.name} ({s.balance > 0 ? `Deuda: $${s.balance.toFixed(2)}` : (s.balance < 0 ? `A Favor: $${Math.abs(s.balance).toFixed(2)}` : 'Al Día')})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Medio de Pago
                  </label>
                  <select
                    value={paymentFormData.payment_method}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value as any })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 700 }}
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Monto A Pagar ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={paymentFormData.amount}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: 900, fontSize: '1rem', color: '#10b981' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  N° Comprobante / Referencia / Cheque
                </label>
                <input
                  type="text"
                  placeholder="ej. TR-948201948"
                  value={paymentFormData.reference_number}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, reference_number: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  placeholder="ej. Pago a cuenta de factura N° 0001-4928"
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsPaymentFormOpen(false)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontWeight: 700, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#10b981', color: '#ffffff', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Save size={16} /> Emitir Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
