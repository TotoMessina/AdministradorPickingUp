import React, { useState, useRef } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase, isValidUUID } from '../../lib/supabase';
import { BaseModal } from './BaseModal';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  FileText,
  Layers,
  Sparkles,
  Download,
  RefreshCw,
  Info
} from 'lucide-react';
import { ArticleItem } from './ArticlesManagementModal';

interface BulkArticleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingArticles: ArticleItem[];
  onImportComplete: () => void;
}

type WizardStep = 'UPLOAD' | 'MAP_COLUMNS' | 'PREVIEW' | 'IMPORTING' | 'SUMMARY';

interface ColumnMapping {
  code: string;
  barcode: string;
  description: string;
  category: string;
  price: string;
  cost: string;
  stock: string;
  min_stock: string;
}

interface ParsedRow {
  raw: Record<string, string>;
  mapped: {
    code: string;
    barcode: string;
    description: string;
    category: string;
    price: number;
    cost: number;
    stock: number;
    min_stock: number;
  };
  status: 'NEW' | 'UPDATE' | 'INVALID';
  errors: string[];
}

const BATCH_SIZE = 500;

export const BulkArticleImportModal: React.FC<BulkArticleImportModalProps> = ({
  isOpen,
  onClose,
  existingArticles,
  onImportComplete
}) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const { addNotification } = useNotifications();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>('UPLOAD');
  const [fileName, setFileName] = useState<string>('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);

  // Column Mapping State
  const [mapping, setMapping] = useState<ColumnMapping>({
    code: '',
    barcode: '',
    description: '',
    category: '',
    price: '',
    cost: '',
    stock: '',
    min_stock: ''
  });

  // Parsed and Processed Rows
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // Batch Processing Progress
  const [importProgress, setImportProgress] = useState<{
    totalBatches: number;
    currentBatch: number;
    processedCount: number;
    successCount: number;
    updatedCount: number;
    errorCount: number;
    errorLog: { code: string; description: string; reason: string }[];
  }>({
    totalBatches: 0,
    currentBatch: 0,
    processedCount: 0,
    successCount: 0,
    updatedCount: 0,
    errorCount: 0,
    errorLog: []
  });

  const storeKey = activeStore?.id || 'demo-store';

  if (!isOpen) return null;

  // Auto Detect Delimiter and Parse File Content
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        alert('El archivo cargado no contiene filas de datos suficientes.');
        return;
      }

      // Auto detect delimiter (; or \t or ,)
      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') ? ';' : (firstLine.includes('\t') ? '\t' : ',');

      const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
      setFileHeaders(headers);

      // Parse Raw Object Rows
      const rows: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        rows.push(rowObj);
      }

      setRawRows(rows);

      // Auto Map Smart Column Matchers
      const autoMapping: ColumnMapping = { code: '', barcode: '', description: '', category: '', price: '', cost: '', stock: '', min_stock: '' };

      headers.forEach(h => {
        const lower = h.toLowerCase();
        if (!autoMapping.code && (lower.includes('cód') || lower.includes('cod') || lower.includes('sku') || lower.includes('id'))) {
          autoMapping.code = h;
        } else if (!autoMapping.barcode && (lower.includes('barra') || lower.includes('ean') || lower.includes('upc'))) {
          autoMapping.barcode = h;
        } else if (!autoMapping.description && (lower.includes('desc') || lower.includes('nombre') || lower.includes('producto') || lower.includes('articulo'))) {
          autoMapping.description = h;
        } else if (!autoMapping.category && (lower.includes('cat') || lower.includes('rubro') || lower.includes('familia'))) {
          autoMapping.category = h;
        } else if (!autoMapping.price && (lower.includes('precio') || lower.includes('pvp') || lower.includes('venta'))) {
          autoMapping.price = h;
        } else if (!autoMapping.cost && (lower.includes('costo') || lower.includes('compra'))) {
          autoMapping.cost = h;
        } else if (!autoMapping.stock && (lower.includes('stock') || lower.includes('cant') || lower.includes('existencia'))) {
          autoMapping.stock = h;
        } else if (!autoMapping.min_stock && (lower.includes('min') || lower.includes('mín'))) {
          autoMapping.min_stock = h;
        }
      });

      setMapping(autoMapping);
      setStep('MAP_COLUMNS');
    };

    reader.readAsText(file, 'UTF-8');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Generate Sample CSV Template Download
  const handleDownloadSampleTemplate = () => {
    const csvContent =
      "\uFEFF" +
      "Código;Código de Barras;Descripción;Categoría;Precio Venta;Precio Costo;Stock Actual;Stock Mínimo\n" +
      "ART-1001;7791234567890;Aceite de Girasol 900ml;Almacén;1250.00;850.00;48;10\n" +
      "ART-1002;7799876543210;Gaseosa Cola 1.5L;Bebidas;950.00;620.00;120;15\n" +
      "ART-1003;;Detergente Concentrado 500ml;Limpieza;820.00;510.00;30;5\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Plantilla_Importacion_Articulos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process Rows & Detect Conflicts for Preview
  const handleProceedToPreview = () => {
    if (!mapping.code || !mapping.description) {
      alert('Debés asignar al menos las columnas para "Código de Artículo" y "Descripción".');
      return;
    }

    const existingCodeSet = new Set(existingArticles.map(a => a.code.toUpperCase()));
    const fileSeenCodes = new Set<string>();

    const rowsEvaluated: ParsedRow[] = rawRows.map(raw => {
      const codeVal = (raw[mapping.code] || '').trim().toUpperCase();
      const descVal = (raw[mapping.description] || '').trim();
      const barcodeVal = mapping.barcode ? (raw[mapping.barcode] || '').trim() : '';
      const categoryVal = mapping.category ? (raw[mapping.category] || 'General').trim() : 'General';
      const priceVal = mapping.price ? parseFloat(raw[mapping.price].replace(',', '.')) || 0 : 0;
      const costVal = mapping.cost ? parseFloat(raw[mapping.cost].replace(',', '.')) || 0 : 0;
      const stockVal = mapping.stock ? parseInt(raw[mapping.stock], 10) || 0 : 0;
      const minStockVal = mapping.min_stock ? parseInt(raw[mapping.min_stock], 10) || 5 : 5;

      const errors: string[] = [];
      if (!codeVal) errors.push('Código vacío');
      if (!descVal) errors.push('Descripción vacía');
      if (fileSeenCodes.has(codeVal)) errors.push('Código duplicado en el archivo');

      if (codeVal) fileSeenCodes.add(codeVal);

      let status: 'NEW' | 'UPDATE' | 'INVALID' = 'NEW';
      if (errors.length > 0) {
        status = 'INVALID';
      } else if (existingCodeSet.has(codeVal)) {
        status = 'UPDATE';
      }

      return {
        raw,
        mapped: {
          code: codeVal,
          barcode: barcodeVal || codeVal,
          description: descVal,
          category: categoryVal,
          price: priceVal,
          cost: costVal,
          stock: stockVal,
          min_stock: minStockVal
        },
        status,
        errors
      };
    });

    setParsedRows(rowsEvaluated);
    setStep('PREVIEW');
  };

  // Execute Batch Chunked Import (500 Items per Batch)
  const handleExecuteBatchImport = async () => {
    const validRows = parsedRows.filter(r => r.status !== 'INVALID');
    if (validRows.length === 0) {
      alert('No hay filas válidas para importar.');
      return;
    }

    setStep('IMPORTING');

    const totalBatches = Math.ceil(validRows.length / BATCH_SIZE);
    let successCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errorLog: { code: string; description: string; reason: string }[] = [];

    // Local Storage Master State Update
    const updatedArticlesMap = new Map<string, ArticleItem>();
    existingArticles.forEach(a => updatedArticlesMap.set(a.code.toUpperCase(), { ...a }));

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const chunk = validRows.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);

      setImportProgress({
        totalBatches,
        currentBatch: batchIdx + 1,
        processedCount: Math.min((batchIdx + 1) * BATCH_SIZE, validRows.length),
        successCount,
        updatedCount,
        errorCount,
        errorLog
      });

      // 1. Process Batch in DB via Supabase
      if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
        try {
          const dbPayload = chunk.map(r => ({
            store_id: activeStore.id,
            code: r.mapped.code,
            barcode: r.mapped.barcode,
            description: r.mapped.description,
            category: r.mapped.category,
            price: r.mapped.price,
            cost: r.mapped.cost,
            stock: r.mapped.stock,
            min_stock: r.mapped.min_stock,
            is_active: true
          }));

          const { error } = await supabase
            .from('articles')
            .upsert(dbPayload, { onConflict: 'store_id,code' });

          if (error) {
            console.error(`Batch ${batchIdx + 1} DB Upsert Error:`, error);
            errorCount += chunk.length;
            chunk.forEach(r => errorLog.push({ code: r.mapped.code, description: r.mapped.description, reason: error.message }));
          } else {
            chunk.forEach(r => {
              if (r.status === 'NEW') successCount++;
              else updatedCount++;

              updatedArticlesMap.set(r.mapped.code, {
                code: r.mapped.code,
                barcode: r.mapped.barcode,
                description: r.mapped.description,
                category: r.mapped.category,
                price: r.mapped.price,
                cost: r.mapped.cost,
                stock: r.mapped.stock,
                min_stock: r.mapped.min_stock,
                is_active: true
              });
            });
          }
        } catch (err: any) {
          console.error(`Batch ${batchIdx + 1} Exception:`, err);
          errorCount += chunk.length;
          chunk.forEach(r => errorLog.push({ code: r.mapped.code, description: r.mapped.description, reason: err?.message || 'Error de red' }));
        }
      } else {
        // Fallback for Demo / Local Storage Mode
        chunk.forEach(r => {
          if (r.status === 'NEW') successCount++;
          else updatedCount++;

          updatedArticlesMap.set(r.mapped.code, {
            code: r.mapped.code,
            barcode: r.mapped.barcode,
            description: r.mapped.description,
            category: r.mapped.category,
            price: r.mapped.price,
            cost: r.mapped.cost,
            stock: r.mapped.stock,
            min_stock: r.mapped.min_stock,
            is_active: true
          });
        });
      }

      // Small delay between batches to smooth out UI progress
      await new Promise(res => setTimeout(res, 80));
    }

    // Persist Final Cache in LocalStorage
    try {
      const finalArticlesList = Array.from(updatedArticlesMap.values());
      localStorage.setItem(`pickingup_articles_${storeKey}`, JSON.stringify(finalArticlesList));
    } catch {}

    setImportProgress({
      totalBatches,
      currentBatch: totalBatches,
      processedCount: validRows.length,
      successCount,
      updatedCount,
      errorCount,
      errorLog
    });

    setStep('SUMMARY');
    onImportComplete();
    addNotification({
      title: 'Importación Masiva Completada',
      message: `Se procesaron ${validRows.length} artículos: ${successCount} creados, ${updatedCount} actualizados.`,
      type: errorCount > 0 ? 'warning' : 'success'
    });
  };

  const newCount = parsedRows.filter(r => r.status === 'NEW').length;
  const updateCount = parsedRows.filter(r => r.status === 'UPDATE').length;
  const invalidCount = parsedRows.filter(r => r.status === 'INVALID').length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '850px',
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
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
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
              <Upload size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, color: '#ffffff' }}>
                Importación Masiva de Artículos (CSV / Excel)
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.85)', margin: '2px 0 0 0' }}>
                Carga catálogos completos con mapeo dinámico y procesamiento en batches
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
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

        {/* Wizard Stepper Header */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          padding: '0.75rem 1.5rem',
          justifyContent: 'space-between',
          fontSize: '0.8125rem',
          fontWeight: 700
        }}>
          <div style={{ color: step === 'UPLOAD' ? '#0284c7' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            1. Cargar Archivo
          </div>
          <div style={{ color: step === 'MAP_COLUMNS' ? '#0284c7' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            2. Mapear Columnas
          </div>
          <div style={{ color: step === 'PREVIEW' ? '#0284c7' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            3. Vista Previa ({parsedRows.length})
          </div>
          <div style={{ color: step === 'IMPORTING' || step === 'SUMMARY' ? '#0284c7' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            4. Procesamiento
          </div>
        </div>

        {/* Step Body Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>

          {/* STEP 1: UPLOAD */}
          {step === 'UPLOAD' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .tsv, .txt"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '1.25rem',
                background: 'rgba(2, 132, 199, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
                color: '#0284c7'
              }}>
                <FileSpreadsheet size={36} />
              </div>

              <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>
                Seleccioná tu archivo CSV o Excel
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '480px', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Podés importar miles de productos con sus precios, costos, stock y categorías de manera automatizada.
              </p>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 1.75rem',
                    fontWeight: 800,
                    fontSize: '0.9375rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: 'var(--shadow-md)'
                  }}
                >
                  <Upload size={18} /> Explorar y Cargar CSV
                </button>

                <button
                  onClick={handleDownloadSampleTemplate}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-main)',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 1.25rem',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Download size={16} style={{ color: '#0284c7' }} /> Descargar Plantilla Ejemplo
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: MAP COLUMNS */}
          {step === 'MAP_COLUMNS' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Mapeo Configurable de Columnas ({fileName})
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Relacioná las columnas detectadas en tu archivo con los campos del catálogo.
                  </p>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', padding: '4px 10px', borderRadius: '9999px' }}>
                  {rawRows.length} Filas Detectadas
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                {[
                  { key: 'code', label: 'Código de Artículo (Requerido)', required: true },
                  { key: 'description', label: 'Descripción / Nombre (Requerido)', required: true },
                  { key: 'price', label: 'Precio de Venta ($)', required: false },
                  { key: 'cost', label: 'Precio de Costo ($)', required: false },
                  { key: 'stock', label: 'Stock Actual', required: false },
                  { key: 'category', label: 'Categoría / Rubro', required: false },
                  { key: 'barcode', label: 'Código de Barras EAN/UPC', required: false },
                  { key: 'min_stock', label: 'Stock Mínimo Alerta', required: false }
                ].map(field => (
                  <div key={field.key} style={{
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.75rem',
                    padding: '0.875rem'
                  }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 800, color: field.required ? '#0284c7' : 'var(--text-main)', marginBottom: '0.375rem' }}>
                      {field.label}
                    </label>
                    <select
                      value={(mapping as any)[field.key]}
                      onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-main)',
                        fontSize: '0.8125rem',
                        fontWeight: 600
                      }}
                    >
                      <option value="">-- Sin asignar --</option>
                      {fileHeaders.map(h => (
                        <option key={h} value={h}>Columna: "{h}"</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 'PREVIEW' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Vista Previa y Detección de Conflictos
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Revisá la clasificación de los registros antes de procesar los lotes.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '9999px' }}>
                    🟢 {newCount} Nuevos
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '9999px' }}>
                    🟡 {updateCount} Actualizar
                  </span>
                  {invalidCount > 0 && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: '9999px' }}>
                      🔴 {invalidCount} Inválidos (Omitidos)
                    </span>
                  )}
                </div>
              </div>

              <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.75rem', overflow: 'hidden', maxHeight: '340px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 800 }}>Estado</th>
                      <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 800 }}>Código</th>
                      <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 800 }}>Descripción</th>
                      <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 800 }}>Categoría</th>
                      <th style={{ padding: '0.625rem 0.875rem', textAlign: 'right', fontWeight: 800 }}>Precio</th>
                      <th style={{ padding: '0.625rem 0.875rem', textAlign: 'right', fontWeight: 800 }}>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 100).map((row, rIdx) => (
                      <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-light)', opacity: row.status === 'INVALID' ? 0.6 : 1 }}>
                        <td style={{ padding: '0.625rem 0.875rem' }}>
                          {row.status === 'NEW' && <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '0.725rem' }}>NUEVO</span>}
                          {row.status === 'UPDATE' && <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '0.725rem' }}>ACTUALIZAR</span>}
                          {row.status === 'INVALID' && <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '0.725rem' }}>INVÁLIDO</span>}
                        </td>
                        <td style={{ padding: '0.625rem 0.875rem', fontWeight: 700 }}>{row.mapped.code || '-'}</td>
                        <td style={{ padding: '0.625rem 0.875rem' }}>{row.mapped.description || '-'}</td>
                        <td style={{ padding: '0.625rem 0.875rem' }}>{row.mapped.category}</td>
                        <td style={{ padding: '0.625rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                          ${row.mapped.price.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.625rem 0.875rem', textAlign: 'right', fontWeight: 700 }}>{row.mapped.stock} u.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 100 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                  Mostrando los primeros 100 de {parsedRows.length} artículos evaluados.
                </div>
              )}
            </div>
          )}

          {/* STEP 4: IMPORTING */}
          {step === 'IMPORTING' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
              <RefreshCw size={44} style={{ color: '#0284c7', animation: 'spin 1.5s linear infinite', marginBottom: '1.25rem' }} />
              <h4 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>
                Procesando Importación Masiva en Batches
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Lote {importProgress.currentBatch} de {importProgress.totalBatches} ({BATCH_SIZE} artículos por lote)
              </p>

              {/* Progress Bar */}
              <div style={{ width: '100%', maxWidth: '460px', height: '12px', background: 'var(--bg-app)', borderRadius: '9999px', overflow: 'hidden', border: '1px solid var(--border-light)', marginBottom: '1rem' }}>
                <div style={{
                  height: '100%',
                  width: `${importProgress.totalBatches > 0 ? (importProgress.currentBatch / importProgress.totalBatches) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #0284c7 0%, #06b6d4 100%)',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {importProgress.processedCount} artículos procesados
              </div>
            </div>
          )}

          {/* STEP 5: SUMMARY */}
          {step === 'SUMMARY' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#16a34a',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem'
                }}>
                  <CheckCircle size={32} />
                </div>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                  ¡Importación Finalizada!
                </h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Resumen de ejecución del catálogo de {activeStore?.name || 'su negocio'}.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.875rem', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16a34a' }}>{importProgress.successCount}</div>
                  <div style={{ fontSize: '0.78125rem', fontWeight: 700, color: '#15803d' }}>Artículos Nuevos Creados</div>
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.875rem', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706' }}>{importProgress.updatedCount}</div>
                  <div style={{ fontSize: '0.78125rem', fontWeight: 700, color: '#b45309' }}>Artículos Actualizados</div>
                </div>

                <div style={{ background: importProgress.errorCount > 0 ? '#fef2f2' : 'var(--bg-app)', border: `1px solid ${importProgress.errorCount > 0 ? '#fecaca' : 'var(--border-light)'}`, borderRadius: '0.875rem', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: importProgress.errorCount > 0 ? '#dc2626' : 'var(--text-muted)' }}>{importProgress.errorCount}</div>
                  <div style={{ fontSize: '0.78125rem', fontWeight: 700, color: importProgress.errorCount > 0 ? '#b91c1c' : 'var(--text-muted)' }}>Errores Omitidos</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Toolbar Navigation */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {step === 'MAP_COLUMNS' && (
            <button
              onClick={() => setStep('UPLOAD')}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                borderRadius: '0.625rem',
                padding: '0.5rem 1.25rem',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem'
              }}
            >
              <ArrowLeft size={16} /> Volver a Cargar
            </button>
          )}

          {step === 'PREVIEW' && (
            <button
              onClick={() => setStep('MAP_COLUMNS')}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                borderRadius: '0.625rem',
                padding: '0.5rem 1.25rem',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem'
              }}
            >
              <ArrowLeft size={16} /> Ajustar Mapeo
            </button>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
            {step === 'MAP_COLUMNS' && (
              <button
                onClick={handleProceedToPreview}
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.625rem',
                  padding: '0.5rem 1.5rem',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem'
                }}
              >
                Continuar a Vista Previa <ArrowRight size={16} />
              </button>
            )}

            {step === 'PREVIEW' && (
              <button
                onClick={handleExecuteBatchImport}
                disabled={newCount + updateCount === 0}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.625rem',
                  padding: '0.55rem 1.75rem',
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  cursor: newCount + updateCount > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  opacity: newCount + updateCount > 0 ? 1 : 0.5,
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <Check size={16} /> Importar {newCount + updateCount} Artículos Válidos
              </button>
            )}

            {step === 'SUMMARY' && (
              <button
                onClick={onClose}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.625rem',
                  padding: '0.5rem 1.75rem',
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                Cerrar e Ir al Catálogo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
