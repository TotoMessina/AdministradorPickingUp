import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase, isValidUUID } from '../../lib/supabase';
import { BaseModal } from './BaseModal';
import {
  FileSpreadsheet,
  FileText,
  Download,
  X,
  Building,
  CheckCircle,
  Code,
  Copy,
  Check,
  Calendar,
  Layers,
  DollarSign,
  TrendingUp,
  Database,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import {
  generateLibroIVAVentasTXT,
  generateSICORE_SIFERE_TXT,
  generateStockValuationCSV,
  triggerFileDownload
} from '../../services/AccountingExportService';

interface AccountingExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountingExportModal: React.FC<AccountingExportModalProps> = ({ isOpen, onClose }) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const { addNotification } = useNotifications();

  const storeKey = activeStore?.id || 'demo-store';

  const [activeTab, setActiveTab] = useState<'libro_iva' | 'sicore_sifere' | 'stock_valuation' | 'api_rest'>('libro_iva');
  const [period, setPeriod] = useState<string>('MONTH');
  const [sales, setSales] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [copiedAPIKey, setCopiedAPIKey] = useState<boolean>(false);

  // Load Real Data for Accounting Generation
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      // 1. Fetch Sales
      let loadedSales: any[] = [];
      try {
        const rawLocal = localStorage.getItem(`pickingup_sales_history_${storeKey}`);
        if (rawLocal) loadedSales = JSON.parse(rawLocal);
      } catch {}

      if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
        try {
          const { data: dbSales } = await supabase
            .from('sales')
            .select('*')
            .eq('store_id', activeStore.id)
            .order('created_at', { ascending: false });

          if (dbSales && dbSales.length > 0) loadedSales = dbSales;
        } catch {}
      }

      if (loadedSales.length === 0) {
        loadedSales = [
          { id: 'S-1001', ticketNumber: 'TK-4801', date: new Date().toISOString(), customerName: 'CONSUMIDOR FINAL', totalAmount: 12500.00, invoiceType: 'Factura B' },
          { id: 'S-1002', ticketNumber: 'TK-4802', date: new Date(Date.now() - 3600000).toISOString(), customerName: 'EMPRESA DEMO S.A.', cuit: '30712345678', totalAmount: 48900.00, invoiceType: 'Factura A' }
        ];
      }

      setSales(loadedSales);

      // 2. Fetch Articles
      let loadedProds: any[] = [];
      try {
        const rawProds = localStorage.getItem(`pickingup_articles_${storeKey}`) || localStorage.getItem(`pickingup_prodprices_${storeKey}`);
        if (rawProds) loadedProds = JSON.parse(rawProds);
      } catch {}

      if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
        try {
          const { data: dbProds } = await supabase
            .from('articles')
            .select('*')
            .eq('store_id', activeStore.id);
          if (dbProds && dbProds.length > 0) loadedProds = dbProds;
        } catch {}
      }

      if (loadedProds.length === 0) {
        loadedProds = [
          { code: 'ART-1001', barcode: '7791234567890', description: 'Aceite de Girasol 900ml', category: 'Almacén', stock: 48, cost: 850.00, price: 1250.00 },
          { code: 'ART-1002', barcode: '7799876543210', description: 'Gaseosa Cola 1.5L', category: 'Bebidas', stock: 120, cost: 620.00, price: 950.00 }
        ];
      }

      setArticles(loadedProds);
    };

    loadData();
  }, [isOpen, activeStore]);

  if (!isOpen) return null;

  // Handle Downloads
  const handleExportLibroIVA = () => {
    const txtContent = generateLibroIVAVentasTXT(sales, period);
    triggerFileDownload(txtContent, `LIBRO_IVA_VENTAS_AFIP_${activeStore?.slug || 'comercio'}.txt`);

    addNotification({
      title: 'Libro IVA Ventas Generado',
      message: `Se descargó el archivo posicional AFIP RG 3685/4597 con ${sales.length} comprobantes.`,
      type: 'success'
    });
  };

  const handleExportSICORE = () => {
    const txtContent = generateSICORE_SIFERE_TXT(sales, period);
    triggerFileDownload(txtContent, `SICORE_SIFERE_AFIP_${activeStore?.slug || 'comercio'}.txt`);

    addNotification({
      title: 'Archivo SICORE/SIFERE Generado',
      message: 'Se descargó el archivo posicional de retenciones y percepciones AFIP.',
      type: 'success'
    });
  };

  const handleExportStockValued = () => {
    const csvContent = generateStockValuationCSV(articles, activeStore?.name || 'Comercio');
    triggerFileDownload(csvContent, `Stock_Valorizado_${activeStore?.slug || 'comercio'}.csv`, 'text/csv;charset=utf-8;');

    addNotification({
      title: 'Stock Valorizado Exportado',
      message: `Se descargó el informe de inventario valorizado con ${articles.length} artículos.`,
      type: 'success'
    });
  };

  const sampleAPIEndpoint = `${window.location.origin}/functions/v1/accounting-api?store_id=${activeStore?.id || 'demo-store'}&type=sales`;

  const copyEndpointToClipboard = () => {
    navigator.clipboard.writeText(sampleAPIEndpoint);
    setCopiedAPIKey(true);
    setTimeout(() => setCopiedAPIKey(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1050,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '960px',
        maxHeight: '90vh',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
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
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileSpreadsheet size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, color: '#ffffff' }}>
                Exportación Contable Avanzada (exportaciones)
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.85)', margin: '2px 0 0 0' }}>
                Formatos AFIP reglamentarios, Stock Valorizado e Integraciones ERP (TANGO, Bejerman, SAP)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
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

        {/* Tab Selector Bar */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          padding: '0 1.5rem',
          gap: '0.5rem'
        }}>
          {[
            { id: 'libro_iva', label: '🏛️ Libro IVA Digital AFIP' },
            { id: 'sicore_sifere', label: '📑 SICORE / SIFERE' },
            { id: 'stock_valuation', label: '📊 Stock Valorizado' },
            { id: 'api_rest', label: '🔌 API REST ERP Externos' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #0284c7' : '3px solid transparent',
                background: 'none',
                color: activeTab === tab.id ? '#0284c7' : 'var(--text-muted)',
                fontWeight: activeTab === tab.id ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>

          {/* TAB 1: LIBRO IVA DIGITAL */}
          {activeTab === 'libro_iva' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '1rem', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText style={{ color: '#0284c7' }} /> Generador de Libro IVA Digital (AFIP RG 3685 / RG 4597)
                </h4>
                <p style={{ fontSize: '0.84375rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  Generación del archivo de texto posicional reglamentario exigido por la AFIP (Argentina) para importación en Aplicativo CITI Ventas o Libro IVA Digital.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div style={{ border: '1px solid var(--border-light)', borderRadius: '1rem', padding: '1.25rem', background: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Libro IVA Ventas (Comprobantes)
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Formato Ancho Fijo 278 Caracteres posicionales AFIP.
                  </div>
                  <button
                    onClick={handleExportLibroIVA}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '0.625rem',
                      padding: '0.625rem 1rem',
                      fontWeight: 800,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Download size={16} /> Descargar Libro_IVA_Ventas.txt
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SICORE / SIFERE */}
          {activeTab === 'sicore_sifere' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '1rem', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>
                  📑 Retenciones y Percepciones SICORE & SIFERE
                </h4>
                <p style={{ fontSize: '0.84375rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  Exportador de archivos de retenciones/percepciones para el aplicativo SICORE (AFIP) y SIFERE (Convenio Multilateral Ingresos Brutos).
                </p>
              </div>

              <button
                onClick={handleExportSICORE}
                style={{
                  alignSelf: 'flex-start',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.625rem',
                  padding: '0.75rem 1.5rem',
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Download size={18} /> Descargar SICORE_SIFERE.txt
              </button>
            </div>
          )}

          {/* TAB 3: STOCK VALORIZADO */}
          {activeTab === 'stock_valuation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '1rem', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>
                  📊 Inventario y Stock Valorizado
                </h4>
                <p style={{ fontSize: '0.84375rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  Genera una planilla completa en formato CSV/Excel con la valorización del stock actual al precio de costo y precio público de venta.
                </p>
              </div>

              <button
                onClick={handleExportStockValued}
                style={{
                  alignSelf: 'flex-start',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0f172a 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.625rem',
                  padding: '0.75rem 1.5rem',
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <FileSpreadsheet size={18} /> Exportar Stock_Valorizado.csv
              </button>
            </div>
          )}

          {/* TAB 4: API REST ERP */}
          {activeTab === 'api_rest' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '1rem', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Code style={{ color: '#0284c7' }} /> API REST de Integración con Sistemas Contables (TANGO, Bejerman, SAP)
                </h4>
                <p style={{ fontSize: '0.84375rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  Endpoint HTTP serverless en Supabase Edge Functions para extraer comprobantes y stock en tiempo real desde ERPs externos.
                </p>
              </div>

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '0.75rem', padding: '1rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.375rem' }}>
                  Endpoint REST API (Ventas & Stock):
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    readOnly
                    value={sampleAPIEndpoint}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontFamily: 'monospace', fontSize: '0.8125rem' }}
                  />
                  <button
                    onClick={copyEndpointToClipboard}
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '0.5rem',
                      padding: '0.5rem 1rem',
                      fontWeight: 800,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    {copiedAPIKey ? <Check size={16} /> : <Copy size={16} />} {copiedAPIKey ? 'Copiado' : 'Copiar URL'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '0.625rem',
              border: 'none',
              background: '#0284c7',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
