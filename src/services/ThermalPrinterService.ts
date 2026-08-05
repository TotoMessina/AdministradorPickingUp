export interface ReceiptData {
  ticketNumber: string;
  date: string;
  storeName: string;
  registerName: string;
  cashierName: string;
  customerName: string;
  invoiceType: string;
  cuit: string;
  items: Array<{
    description: string;
    qty: number;
    unitPrice: number;
    subtotal: number;
  }>;
  priceListName: string;
  rawSubtotal: number;
  discountAmount: number;
  discountPercent: number;
  finalTotal: number;
  paymentMethod: string;
  cashGiven: number;
  changeDue: number;
}

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;

export const ESC_POS_COMMANDS = {
  INIT: [ESC, 0x40], // Initialize printer
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  TEXT_NORMAL: [ESC, 0x21, 0x00],
  TEXT_DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  TEXT_DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  TEXT_DOUBLE_LARGE: [GS, 0x21, 0x11],
  OPEN_CASH_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xfa], // RJ11 Pin 2 pulse (25ms width, 250ms interval)
  CUT_PAPER_FULL: [GS, 0x56, 0x42, 0x00], // Full Cut
  CUT_PAPER_PARTIAL: [GS, 0x56, 0x01]
};

// Helper: Convert text string to CP850 / ASCII byte array
const encodeText = (text: string): number[] => {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else {
      // Basic spanish character translation for thermal printers
      switch (text[i]) {
        case 'á': bytes.push(0xa0); break;
        case 'é': bytes.push(0x82); break;
        case 'í': bytes.push(0xa1); break;
        case 'ó': bytes.push(0xa2); break;
        case 'ú': bytes.push(0xa3); break;
        case 'ñ': bytes.push(0xa4); break;
        case 'Ñ': bytes.push(0xa5); break;
        case '°': bytes.push(0xf8); break;
        default: bytes.push(0x3f); break; // '?'
      }
    }
  }
  return bytes;
};

// Helper: Format a 2-column fixed width row for 48-char 80mm thermal paper
const formatRow48 = (leftStr: string, rightStr: string, width = 48): string => {
  const leftMax = width - rightStr.length - 1;
  const truncatedLeft = leftStr.slice(0, leftMax);
  const spaces = ' '.repeat(Math.max(1, width - truncatedLeft.length - rightStr.length));
  return `${truncatedLeft}${spaces}${rightStr}`;
};

