import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  Customer,
  fetchCustomers,
  saveCustomer,
  recordCustomerPayment
} from '../../services/CustomerService';
import {
  X,
  Plus,
  Search,
  Edit2,
  Users,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Download,
  Save,
  Phone,
  Mail,
  MapPin,
  FileCheck,
  TrendingUp,
  Award,
  DollarSign,
  UserCheck,
  RefreshCw
} from 'lucide-react';

interface CustomersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'customers' | 'form' | 'payments';
}

export const CustomersManagementModal: React.FC<CustomersManagementModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'customers'
}) => {
  const { activeStore } = useTenant();
  const { isDemoMode } = useAuth();
  const { addNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState<'customers' | 'form' | 'payments'>(initialTab);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'debtors' | 'active'>('all');

  // Form State for Add / Edit
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    cuit: '',
    phone: '',
    email: '',
    address: '',
    balance: 0,
    loyalty_points: 0,
    is_active: true
  });

  // Payment Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeStore]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCustomers(activeStore?.id);
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        code: customer.code,
        name: customer.name,
        cuit: customer.cuit || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        balance: customer.balance || 0,
        loyalty_points: customer.loyalty_points || 0,
        is_active: customer.is_active ?? true
      });
    } else {
      setEditingCustomer(null);
      const nextNum = String(customers.length + 1).padStart(3, '0');
      setFormData({
        code: `CLI-${nextNum}`,
        name: '',
        cuit: '',
        phone: '',
        email: '',
        address: '',
        balance: 0,
        loyalty_points: 0,
        is_active: true
      });
    }
    setActiveTab('form');
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      addNotification({
        type: 'warning',
        title: 'Campos requeridos',
        message: 'Por favor complete el nombre y código del cliente.'
      });
      return;
    }

    try {
      const saved = await saveCustomer({
        id: editingCustomer?.id,
        store_id: activeStore?.id || 'demo-store',
        ...formData
      });

      addNotification({
        type: 'success',
        title: editingCustomer ? 'Cliente actualizado' : 'Cliente registrado',
        message: `El cliente "${saved.name}" fue guardado exitosamente.`
      });

      await loadData();
      setActiveTab('customers');
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Error al guardar',
        message: 'No se pudo guardar el cliente. Verifique los datos.'
      });
    }
  };

  const handleOpenPayment = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setPaymentAmount(customer.balance > 0 ? customer.balance : 0);
    setPaymentNotes(`Cobro a cuenta corriente - ${customer.name}`);
    setActiveTab('payments');
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || paymentAmount <= 0) {
      addNotification({
        type: 'warning',
        title: 'Monto inválido',
        message: 'Ingrese un monto válido para el cobro.'
      });
      return;
    }

    setSubmittingPayment(true);
    try {
      const success = await recordCustomerPayment(selectedCustomerId, activeStore?.id || 'demo-store', paymentAmount);
      if (success) {
        addNotification({
          type: 'success',
          title: 'Cobro registrado',
          message: `Se registraron $${paymentAmount.toLocaleString()} a la cuenta corriente del cliente.`
        });
        await loadData();
        setActiveTab('customers');
      }
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Error en el cobro',
        message: 'No se pudo procesar el pago a cuenta corriente.'
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleExportCSV = () => {
    if (customers.length === 0) return;
    const headers = ['Código', 'Nombre', 'CUIT/DNI', 'Teléfono', 'Email', 'Dirección', 'Saldo Cta Cte', 'Puntos Fidelidad', 'Estado'];
    const rows = customers.map(c => [
      c.code,
      `"${c.name}"`,
      c.cuit || '',
      c.phone || '',
      c.email || '',
      `"${c.address || ''}"`,
      c.balance,
      c.loyalty_points,
      c.is_active ? 'Activo' : 'Inactivo'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `clientes_${activeStore?.slug || 'pickingup'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addNotification({
      type: 'info',
      title: 'Exportación completada',
      message: 'Se ha descargado la lista de clientes en CSV.'
    });
  };

  // Filter Customers
  const filteredCustomers = customers.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.cuit && c.cuit.includes(searchQuery));

    if (!matchesSearch) return false;
    if (statusFilter === 'debtors') return c.balance > 0;
    if (statusFilter === 'active') return c.is_active;
    return true;
  });

  const totalDebtorsBalance = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + (c.loyalty_points || 0), 0);
  const activeCustomersCount = customers.filter(c => c.is_active).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[var(--bg-surface)] border border-[var(--border-light)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-main)]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-light)] bg-[var(--bg-surface-hover)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                Gestión de Clientes & CRM
                {isDemoMode && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">
                    Modo Demo
                  </span>
                )}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Base de datos de clientes, cuentas corrientes y programa de fidelidad
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs & Key Metrics */}
        <div className="px-6 py-3 border-b border-[var(--border-light)] bg-[var(--bg-surface)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'customers'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              <Users className="w-4 h-4" />
              Clientes ({customers.length})
            </button>
            <button
              onClick={() => handleOpenForm()}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'form'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              <Plus className="w-4 h-4" />
              {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'payments'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Cobro Cta Cte
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-semibold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Total Saldo Cta Cte: ${totalDebtorsBalance.toLocaleString('es-AR')}
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 font-semibold flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              Puntos Emitidos: {totalLoyaltyPoints.toLocaleString('es-AR')} pts
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-surface)]">
          {activeTab === 'customers' && (
            <div className="space-y-4">
              {/* Search & Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Buscar por Nombre, CUIT o Código..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Todos los clientes</option>
                    <option value="debtors">Solo con Deuda Cta Cte</option>
                    <option value="active">Solo Activos</option>
                  </select>

                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-2 rounded-xl border border-[var(--border-light)] text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar CSV
                  </button>

                  <button
                    onClick={loadData}
                    className="p-2 rounded-xl border border-[var(--border-light)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                    title="Actualizar datos"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Customers Table */}
              {loading ? (
                <div className="py-12 text-center text-sm text-[var(--text-muted)]">
                  Cargando base de datos de clientes...
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-[var(--border-light)] rounded-2xl">
                  <Users className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-[var(--text-main)]">No se encontraron clientes</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Pruebe cambiar los filtros o agregue un nuevo cliente.</p>
                  <button
                    onClick={() => handleOpenForm()}
                    className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Registrar Primer Cliente
                  </button>
                </div>
              ) : (
                <div className="border border-[var(--border-light)] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-light)] text-[var(--text-muted)] font-semibold">
                        <th className="p-3">Código</th>
                        <th className="p-3">Nombre / Razón Social</th>
                        <th className="p-3">CUIT / DNI</th>
                        <th className="p-3">Contacto</th>
                        <th className="p-3 text-right">Saldo Cta Cte</th>
                        <th className="p-3 text-center">Fidelidad</th>
                        <th className="p-3 text-center">Estado</th>
                        <th className="p-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)]">
                      {filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-[var(--bg-surface-hover)]/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-blue-500">{customer.code}</td>
                          <td className="p-3 font-semibold text-[var(--text-main)]">
                            {customer.name}
                            {customer.address && (
                              <span className="block text-[10px] text-[var(--text-muted)] font-normal flex items-center gap-1 mt-0.5">
                                <MapPin className="w-2.5 h-2.5" /> {customer.address}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-[var(--text-muted)] font-mono">{customer.cuit || '-'}</td>
                          <td className="p-3 text-[var(--text-muted)]">
                            {customer.phone && <span className="block">{customer.phone}</span>}
                            {customer.email && <span className="block text-[10px] opacity-75">{customer.email}</span>}
                            {!customer.phone && !customer.email && '-'}
                          </td>
                          <td className="p-3 text-right font-bold font-mono">
                            <span className={customer.balance > 0 ? 'text-amber-500' : 'text-emerald-500'}>
                              ${Number(customer.balance || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] inline-flex items-center gap-1">
                              <Award className="w-3 h-3" />
                              {customer.loyalty_points || 0} pts
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                customer.is_active
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-rose-500/10 text-rose-500'
                              }`}
                            >
                              {customer.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {customer.balance > 0 && (
                                <button
                                  onClick={() => handleOpenPayment(customer)}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                                  title="Registrar Cobro a Cuenta Corriente"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenForm(customer)}
                                className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors"
                                title="Editar Cliente"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'form' && (
            <form onSubmit={handleSaveCustomer} className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-light)]">
                <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-500" />
                  {editingCustomer ? `Editar Cliente: ${editingCustomer.name}` : 'Registrar Nuevo Cliente'}
                </h3>
                <span className="text-xs text-[var(--text-muted)]">* Campos obligatorios</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Código de Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ej: CLI-001"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Nombre / Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Juan Pérez / Empresa S.A."
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    CUIT / DNI
                  </label>
                  <input
                    type="text"
                    value={formData.cuit}
                    onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                    placeholder="Ej: 20-12345678-9"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ej: +54 9 11 1234-5678"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="cliente@ejemplo.com"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Dirección Comercial / Entrega
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Ej: Av. Corrientes 1234, CABA"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Saldo Inicial Cta Cte ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Puntos de Fidelidad Iniciales
                  </label>
                  <input
                    type="number"
                    value={formData.loyalty_points}
                    onChange={(e) => setFormData({ ...formData, loyalty_points: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="customer_is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-[var(--border-light)]"
                  />
                  <label htmlFor="customer_is_active" className="text-xs font-medium text-[var(--text-main)]">
                    Cliente activo en el sistema
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-light)]">
                <button
                  type="button"
                  onClick={() => setActiveTab('customers')}
                  className="px-4 py-2 rounded-xl border border-[var(--border-light)] text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {editingCustomer ? 'Guardar Cambios' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'payments' && (
            <form onSubmit={handleRecordPayment} className="max-w-xl mx-auto space-y-6">
              <div className="pb-4 border-b border-[var(--border-light)]">
                <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                  Cobro a Cuenta Corriente
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Registre ingresos de dinero para disminuir el saldo deudor de un cliente.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Seleccionar Cliente *
                  </label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      const target = customers.find(c => c.id === e.target.value);
                      if (target) {
                        setPaymentAmount(target.balance > 0 ? target.balance : 0);
                        setPaymentNotes(`Cobro a cuenta corriente - ${target.name}`);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Seleccionar cliente --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) - Saldo: ${Number(c.balance || 0).toLocaleString('es-AR')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Monto a Cobrar ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-sm font-bold font-mono text-emerald-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Medio de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Tarjeta">Tarjeta de Débito/Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                    Notas / Concepto
                  </label>
                  <textarea
                    rows={2}
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-[var(--border-light)] text-xs text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-light)]">
                <button
                  type="button"
                  onClick={() => setActiveTab('customers')}
                  className="px-4 py-2 rounded-xl border border-[var(--border-light)] text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submittingPayment ? 'Procesando...' : 'Confirmar Cobro'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
