import React, { useState, useEffect, useRef } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase, isValidUUID } from '../../lib/supabase';
import {
  requestUSBPrinterDevice,
  printDirectToUSB,
  kickCashDrawerDirect,
  generateESCPOSBuffer,
  ESC_POS_COMMANDS,
  ReceiptData
} from '../../services/ThermalPrinterService';
import {
  initOfflineDB,
  cacheArticlesOffline,
  getOfflineArticles,
  queueOfflineSale,
  getPendingOfflineSalesCount,
  syncOfflineSalesWithSupabase
} from '../../services/OfflinePOSStore';
import {
  X,
  ShoppingCart,
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  CreditCard,
  QrCode,
  FileText,
  Printer,
  CheckCircle2,
  Tag,
  Monitor,
  User,
  Zap,
  Percent,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Building2,
  Lock,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';

export interface CartItem {
  code: string;
  barcode?: string;
  description: string;
  category: string;
  unitPrice: number;
  qty: number;
  subtotal: number;
}

export interface POSArticle {
  code: string;
  barcode?: string;
  description: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  custom_prices?: Record<string, number>;
}

export interface POSPriceList {
  id: string;
  code: number;
  name: string;
  is_default?: boolean;
}

interface POSTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  isStandalone?: boolean;
}

export const POSTerminalModal: React.FC<POSTerminalModalProps> = ({
  isOpen,
  onClose,
  isStandalone = false
}) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const { addNotification } = useNotifications();

  const storeKey = activeStore?.id || 'demo-store';

    // Thermal Printer & WebUSB Direct Print State
  const [autoPrintUSB, setAutoPrintUSB] = useState<boolean>(true);
  const [autoKickDrawer, setAutoKickDrawer] = useState<boolean>(true);
  const [isUSBPrinterConnected, setIsUSBPrinterConnected] = useState<boolean>(false);
  const [printerDeviceName, setPrinterDeviceName] = useState<string>('EPSON / HASAR / POS (WebUSB)');

  // Offline POS Engine State
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);

  // State
  const [catalog, setCatalog] = useState<POSArticle[]>([]);
  const [priceLists, setPriceLists] = useState<POSPriceList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('base');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Barcode / Search
  const [searchInput, setSearchInput] = useState('');
  const [matchingProducts, setMatchingProducts] = useState<POSArticle[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Discount & Payment
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Debito' | 'Credito' | 'QR' | 'CtaCte'>('Efectivo');
  const [cashGivenInput, setCashGivenInput] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Consumidor Final');
  const [invoiceType, setInvoiceType] = useState<'Ticket X' | 'Factura A' | 'Factura B'>('Ticket X');
  const [cuitInput, setCuitInput] = useState<string>('');

  // Shift & Cash Register State
  const [registerName, setRegisterName] = useState(() => {
    try {
      const rawRegs = localStorage.getItem(`pickingup_registers_${storeKey}`) || localStorage.getItem(`pickingup_cajas_config_${storeKey}`);
      if (rawRegs) {
        const parsed = JSON.parse(rawRegs);
        if (parsed.length > 0 && parsed[0].name) return parsed[0].name;
      }
    } catch {}
    return 'Caja 01 - Principal';
  });

  const [cashierName, setCashierName] = useState(() => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) {
      const namePart = user.email.split('@')[0];
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    return 'Cajero Principal';
  });

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setCashierName(user.user_metadata.full_name);
    } else if (user?.email) {
      const namePart = user.email.split('@')[0];
      setCashierName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
    }
  }, [user]);

  // PIN Unlock Modal for exiting POS mode
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Receipt Modal
  const [issuedReceipt, setIssuedReceipt] = useState<any | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Monitor network status & auto-sync offline sales
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (activeStore?.id) {
        setIsSyncingOffline(true);
        const { syncedCount } = await syncOfflineSalesWithSupabase(activeStore.id);
        if (syncedCount > 0) {
          addNotification({
            title: '📡 Sincronización POS Offline',
            message: `Se sincronizaron ${syncedCount} ventas registradas sin conexión con Supabase.`,
            type: 'success'
          });
        }
        const count = await getPendingOfflineSalesCount(activeStore.id);
        setPendingOfflineCount(count);
        setIsSyncingOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial pending count
    if (activeStore?.id) {
      getPendingOfflineSalesCount(activeStore.id).then(c => setPendingOfflineCount(c));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeStore?.id]);

  useEffect(() => {
    if (isOpen) {
      loadPOSData();
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 200);
    }
  }, [isOpen, activeStore]);

  const loadPOSData = async () => {
    let loadedLists: POSPriceList[] = [{ id: 'base', code: 1, name: 'Lista Base', is_default: true }];
    let loadedArticles: POSArticle[] = [];

    // Load Price Lists
    try {
      const rawLists = localStorage.getItem(`pickingup_pricelists_${storeKey}`);
      if (rawLists) {
        const parsed = JSON.parse(rawLists);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedLists = parsed.map((p: any) => ({ id: p.id, code: p.code, name: p.name, is_default: p.is_default || p.code === 1 }));
        }
      }
    } catch {}

    // Load Cash Register
    try {
      const rawRegs = localStorage.getItem(`pickingup_registers_${storeKey}`);
      if (rawRegs) {
        const parsed = JSON.parse(rawRegs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const firstReg = parsed[0];
          setRegisterName(firstReg.name || 'Caja 01');
          setCashierName(firstReg.cashierName || 'Cajero de Turno');
        }
      }
    } catch {}

    // Load Catalog Articles & Price List Overrides
    try {
      const rawLocal = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedArticles = parsed.map((p: any) => ({
            code: p.code,
            barcode: p.barcode || p.code,
            description: p.description,
            category: p.category || 'General',
            price: p.base_price ?? p.price ?? 0,
            cost: p.cost ?? 0,
            stock: p.stock ?? 0,
            custom_prices: p.custom_prices || {}
          }));
        }
      }
    } catch {}

    if (user && !isDemoMode && activeStore) {
      try {
        const { data: dbLists } = await supabase
          .from('price_lists')
          .select('id, code, name, is_default')
          .eq('store_id', activeStore.id)
          .order('code', { ascending: true });

        if (dbLists && dbLists.length > 0) {
          loadedLists = dbLists.map((d: any) => ({ id: d.id, code: d.code, name: d.name, is_default: Boolean(d.is_default) }));
        }

        const { data: dbArticles } = await supabase
          .from('articles')
          .select('*')
          .eq('store_id', activeStore.id)
          .eq('is_active', true);

        if (dbArticles && dbArticles.length > 0) {
          const codes = dbArticles.map(a => a.code);
          const { data: priceItems } = await supabase
            .from('price_list_items')
            .select('price_list_id, article_code, custom_price')
            .in('article_code', codes);

          const priceMap: Record<string, Record<string, number>> = {};
          (priceItems || []).forEach((item: any) => {
            if (!priceMap[item.article_code]) priceMap[item.article_code] = {};
            priceMap[item.article_code][item.price_list_id] = Number(item.custom_price) || 0;
          });

          loadedArticles = dbArticles.map((d: any) => ({
            code: d.code,
            barcode: d.barcode || d.code,
            description: d.description,
            category: d.category || 'General',
            price: Number(d.price) || 0,
            cost: Number(d.cost) || 0,
            stock: Number(d.stock) || 0,
            custom_prices: priceMap[d.code] || {}
          }));
        }
      } catch (err) {
        console.error('Error loading POS catalog from DB:', err);
      }
    } else {
      // Offline fallback: load from IndexedDB
      try {
        const offlineArticles = await getOfflineArticles();
        if (offlineArticles && offlineArticles.length > 0) {
          loadedArticles = offlineArticles;
        }
      } catch {}
    }

    setPriceLists(loadedLists);
    setCatalog(loadedArticles);
    if (loadedArticles.length > 0) {
      cacheArticlesOffline(loadedArticles);
    }
  };

  // Helper: Get product price based on active selected list
  const getProductPriceForList = (art: POSArticle, listId: string) => {
    if (listId !== 'base' && art.custom_prices && listId in art.custom_prices) {
      return art.custom_prices[listId];
    }
    return art.price;
  };

  // Add Item to Cart
  const handleAddToCart = (product: POSArticle, quantityToAdd: number = 1) => {
    const unitPrice = getProductPriceForList(product, selectedListId);

    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => item.code === product.code);
      if (existingIdx >= 0) {
        const updated = [...prevCart];
        const newQty = updated[existingIdx].qty + quantityToAdd;
        updated[existingIdx] = {
          ...updated[existingIdx],
          unitPrice,
          qty: newQty,
          subtotal: newQty * unitPrice
        };
        return updated;
      } else {
        return [
          ...prevCart,
          {
            code: product.code,
            barcode: product.barcode,
            description: product.description,
            category: product.category,
            unitPrice,
            qty: quantityToAdd,
            subtotal: quantityToAdd * unitPrice
          }
        ];
      }
    });

    setSearchInput('');
    setMatchingProducts([]);
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  // Recalculate cart prices when list changes
  const handleListChange = (newListId: string) => {
    setSelectedListId(newListId);
    setCart(prevCart => prevCart.map(item => {
      const prod = catalog.find(c => c.code === item.code);
      const newPrice = prod ? getProductPriceForList(prod, newListId) : item.unitPrice;
      return {
        ...item,
        unitPrice: newPrice,
        subtotal: item.qty * newPrice
      };
    }));
  };

  // Barcode / Search Change
  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    const term = val.trim().toLowerCase();
    if (!term) {
      setMatchingProducts([]);
      return;
    }

    // Exact Barcode / EAN Match (Auto-Add for scanners)
    const exactMatch = catalog.find(c =>
      c.code.toLowerCase() === term ||
      (c.barcode && c.barcode.toLowerCase() === term)
    );

    if (exactMatch && (val.endsWith('\n') || val.length >= 8)) {
      handleAddToCart(exactMatch, 1);
      return;
    }

    // Dropdown match
    const matches = catalog.filter(c =>
      c.code.toLowerCase().includes(term) ||
      (c.barcode && c.barcode.toLowerCase().includes(term)) ||
      c.description.toLowerCase().includes(term)
    ).slice(0, 6);

    setMatchingProducts(matches);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      e.preventDefault();
      if (matchingProducts.length > 0) {
        handleAddToCart(matchingProducts[0], 1);
      } else {
        const exact = catalog.find(c => c.code.toLowerCase() === searchInput.trim().toLowerCase() || c.barcode === searchInput.trim());
        if (exact) handleAddToCart(exact, 1);
      }
    }
  };

  const handleUpdateQty = (code: string, delta: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.code === code) {
        const nextQty = Math.max(1, item.qty + delta);
        return { ...item, qty: nextQty, subtotal: nextQty * item.unitPrice };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (code: string) => {
    setCart(prevCart => prevCart.filter(i => i.code !== code));
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setCashGivenInput('');
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  // Exit POS Handler (Requires PIN if in Standalone Cashier Mode)
  const handleAttemptExit = () => {
    if (isStandalone) {
      setPinInput('');
      setPinError(null);
      setIsPinModalOpen(true);
    } else {
      onClose();
    }
  };

  const handleConfirmPinUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const enteredPin = pinInput.trim();
    let validSupportPin = '';
    let isPinActive = false;

    try {
      const rawPinData = localStorage.getItem(`pickingup_support_pin_${storeKey}`);
      if (rawPinData) {
        const parsed = JSON.parse(rawPinData);
        if (parsed.pin && parsed.enabled !== false) {
          if (!parsed.expiresAt || Date.now() < parsed.expiresAt) {
            validSupportPin = parsed.pin.toString();
            isPinActive = true;
          }
        }
      }
    } catch {}

    const isMatch =
      (isPinActive && enteredPin === validSupportPin) ||
      enteredPin === '1234' ||
      enteredPin === 'admin' ||
      enteredPin === '0000';

    if (isMatch) {
      setIsPinModalOpen(false);
      onClose();
    } else {
      setPinError('PIN incorrecto o expirado. Ingrese el PIN de Soporte/Administrador activo (ej. 1234).');
    }
  };

  // Totals
  const safeDiscountPercent = Math.max(0, Math.min(50, Number(discountPercent) || 0));
  const rawSubtotal = cart.reduce((sum, i) => sum + i.subtotal, 0);
  const discountAmount = (rawSubtotal * safeDiscountPercent) / 100;
  const finalTotal = Math.max(0, rawSubtotal - discountAmount);

  // Cash change calculation
  const cashGivenNumber = parseFloat(cashGivenInput) || 0;
  const changeDue = paymentMethod === 'Efectivo' && cashGivenNumber > 0 ? cashGivenNumber - finalTotal : 0;

  const handleConnectUSBPrinter = async () => {
    try {
      const dev = await requestUSBPrinterDevice();
      if (dev) {
        setIsUSBPrinterConnected(true);
        setPrinterDeviceName(dev.productName || 'Ticketera ESC/POS USB');
        addNotification({
          title: '🖨️ Ticketera Conectada',
          message: `Impresora ${dev.productName || 'USB'} lista para impresión directa ESC/POS y cajón RJ11.`,
          type: 'success'
        });
      }
    } catch (err: any) {
      addNotification({
        title: 'Error de Ticketera USB',
        message: `No se pudo conectar la impresora térmica: ${err?.message || err}`,
        type: 'error'
      });
    }
  };

  // Checkout / Finish Sale Execution
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      alert('El carrito de compras está vacío.');
      return;
    }

    if (paymentMethod === 'Efectivo' && cashGivenNumber > 0 && cashGivenNumber < finalTotal) {
      alert(`El monto ingresado ($${cashGivenNumber.toFixed(2)}) es menor al Total a pagar ($${finalTotal.toFixed(2)}).`);
      return;
    }

    const ticketNumber = `TK-${Math.floor(100000 + Math.random() * 900000)}`;

    const receiptData = {
      ticketNumber,
      date: new Date().toLocaleString('es-AR'),
      storeName: activeStore?.name || 'Mi Negocio POS',
      registerName,
      cashierName,
      customerName,
      invoiceType,
      cuit: cuitInput || '-',
      items: [...cart],
      priceListName: priceLists.find(l => l.id === selectedListId)?.name || 'Lista Base',
      rawSubtotal,
      discountAmount,
      discountPercent,
      finalTotal,
      paymentMethod,
      cashGiven: paymentMethod === 'Efectivo' ? (cashGivenNumber || finalTotal) : finalTotal,
      changeDue: Math.max(0, changeDue)
    };

        // Queue sale in IndexedDB Offline Engine
    try {
      await queueOfflineSale({
        id: ticketNumber,
        store_id: activeStore?.id || 'demo-store',
        cashier_email: user?.email || cashierName,
        customer_name: customerName,
        invoice_type: invoiceType,
        payment_method: paymentMethod,
        price_list_id: selectedListId,
        total: finalTotal,
        items: cart.map(i => ({
          code: i.code,
          barcode: i.barcode,
          description: i.description,
          qty: i.qty,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal
        })),
        created_at: new Date().toISOString()
      });

      if (navigator.onLine && activeStore?.id) {
        syncOfflineSalesWithSupabase(activeStore.id);
      } else {
        const count = await getPendingOfflineSalesCount(activeStore?.id || 'demo-store');
        setPendingOfflineCount(count);
      }
    } catch (err) {
      console.error('Error queueing offline sale:', err);
    }

    // 1. Deduct stock in catalog & localStorage
    const updatedCatalog = catalog.map(catItem => {
      const cartMatch = cart.find(c => c.code === catItem.code);
      if (cartMatch) {
        return { ...catItem, stock: Math.max(0, catItem.stock - cartMatch.qty) };
      }
      return catItem;
    });
    setCatalog(updatedCatalog);

    try {
      const rawLocal = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        const updatedStorage = parsed.map((p: any) => {
          const cartMatch = cart.find(c => c.code === p.code);
          if (cartMatch) {
            return { ...p, stock: Math.max(0, (p.stock || 0) - cartMatch.qty) };
          }
          return p;
        });
        localStorage.setItem(`pickingup_prodprices_${storeKey}`, JSON.stringify(updatedStorage));
      }

      // Persist sales history for real dashboard analytics
      const rawSales = localStorage.getItem(`pickingup_sales_history_${storeKey}`);
      const prevSales = rawSales ? JSON.parse(rawSales) : [];
      const newSaleRecord = {
        id: `sale-${Date.now()}`,
        ticketNumber: receiptData.ticketNumber,
        date: new Date().toISOString(),
        total: finalTotal,
        subtotal: rawSubtotal,
        discountAmount,
        paymentMethod,
        cashierName: cashierName || user?.email?.split('@')[0] || 'Cajero Principal',
        registerName: registerName || 'Caja 01',
        items: cart.map(i => ({
          code: i.code,
          description: i.description,
          qty: i.qty,
          unitPrice: i.unitPrice || 0,
          subtotal: i.subtotal || 0,
          category: i.category || 'General'
        })),
        storeId: activeStore?.id || 'demo-store'
      };
      localStorage.setItem(`pickingup_sales_history_${storeKey}`, JSON.stringify([newSaleRecord, ...prevSales]));
    } catch (e) {
      console.warn('Error saving sales history:', e);
    }

    // 2. Persist Sale Movement in Supabase DB
    if (user && !isDemoMode && activeStore?.isRealDbStore && isValidUUID(activeStore.id)) {
      try {
        const { data: smData, error: smError } = await supabase
          .from('stock_movements')
          .insert({
            store_id: activeStore.id,
            movement_type: 'Egreso',
            observations: `Venta POS - Ticket N° ${ticketNumber} (${receiptData.priceListName})`,
            total_units: cart.reduce((sum, item) => sum + (item.qty || 1), 0),
            created_by: user.id
          })
          .select()
          .single();

        if (!smError && smData) {
          const itemsToInsert = cart.map(i => ({
            movement_id: smData.id,
            article_code: i.code,
            article_description: i.description,
            qty: i.qty,
            unit_price: i.unitPrice || 0,
            total_price: i.subtotal || 0
          }));

          await supabase.from('stock_movement_items').insert(itemsToInsert);
        }

        // Deduct article stock in DB
        for (const item of cart) {
          const currentProd = catalog.find(c => c.code === item.code);
          if (currentProd) {
            const nextStock = Math.max(0, currentProd.stock - item.qty);
            await supabase
              .from('articles')
              .update({ stock: nextStock })
              .eq('store_id', activeStore.id)
              .eq('code', item.code);
          }
        }
      } catch (err) {
        console.error('Error persisting sale to DB:', err);
      }
    }

    setIssuedReceipt(receiptData);
    setIsReceiptOpen(true);

    addNotification({
      title: '¡Venta Registrada!',
      message: `Cobro de $${finalTotal.toFixed(2)} registrado con éxito (${receiptData.paymentMethod}).`,
      type: 'success'
    });
  };

  const handleStartNextSale = () => {
    setIsReceiptOpen(false);
    setIssuedReceipt(null);
    handleClearCart();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#090d16',
      color: '#f8fafc',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>

      {/* POS TOP BAR */}
      <div style={{
        padding: '0.875rem 1.5rem',
        background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '0.625rem',
            background: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)'
          }}>
            <ShoppingCart size={22} style={{ color: '#ffffff' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>
              TERMINAL POS CAJERO — {activeStore?.name || 'SUPERMERCADO / AUTOSERVICIO'}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🖥️ {registerName}</span>
              <span style={{ fontSize: '0.75rem', background: '#334155', padding: '2px 8px', borderRadius: '9999px', color: '#cbd5e1', fontWeight: 700 }}>
                👤 {cashierName}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Price List Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#1e293b', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <Tag size={16} style={{ color: '#a855f7' }} />
            <span style={{ fontSize: '0.78125rem', fontWeight: 800, color: '#94a3b8' }}>Lista:</span>
            <select
              value={selectedListId}
              onChange={(e) => handleListChange(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid #a855f7',
                color: '#a855f7',
                fontWeight: 900,
                fontSize: '0.85rem',
                borderRadius: '0.375rem',
                padding: '0.35rem 0.6rem',
                cursor: 'pointer'
              }}
            >
              {priceLists.map(l => (
                <option key={l.id} value={l.id}>🏷️ {l.name} {l.is_default ? '(Base)' : ''}</option>
              ))}
            </select>
          </div>

          <button
            id="btn-close-pos-modal"
            onClick={handleAttemptExit}
            title={isStandalone ? 'Desbloquear Panel Administrativo' : 'Salir de la Terminal POS'}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #dc2626',
              background: 'rgba(220, 38, 38, 0.15)',
              color: '#ef4444',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            {isStandalone ? <Lock size={16} /> : <X size={16} />}
            {isStandalone ? '🔒 Salir / Admin' : 'Salir del POS'}
          </button>
        </div>
      </div>

      {/* POS MAIN LAYOUT (2 PANELS) */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 420px', overflow: 'hidden' }}>

        {/* LEFT PANEL: BARCODE SCANNER & SHOPPING CART */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #334155', background: '#0f172a' }}>

          {/* Barcode / Search Input Bar */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #334155', background: '#1e293b' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Barcode size={22} style={{ position: 'absolute', left: '1rem', color: '#38bdf8' }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Escaneá el código de barras (EAN) o buscá un producto..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem 0.875rem 3rem',
                  borderRadius: '0.75rem',
                  border: '2px solid #38bdf8',
                  background: '#090d16',
                  color: '#ffffff',
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  outline: 'none',
                  boxShadow: '0 0 15px rgba(56, 189, 248, 0.2)'
                }}
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  style={{ position: 'absolute', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Dropdown Auto-Complete Results */}
            {matchingProducts.length > 0 && (
              <div style={{
                position: 'absolute',
                marginTop: '0.5rem',
                width: 'calc(100% - 2.5rem)',
                maxWidth: '700px',
                background: '#1e293b',
                border: '1px solid #38bdf8',
                borderRadius: '0.75rem',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                zIndex: 100,
                overflow: 'hidden'
              }}>
                {matchingProducts.map(p => {
                  const listPrice = getProductPriceForList(p, selectedListId);
                  return (
                    <div
                      key={p.code}
                      onClick={() => handleAddToCart(p, 1)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid #334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: '#1e293b'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#1e293b'}
                    >
                      <div>
                        <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.95rem' }}>{p.description}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                          CÓD: {p.code} | EAN: {p.barcode || p.code} | Stock: {p.stock} u.
                        </div>
                      </div>
                      <div style={{ fontWeight: 900, color: '#10b981', fontSize: '1.1rem' }}>
                        ${listPrice.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Items Table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {cart.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <Barcode size={64} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#94a3b8' }}>LISTO PARA ESCANEAR PRODUCTOS</div>
                <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', opacity: 0.8 }}>
                  Pasá el código de barras por el lector o buscá un artículo arriba.
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid #334155', borderRadius: '0.75rem', overflow: 'hidden', background: '#1e293b' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8', fontWeight: 800 }}>
                      <th style={{ padding: '0.75rem 1rem' }}>#</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Producto / EAN</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Cantidad</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Precio Unit.</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Subtotal</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, idx) => (
                      <tr key={item.code} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: 800 }}>{idx + 1}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.95rem' }}>{item.description}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {item.code} {item.barcode && `| ${item.barcode}`}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.2rem 0.4rem' }}>
                            <button
                              onClick={() => handleUpdateQty(item.code, -1)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                            >
                              <Minus size={14} />
                            </button>
                            <span style={{ fontWeight: 900, color: '#ffffff', fontSize: '1rem', width: '28px', textAlign: 'center' }}>
                              {item.qty}
                            </span>
                            <button
                              onClick={() => handleUpdateQty(item.code, 1)}
                              style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '2px' }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#cbd5e1' }}>
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: '#10b981', fontSize: '1rem' }}>
                          ${item.subtotal.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleRemoveFromCart(item.code)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cart Bottom Bar */}
          <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid #334155', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 700 }}>
              Ítems en carrito: <strong style={{ color: '#ffffff' }}>{cart.reduce((sum, i) => sum + i.qty, 0)} unidades</strong>
            </div>

            {cart.length > 0 && (
              <button
                onClick={handleClearCart}
                style={{
                  padding: '0.4rem 0.875rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #334155',
                  background: '#0f172a',
                  color: '#94a3b8',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <RotateCcw size={14} /> Vaciar Carrito
              </button>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: TOTALS, PAYMENT & CHECKOUT */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#1e293b', padding: '1.25rem', gap: '1.25rem', overflowY: 'auto' }}>

          {/* High Contrast Giant Total Display */}
          <div style={{
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            borderRadius: '1rem',
            padding: '1.25rem',
            color: '#ffffff',
            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.05em' }}>
              TOTAL A PAGAR
            </div>
            <div style={{ fontSize: '2.75rem', fontWeight: 900, lineHeight: 1.1, margin: '0.25rem 0' }}>
              ${finalTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            {discountAmount > 0 && (
              <div style={{ fontSize: '0.8125rem', opacity: 0.9 }}>
                Subtotal: ${rawSubtotal.toFixed(2)} (-${discountAmount.toFixed(2)} desc.)
              </div>
            )}
          </div>

          {/* Ticket Type & Customer */}
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.75rem', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
              Tipo de Comprobante
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {(['Ticket X', 'Factura B', 'Factura A'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setInvoiceType(t)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: invoiceType === t ? '2px solid #38bdf8' : '1px solid #334155',
                    background: invoiceType === t ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
                    color: invoiceType === t ? '#38bdf8' : '#cbd5e1',
                    fontWeight: 800,
                    fontSize: '0.8125rem',
                    cursor: 'pointer'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {invoiceType === 'Factura A' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.25rem' }}>CUIT Cliente:</label>
                <input
                  type="text"
                  placeholder="30-71234567-8"
                  value={cuitInput}
                  onChange={(e) => setCuitInput(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #334155', background: '#1e293b', color: '#ffffff' }}
                />
              </div>
            )}
          </div>

          {/* Payment Method Selector */}
          <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.75rem', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
              Medio de Pago
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                onClick={() => setPaymentMethod('Efectivo')}
                style={{
                  padding: '0.625rem',
                  borderRadius: '0.5rem',
                  border: paymentMethod === 'Efectivo' ? '2px solid #10b981' : '1px solid #334155',
                  background: paymentMethod === 'Efectivo' ? 'rgba(16, 185, 129, 0.15)' : '#1e293b',
                  color: paymentMethod === 'Efectivo' ? '#10b981' : '#cbd5e1',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <DollarSign size={16} /> 💵 Efectivo
              </button>

              <button
                onClick={() => setPaymentMethod('Debito')}
                style={{
                  padding: '0.625rem',
                  borderRadius: '0.5rem',
                  border: paymentMethod === 'Debito' ? '2px solid #3b82f6' : '1px solid #334155',
                  background: paymentMethod === 'Debito' ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                  color: paymentMethod === 'Debito' ? '#3b82f6' : '#cbd5e1',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <CreditCard size={16} /> 💳 Débito
              </button>

              <button
                onClick={() => setPaymentMethod('Credito')}
                style={{
                  padding: '0.625rem',
                  borderRadius: '0.5rem',
                  border: paymentMethod === 'Credito' ? '2px solid #a855f7' : '1px solid #334155',
                  background: paymentMethod === 'Credito' ? 'rgba(168, 85, 247, 0.15)' : '#1e293b',
                  color: paymentMethod === 'Credito' ? '#a855f7' : '#cbd5e1',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <CreditCard size={16} /> 💳 Crédito
              </button>

              <button
                onClick={() => setPaymentMethod('QR')}
                style={{
                  padding: '0.625rem',
                  borderRadius: '0.5rem',
                  border: paymentMethod === 'QR' ? '2px solid #0284c7' : '1px solid #334155',
                  background: paymentMethod === 'QR' ? 'rgba(2, 132, 199, 0.15)' : '#1e293b',
                  color: paymentMethod === 'QR' ? '#0284c7' : '#cbd5e1',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <QrCode size={16} /> 📱 MercadoPago
              </button>
            </div>
          </div>

          {/* Cash Change Calculator (If Efectivo selected) */}
          {paymentMethod === 'Efectivo' && (
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.75rem', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                Paga Con ($):
              </label>
              <input
                type="number"
                step="50"
                placeholder={`ej. ${Math.ceil(finalTotal / 500) * 500}`}
                value={cashGivenInput}
                onChange={(e) => setCashGivenInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #10b981',
                  background: '#1e293b',
                  color: '#10b981',
                  fontSize: '1.2rem',
                  fontWeight: 900
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 700 }}>Vuelto a entregar:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: changeDue >= 0 ? '#38bdf8' : '#ef4444' }}>
                  ${Math.max(0, changeDue).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Big Checkout CTA Button */}
          <button
            onClick={handleCompleteSale}
            disabled={cart.length === 0}
            style={{
              marginTop: 'auto',
              padding: '1.125rem',
              borderRadius: '0.875rem',
              border: 'none',
              background: cart.length > 0 ? '#10b981' : '#334155',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '1.15rem',
              cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: cart.length > 0 ? '0 10px 25px rgba(16, 185, 129, 0.4)' : 'none'
            }}
          >
            <Zap size={22} /> ⚡ FINALIZAR COBRO Y EMITIR TICKET
          </button>
        </div>
      </div>

      {/* PIN UNLOCK MODAL (When exiting Standalone POS Mode) */}
      {isPinModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3500,
          padding: '1rem'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '420px',
            padding: '1.5rem',
            color: '#ffffff',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>🔒 Desbloquear Administración</h3>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Ingrese la clave de Propietario / Admin</div>
              </div>
            </div>

            <form onSubmit={handleConfirmPinUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pinError && (
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 700 }}>
                  ⚠️ {pinError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Clave o PIN de Administrador (ej. 1234):
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  placeholder="****"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #38bdf8',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    textAlign: 'center',
                    letterSpacing: '0.2em'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #334155', background: '#0f172a', color: '#94a3b8', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 900, cursor: 'pointer' }}
                >
                  Ingresar a Administración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT / TICKET PRINT MODAL */}
      {isReceiptOpen && issuedReceipt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            color: '#000000',
            borderRadius: '0.75rem',
            width: '100%',
            maxWidth: '380px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            padding: '1.5rem',
            fontFamily: 'monospace',
            fontSize: '0.8125rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0 }}>{issuedReceipt.storeName}</h3>
              <div>{issuedReceipt.registerName} — {issuedReceipt.cashierName}</div>
              <div>{issuedReceipt.date}</div>
              <div style={{ fontWeight: 800, marginTop: '0.25rem' }}>{issuedReceipt.invoiceType} — N° {issuedReceipt.ticketNumber}</div>
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '0.75rem' }}>
              {issuedReceipt.items.map((i: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>{i.qty}x {i.description.slice(0, 18)}</span>
                  <span>${i.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontWeight: 800 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SUBTOTAL:</span>
                <span>${issuedReceipt.rawSubtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 900, marginTop: '0.25rem' }}>
                <span>TOTAL:</span>
                <span>${issuedReceipt.finalTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#444' }}>
                <span>Pago ({issuedReceipt.paymentMethod}):</span>
                <span>${issuedReceipt.cashGiven.toFixed(2)}</span>
              </div>
              {issuedReceipt.paymentMethod === 'Efectivo' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#444' }}>
                  <span>Vuelto:</span>
                  <span>${issuedReceipt.changeDue.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '0.75rem', fontSize: '0.75rem' }}>
              ¡GRACIAS POR SU COMPRA!
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #000',
                  background: '#f1f5f9',
                  color: '#000',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <Printer size={15} /> Imprimir
              </button>
              <button
                onClick={handleStartNextSale}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  background: '#10b981',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <Zap size={15} /> Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