// Generate Full ESC/POS Binary Buffer Uint8Array
export const generateESCPOSBuffer = (receipt: ReceiptData, charWidth = 48): Uint8Array => {
  const buffer: number[] = [];

  const add = (bytes: number[]) => {
    bytes.forEach(b => buffer.push(b));
  };

  const addLine = (text = '') => {
    add(encodeText(text));
    buffer.push(0x0a); // LF
  };

  // 1. Initialize & Center Header
  add(ESC_POS_COMMANDS.INIT);
  add(ESC_POS_COMMANDS.ALIGN_CENTER);
  add(ESC_POS_COMMANDS.TEXT_DOUBLE_LARGE);
  add(ESC_POS_COMMANDS.BOLD_ON);
  addLine(receipt.storeName.toUpperCase());
  add(ESC_POS_COMMANDS.TEXT_NORMAL);
  add(ESC_POS_COMMANDS.BOLD_OFF);
  addLine('COMPROBANTE DE VENTA');
  addLine(`TICKET N°: ${receipt.ticketNumber}`);
  addLine(`TIPO: ${receipt.invoiceType} | CUIT: ${receipt.cuit}`);
  addLine('-'.repeat(charWidth));

  // 2. Info Block Left Aligned
  add(ESC_POS_COMMANDS.ALIGN_LEFT);
  addLine(`Fecha: ${receipt.date}`);
  addLine(`Caja: ${receipt.registerName} | Cajero: ${receipt.cashierName}`);
  addLine(`Cliente: ${receipt.customerName}`);
  addLine(`Lista de Precios: ${receipt.priceListName}`);
  addLine('='.repeat(charWidth));

  // 3. Items Table Header
  add(ESC_POS_COMMANDS.BOLD_ON);
  addLine(formatRow48('ARTICULO', 'SUBTOTAL', charWidth));
  add(ESC_POS_COMMANDS.BOLD_OFF);
  addLine('-'.repeat(charWidth));

  // 4. Items List
  receipt.items.forEach(item => {
    const itemTitle = `${item.description} (x${item.qty})`;
    const priceText = `$${item.subtotal.toFixed(2)}`;
    addLine(formatRow48(itemTitle, priceText, charWidth));
  });

  addLine('='.repeat(charWidth));

  // 5. Totals Right Aligned
  add(ESC_POS_COMMANDS.ALIGN_RIGHT);
  addLine(formatRow48('Subtotal:', `$${receipt.rawSubtotal.toFixed(2)}`, charWidth));
  if (receipt.discountAmount > 0) {
    addLine(formatRow48(`Descuento (${receipt.discountPercent}%):`, `-$${receipt.discountAmount.toFixed(2)}`, charWidth));
  }

  add(ESC_POS_COMMANDS.TEXT_DOUBLE_HEIGHT);
  add(ESC_POS_COMMANDS.BOLD_ON);
  addLine(formatRow48('TOTAL A PAGAR:', `$${receipt.finalTotal.toFixed(2)}`, charWidth));
  add(ESC_POS_COMMANDS.TEXT_NORMAL);
  add(ESC_POS_COMMANDS.BOLD_OFF);
  addLine('-'.repeat(charWidth));

  // 6. Payment Details
  addLine(formatRow48('Medio de Pago:', receipt.paymentMethod, charWidth));
  if (receipt.paymentMethod === 'Efectivo') {
    addLine(formatRow48('Monto Abonado:', `$${receipt.cashGiven.toFixed(2)}`, charWidth));
    addLine(formatRow48('Vuelto:', `$${receipt.changeDue.toFixed(2)}`, charWidth));
  }

  addLine('-'.repeat(charWidth));

  // 7. Footer
  add(ESC_POS_COMMANDS.ALIGN_CENTER);
  addLine('¡Muchas gracias por su compra!');
  addLine('Sistema PickingUp! POS Enterprise');
  addLine('\n\n');

  // 8. Open Cash Drawer (RJ11) & Paper Cut
  add(ESC_POS_COMMANDS.OPEN_CASH_DRAWER);
  add(ESC_POS_COMMANDS.CUT_PAPER_FULL);

  return new Uint8Array(buffer);
};

// --- WebUSB Native Thermal Printer Connection & Print Engine ---
let activeUSBDevice: any = null;

export const requestUSBPrinterDevice = async (): Promise<any> => {
  if (!('usb' in navigator)) {
    throw new Error('La API WebUSB no está soportada en este navegador.');
  }

  // Common thermal printer USB Vendor IDs (Epson 0x04b8, Hasar 0x0dd4, Star 0x051d, CH340 0x1a86, Custom 0x0483)
  const device = await (navigator as any).usb.requestDevice({
    filters: []
  });

  await device.open();
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }
  await device.claimInterface(0);
  activeUSBDevice = device;
  return device;
};

export const printDirectToUSB = async (receipt: ReceiptData): Promise<boolean> => {
  try {
    let device = activeUSBDevice;
    if (!device && 'usb' in navigator) {
      const devices = await (navigator as any).usb.getDevices();
      if (devices.length > 0) {
        device = devices[0];
        await device.open();
        if (device.configuration === null) await device.selectConfiguration(1);
        await device.claimInterface(0);
        activeUSBDevice = device;
      }
    }

    if (!device) {
      return false;
    }

    const binaryBuffer = generateESCPOSBuffer(receipt, 48);

    // Find Endpoint Out (typically endpoint #1 or #2)
    let endpointOut = 1;
    if (device.configuration && device.configuration.interfaces.length > 0) {
      const endpoints = device.configuration.interfaces[0].alternate.endpoints;
      const outEp = endpoints.find((e: any) => e.direction === 'out');
      if (outEp) endpointOut = outEp.endpointNumber;
    }

    await device.transferOut(endpointOut, binaryBuffer);
    return true;
  } catch (err) {
    console.warn('WebUSB direct print error:', err);
    return false;
  }
};

// Direct Cash Drawer Kick Pulse (RJ11)
export const kickCashDrawerDirect = async (): Promise<boolean> => {
  try {
    let device = activeUSBDevice;
    if (!device && 'usb' in navigator) {
      const devices = await (navigator as any).usb.getDevices();
      if (devices.length > 0) device = devices[0];
    }

    if (device) {
      const kickBuffer = new Uint8Array(ESC_POS_COMMANDS.OPEN_CASH_DRAWER);
      await device.transferOut(1, kickBuffer);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
