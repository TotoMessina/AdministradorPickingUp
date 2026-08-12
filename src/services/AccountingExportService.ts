// Helper for formatting AFIP fixed-width positional text lines
const padLeft = (val: string | number, len: number, char = '0'): string => {
  const str = String(val);
  return str.length >= len ? str.slice(0, len) : char.repeat(len - str.length) + str;
};

const padRight = (val: string | number, len: number, char = ' '): string => {
  const str = String(val);
  return str.length >= len ? str.slice(0, len) : str + char.repeat(len - str.length);
};

const formatDecimalAFIP = (val: number, len = 15): string => {
  const cents = Math.round(val * 100);
  return padLeft(cents, len, '0');
};

export interface SalesRecord {
  id: string;
  ticketNumber: string;
  date: string;
  customerName?: string;
  cuit?: string;
  invoiceType?: string;
  totalAmount: number;
}

// 1. Generate AFIP Libro IVA Digital Ventas (RG 3685 / RG 4597) Positional TXT
export const generateLibroIVAVentasTXT = (sales: SalesRecord[], period = 'Mes-Actual'): string => {
  const lines: string[] = [];

  sales.forEach((s) => {
    // AFIP Comprobante Date Format YYYYMMDD
    let dStr = '20260811';
    try {
      const d = new Date(s.date);
      if (!isNaN(d.getTime())) {
        dStr = d.toISOString().slice(0, 10).replace(/-/g, '');
      }
    } catch {}

    const tipoComp = s.invoiceType?.includes('A') ? '001' : (s.invoiceType?.includes('C') ? '011' : '006'); // 006: Factura B
    const puntoVenta = '00001';
    const numComp = padLeft((s.ticketNumber || s.id).replace(/\D/g, '') || '1', 20, '0');
    const numHasta = numComp;
    const docTipo = (s.cuit && s.cuit.length > 5) ? '80' : '99'; // 80: CUIT, 99: Consumidor Final
    const docNum = padLeft((s.cuit || '').replace(/\D/g, '') || '0', 20, '0');
    const clienteNombre = padRight((s.customerName || 'CONSUMIDOR FINAL').toUpperCase(), 30, ' ');

    const total = s.totalAmount || 0;
    const neto = Math.round((total / 1.21) * 100) / 100;
    const iva = Math.round((total - neto) * 100) / 100;

    const impTotalStr = formatDecimalAFIP(total, 15);
    const impNoGravStr = formatDecimalAFIP(0, 15);
    const impExentoStr = formatDecimalAFIP(0, 15);
    const impNetoStr = formatDecimalAFIP(neto, 15);
    const impIvaStr = formatDecimalAFIP(iva, 15);

    // Positional line format for AFIP CITI Ventas (278 characters per row)
    const line = `${dStr}${tipoComp}${puntoVenta}${numComp}${numHasta}${docTipo}${docNum}${clienteNombre}${impTotalStr}${impNoGravStr}${impExentoStr}000000000000000${impNetoStr}${impIvaStr}00000000000000000000000000000000000000000000000000PES0001000000101000000000000000`;
    lines.push(line);
  });

  return lines.join('\r\n');
};

// 2. Generate AFIP SICORE / SIFERE Retenciones TXT
export const generateSICORE_SIFERE_TXT = (sales: SalesRecord[], period = 'Mes-Actual'): string => {
  const lines: string[] = [];

  sales.forEach((s, idx) => {
    let dStr = '11/08/2026';
    try {
      const d = new Date(s.date);
      if (!isNaN(d.getTime())) {
        dStr = `${padLeft(d.getDate(), 2)}/${padLeft(d.getMonth() + 1, 2)}/${d.getFullYear()}`;
      }
    } catch {}

    const comprobanteNum = padLeft(idx + 1, 16, '0');
    const cuitCliente = padLeft((s.cuit || '20000000001').replace(/\D/g, ''), 11, '0');
    const impBase = formatDecimalAFIP(s.totalAmount || 0, 13);
    const impRetencion = formatDecimalAFIP((s.totalAmount || 0) * 0.03, 13); // 3% ret/perc

    // SICORE Positional format
    const line = `217${dStr}${comprobanteNum}${impBase}078701${impRetencion}000000000000${dStr}80${cuitCliente}000000000000`;
    lines.push(line);
  });

  return lines.join('\r\n');
};

// 3. Generate Valued Stock CSV / Excel Data Report
export const generateStockValuationCSV = (articles: any[], storeName = 'Comercio'): string => {
  const headers = [
    'Código Artículo',
    'Código de Barras',
    'Descripción',
    'Categoría',
    'Stock Actual',
    'Precio Costo ($)',
    'Precio Venta ($)',
    'Valorizado Costo Total ($)',
    'Valorizado Venta Total ($)',
    'Margen Ganancia ($)',
    'Margen Ganancia (%)'
  ];

  let totalCostVal = 0;
  let totalSaleVal = 0;

  const rows: string[] = [headers.join(';')];

  articles.forEach((a) => {
    const stock = Number(a.stock) || 0;
    const cost = Number(a.cost) || 0;
    const price = Number(a.price) || 0;
    const costVal = stock * cost;
    const saleVal = stock * price;
    const margin = price - cost;
    const marginPct = price > 0 ? ((margin / price) * 100).toFixed(1) : '0.0';

    totalCostVal += costVal;
    totalSaleVal += saleVal;

    rows.push([
      `"${a.code || ''}"`,
      `"${a.barcode || a.code || ''}"`,
      `"${(a.description || '').replace(/"/g, '""')}"`,
      `"${a.category || 'General'}"`,
      stock,
      cost.toFixed(2),
      price.toFixed(2),
      costVal.toFixed(2),
      saleVal.toFixed(2),
      margin.toFixed(2),
      `"${marginPct}%"`
    ].join(';'));
  });

  // Summary Row
  rows.push('');
  rows.push(`"RESUMEN GENERAL";"";"";"";"TOTALES";"";"";"${totalCostVal.toFixed(2)}";"${totalSaleVal.toFixed(2)}";"${(totalSaleVal - totalCostVal).toFixed(2)}";"${totalSaleVal > 0 ? (((totalSaleVal - totalCostVal) / totalSaleVal) * 100).toFixed(1) : 0}%"`);

  return "\uFEFF" + rows.join('\n');
};

// Download File Helper
export const triggerFileDownload = (content: string, filename: string, mimeType = 'text/plain;charset=utf-8;') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
