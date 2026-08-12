import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { supabase } from '../../lib/supabase';
import { BaseModal } from './BaseModal';
import {
  X,
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  Layers,
  Filter,
  AlertTriangle,
  Download,
  Upload,
  RotateCcw,
  Save,
  DollarSign,
  Info,
  ArrowUpDown
} from 'lucide-react';
import { BulkArticleImportModal } from './BulkArticleImportModal';

export interface ArticleItem {
  id?: string;
  code: string;
  barcode?: string;
  description: string;
  category: string;
  family?: string;
  subfamily?: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
  is_priority_pricing?: boolean;
  custom_prices?: Record<string, number>;
  created_at?: string;
}

export interface PriceListSimple {
  id: string;
  code: number;
  name: string;
  is_default?: boolean;
}

interface ArticlesManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'articles' | 'categories' | 'deactivated';
  onOpenPriceLists?: () => void;
  onOpenInventory?: () => void;
}

export const ArticlesManagementModal: React.FC<ArticlesManagementModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'articles',
  onOpenPriceLists,
  onOpenInventory
}) => {
  const { activeStore } = useTenant();
  const { user, isDemoMode } = useAuth();
  const { addNotification } = useNotifications();

  const storeKey = activeStore?.id || 'demo-store';

  const [activeTab, setActiveTab] = useState<'articles' | 'categories' | 'deactivated'>(initialTab);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListSimple[]>([]);
  const [selectedViewListId, setSelectedViewListId] = useState<string>('base');
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<string[]>(['General', 'Almacén', 'Bebidas', 'Lácteos', 'Limpieza', 'Fiambrería', 'Golosinas']);
  const [families, setFamilies] = useState<string[]>(['General', 'Comestibles', 'Bebidas Sin Alcohol', 'Lácteos Frescos', 'Cuidado Personal']);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CRITICAL' | 'NO_PRICE'>('ALL');
  const [sortBy, setSortBy] = useState<'MODIFIED_DESC' | 'NAME_ASC' | 'NAME_DESC' | 'CREATED_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'STOCK_ASC' | 'STOCK_DESC'>('MODIFIED_DESC');

  // Server-Side Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Modal Form State (Create / Edit Article)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleItem | null>(null);
  const [formData, setFormData] = useState<ArticleItem>({
    code: '',
    barcode: '',
    description: '',
    category: 'General',
    family: 'General',
    subfamily: 'General',
    price: 0,
    cost: 0,
    stock: 0,
    min_stock: 5,
    is_active: true,
    custom_prices: {}
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPriceListsAndArticles();
    }
  }, [isOpen, activeStore, currentPage, pageSize, debouncedSearch, selectedCategory, activeTab, sortBy]);

  const isValidUUID = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

  const loadPriceListsAndArticles = async () => {
    setLoading(true);
    let loadedLists: PriceListSimple[] = [{ id: 'base', code: 1, name: 'Lista Base (Predeterminada)', is_default: true }];
    let loadedArticles: ArticleItem[] = [];
    let recordCount = 0;

    // 1. Load Price Lists from DB / localStorage
    try {
      const rawLists = localStorage.getItem(`pickingup_pricelists_${storeKey}`);
      if (rawLists) {
        const parsed = JSON.parse(rawLists);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedLists = parsed.map((p: any) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            is_default: p.is_default || p.code === 1
          }));
        }
      }
    } catch {}

    if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
      try {
        const { data: dbLists } = await supabase
          .from('price_lists')
          .select('id, code, name, is_default')
          .eq('store_id', activeStore.id)
          .order('code', { ascending: true });

        if (dbLists && dbLists.length > 0) {
          loadedLists = dbLists.map((d: any) => ({
            id: d.id,
            code: d.code,
            name: d.name,
            is_default: Boolean(d.is_default)
          }));
        }
      } catch {}
    }
    setPriceLists(loadedLists);

    // 2. Server-Side Paginated Query (.range(from, to)) with count: 'exact'
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    if (user && !isDemoMode && activeStore && isValidUUID(activeStore.id)) {
      try {
        let query = supabase
          .from('articles')
          .select('*', { count: 'exact' })
          .eq('store_id', activeStore.id)
          .eq('is_active', activeTab !== 'deactivated');

        if (debouncedSearch.trim()) {
          const term = `%${debouncedSearch.trim()}%`;
          query = query.or(`description.ilike.${term},code.ilike.${term},barcode.ilike.${term},category.ilike.${term}`);
        }

        if (selectedCategory !== 'ALL') {
          query = query.eq('category', selectedCategory);
        }

        if (sortBy === 'NAME_ASC') query = query.order('description', { ascending: true });
        else if (sortBy === 'NAME_DESC') query = query.order('description', { ascending: false });
        else query = query.order('created_at', { ascending: false });

        const { data: dbArticles, count, error } = await query.range(from, to);

        if (!error && dbArticles) {
          recordCount = count || dbArticles.length;
          const articleCodes = dbArticles.map(a => a.code);
          const priceMap: Record<string, Record<string, number>> = {};

          if (articleCodes.length > 0) {
            const { data: priceItems } = await supabase
              .from('price_list_items')
              .select('price_list_id, article_code, custom_price')
              .in('article_code', articleCodes);

            (priceItems || []).forEach((item: any) => {
              if (!priceMap[item.article_code]) priceMap[item.article_code] = {};
              priceMap[item.article_code][item.price_list_id] = Number(item.custom_price) || 0;
            });
          }

          loadedArticles = dbArticles.map((d: any) => ({
            id: d.id,
            code: d.code,
            barcode: d.barcode || d.code,
            description: d.description,
            category: d.category || 'General',
            family: d.family || 'General',
            subfamily: d.subfamily || 'General',
            price: Number(d.price) || 0,
            cost: Number(d.cost) || 0,
            stock: Number(d.stock) || 0,
            min_stock: Number(d.min_stock) || 5,
            is_active: d.is_active !== undefined ? d.is_active : true,
            is_priority_pricing: d.is_priority_pricing || false,
            custom_prices: priceMap[d.code] || {},
            created_at: d.created_at
          }));
        }
      } catch (err) {
        console.error('Error fetching paginated articles from DB:', err);
      }
    } else {
      // Offline Local Storage Fallback with client pagination simulation
      try {
        const rawLocal = localStorage.getItem(`pickingup_prodprices_${storeKey}`);
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed) && parsed.length > 0) {
            let filtered = parsed.filter((p: any) => (activeTab === 'deactivated' ? !p.is_active : (p.is_active !== false)));
            if (debouncedSearch.trim()) {
              const term = debouncedSearch.toLowerCase();
              filtered = filtered.filter((p: any) => (p.description || '').toLowerCase().includes(term) || (p.code || '').toLowerCase().includes(term));
            }
            recordCount = filtered.length;
            loadedArticles = filtered.slice(from, to + 1).map((p: any) => ({
              id: p.id || p.code,
              code: p.code,
              barcode: p.barcode || p.code,
              description: p.description,
              category: p.category || 'General',
              family: p.family || 'General',
              subfamily: p.subfamily || 'General',
              price: p.base_price ?? p.price ?? 0,
              cost: p.cost ?? 0,
              stock: p.stock ?? 0,
              min_stock: p.min_stock ?? 5,
              is_active: p.is_active !== undefined ? p.is_active : true,
              is_priority_pricing: p.is_priority_pricing || false,
              custom_prices: p.custom_prices || {},
              created_at: p.created_at
            }));
          }
        }
      } catch {}
    }

    setArticles(loadedArticles);
    setTotalCount(recordCount);

    const uniqueCats = Array.from(new Set([...categories, ...loadedArticles.map(a => a.category).filter(Boolean)]));
    setCategories(uniqueCats);

    setLoading(false);
  };

  const syncArticles = (updated: ArticleItem[]) => {
    setArticles(updated);
    try {
      const storageFormat = updated.map(a => ({
        code: a.code,
        barcode: a.barcode || a.code,
        description: a.description,
        category: a.category,
        family: a.family,
        subfamily: a.subfamily,
        base_price: a.price,
        price: a.price,
        cost: a.cost,
        stock: a.stock,
        min_stock: a.min_stock,
        is_active: a.is_active,
        is_priority_pricing: a.is_priority_pricing,
        custom_prices: a.custom_prices || {},
        created_at: a.created_at
      }));
      localStorage.setItem(`pickingup_prodprices_${storeKey}`, JSON.stringify(storageFormat));
    } catch {}
  };

  const handleOpenCreateModal = () => {
    const autoCode = `ART-${Math.floor(1000 + Math.random() * 9000)}`;
    setEditingArticle(null);
    setFormData({
      code: autoCode,
      barcode: `779${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      description: '',
      category: categories[0] || 'General',
      family: 'General',
      subfamily: 'General',
      price: 0,
      cost: 0,
      stock: 0,
      min_stock: 5,
      is_active: true,
      custom_prices: {}
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (article: ArticleItem) => {
    setEditingArticle(article);
    setFormData({
      ...article,
      custom_prices: article.custom_prices ? { ...article.custom_prices } : {}
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      setFormError('El código del artículo es obligatorio.');
      return;
    }
    if (!formData.description.trim()) {
      setFormError('La descripción del artículo es obligatoria.');
      return;
    }

    if (!editingArticle) {
      const exists = articles.some(a => a.code.toLowerCase() === formData.code.trim().toLowerCase());
      if (exists) {
        setFormError(`El código "${formData.code}" ya pertenece a otro producto.`);
        return;
      }
    }

    const cleanArticle: ArticleItem = {
      ...formData,
      code: formData.code.trim().toUpperCase(),
      barcode: (formData.barcode || formData.code).trim(),
      description: formData.description.trim(),
      price: Number(formData.price) || 0,
      cost: Number(formData.cost) || 0,
      stock: Number(formData.stock) || 0,
      min_stock: Number(formData.min_stock) || 0,
      custom_prices: formData.custom_prices || {},
      created_at: editingArticle?.created_at || new Date().toISOString()
    };

    let updatedList: ArticleItem[];
    if (editingArticle) {
      updatedList = articles.map(a => a.code === editingArticle.code ? cleanArticle : a);
    } else {
      updatedList = [cleanArticle, ...articles];
    }

    syncArticles(updatedList);

    if (user && !isDemoMode && activeStore) {
      try {
        // 1. Update Base Article in DB
        await supabase
          .from('articles')
          .upsert({
            store_id: activeStore.id,
            code: cleanArticle.code,
            barcode: cleanArticle.barcode,
            description: cleanArticle.description,
            category: cleanArticle.category,
            family: cleanArticle.family,
            subfamily: cleanArticle.subfamily,
            price: cleanArticle.price,
            cost: cleanArticle.cost,
            stock: cleanArticle.stock,
            min_stock: cleanArticle.min_stock,
            is_active: cleanArticle.is_active
          }, { onConflict: 'store_id,code' });

        // 2. Persist custom price list overrides in price_list_items
        if (cleanArticle.custom_prices) {
          const validListIds = new Set(priceLists.map(l => l.id));
          for (const [listId, customPrice] of Object.entries(cleanArticle.custom_prices)) {
            if (listId !== 'base' && validListIds.has(listId)) {
              await supabase
                .from('price_list_items')
                .upsert({
                  price_list_id: listId,
                  article_code: cleanArticle.code,
                  custom_price: customPrice as number
                }, { onConflict: 'price_list_id,article_code' });
            }
          }
        }
      } catch (err) {
        console.error('Error persisting article to DB:', err);
      }
    }

    setIsFormModalOpen(false);
    addNotification({
      title: editingArticle ? 'Artículo Actualizado' : 'Nuevo Artículo Creado',
      message: `El producto "${cleanArticle.description}" (${cleanArticle.code}) fue guardado con éxito.`,
      type: 'success'
    });
  };

  const handleToggleActive = async (article: ArticleItem) => {
    const nextState = !article.is_active;
    const updated = articles.map(a => a.code === article.code ? { ...a, is_active: nextState } : a);
    syncArticles(updated);

    if (user && !isDemoMode && activeStore) {
      try {
        await supabase
          .from('articles')
          .update({ is_active: nextState })
          .eq('store_id', activeStore.id)
          .eq('code', article.code);
      } catch {}
    }

    addNotification({
      title: nextState ? 'Artículo Activado' : 'Artículo Desactivado',
      message: `"${article.description}" cambió a estado ${nextState ? 'Activo' : 'Inactivo'}.`,
      type: 'info'
    });
  };

  const handleDeletePermanent = async (code: string, description: string) => {
    if (!window.confirm(`¿Confirmás la eliminación permanente del artículo "${description}" (${code})? esta acción no se puede deshacer.`)) {
      return;
    }

    const updated = articles.filter(a => a.code !== code);
    syncArticles(updated);

    if (user && !isDemoMode && activeStore) {
      try {
        await supabase
          .from('articles')
          .delete()
          .eq('store_id', activeStore.id)
          .eq('code', code);
      } catch {}
    }

    addNotification({
      title: 'Artículo Eliminado',
      message: `Se eliminó el producto "${description}" del catálogo.`,
      type: 'warning'
    });
  };

  const handleAddCategory = () => {
    if (!newCategoryInput.trim()) return;
    const cat = newCategoryInput.trim();
    if (!categories.includes(cat)) {
      setCategories([...categories, cat]);
    }
    setNewCategoryInput('');
  };

  const handleExportCSV = () => {
    const headers = ['Codigo', 'Codigo_Barras', 'Descripcion', 'Rubro', 'Familia', 'Precio_Base', 'Costo', 'Stock', 'Stock_Minimo', 'Estado'];
    const rows = articles.map(a => [
      a.code,
      a.barcode || a.code,
      `"${a.description.replace(/"/g, '""')}"`,
      `"${a.category.replace(/"/g, '""')}"`,
      `"${(a.family || 'General').replace(/"/g, '""')}"`,
      a.price,
      a.cost,
      a.stock,
      a.min_stock,
      a.is_active ? 'Activo' : 'Inactivo'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `catalogo_articulos_${activeStore?.slug || 'tienda'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeArticles = articles.filter(a => a.is_active);
  const deactivatedArticles = articles.filter(a => !a.is_active);

  const listToDisplay = activeTab === 'deactivated' ? deactivatedArticles : activeArticles;

  const filteredArticles = listToDisplay.filter(a => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch = !term ||
      a.code.toLowerCase().includes(term) ||
      (a.barcode && a.barcode.toLowerCase().includes(term)) ||
      a.description.toLowerCase().includes(term);

    const matchCat = selectedCategory === 'ALL' || a.category === selectedCategory;

    let matchStatus = true;
    if (statusFilter === 'CRITICAL') {
      matchStatus = a.stock <= a.min_stock;
    } else if (statusFilter === 'NO_PRICE') {
      const viewPrice = selectedViewListId === 'base'
        ? a.price
        : (a.custom_prices?.[selectedViewListId] ?? a.price);
      matchStatus = viewPrice === 0;
    }

    return matchSearch && matchCat && matchStatus;
  });

  const sortedArticles = [...filteredArticles].sort((a, b) => {
    if (sortBy === 'NAME_ASC') {
      return a.description.localeCompare(b.description, 'es', { sensitivity: 'base' });
    }
    if (sortBy === 'NAME_DESC') {
      return b.description.localeCompare(a.description, 'es', { sensitivity: 'base' });
    }
    if (sortBy === 'CREATED_DESC') {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    }
    if (sortBy === 'PRICE_ASC') {
      const priceA = selectedViewListId === 'base' ? a.price : (a.custom_prices?.[selectedViewListId] ?? a.price);
      const priceB = selectedViewListId === 'base' ? b.price : (b.custom_prices?.[selectedViewListId] ?? b.price);
      return (Number(priceA) || 0) - (Number(priceB) || 0);
    }
    if (sortBy === 'PRICE_DESC') {
      const priceA = selectedViewListId === 'base' ? a.price : (a.custom_prices?.[selectedViewListId] ?? a.price);
      const priceB = selectedViewListId === 'base' ? b.price : (b.custom_prices?.[selectedViewListId] ?? b.price);
      return (Number(priceB) || 0) - (Number(priceA) || 0);
    }
    if (sortBy === 'STOCK_ASC') {
      return (Number(a.stock) || 0) - (Number(b.stock) || 0);
    }
    if (sortBy === 'STOCK_DESC') {
      return (Number(b.stock) || 0) - (Number(a.stock) || 0);
    }
    // Default: MODIFIED_DESC (Última modificación / más recientes)
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });

  const selectedViewListName = priceLists.find(l => l.id === selectedViewListId)?.name || 'Lista Base';

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

        {/* Modal Top Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
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
              <Tag size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9, letterSpacing: '0.05em' }}>
                ADMINISTRACIÓN DE CATÁLOGO Y LISTAS DE PRECIOS
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>
                Catálogo de Artículos — {activeStore?.name || 'Mi Negocio'}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setIsBulkImportOpen(true)}
              title="Importar catálogo masivo desde CSV o Excel con mapeo dinámico"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.875rem',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Upload size={15} /> Importación Masiva
            </button>

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
              id="btn-close-articles-modal"
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

        {/* Dynamic Navigation Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-app)',
          padding: '0 1.5rem'
        }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => setActiveTab('articles')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'articles' ? '3px solid #2563eb' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'articles' ? '#2563eb' : 'var(--text-muted)',
                fontWeight: activeTab === 'articles' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Tag size={16} /> 📋 Catálogo Activo ({activeArticles.length})
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'categories' ? '3px solid #2563eb' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'categories' ? '#2563eb' : 'var(--text-muted)',
                fontWeight: activeTab === 'categories' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Layers size={16} /> 🏷️ Rubros y Familias ({categories.length})
            </button>

            <button
              onClick={() => setActiveTab('deactivated')}
              style={{
                padding: '0.875rem 1.25rem',
                border: 'none',
                borderBottom: activeTab === 'deactivated' ? '3px solid #2563eb' : '3px solid transparent',
                background: 'none',
                color: activeTab === 'deactivated' ? '#2563eb' : 'var(--text-muted)',
                fontWeight: activeTab === 'deactivated' ? 800 : 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Trash2 size={16} /> 🗑️ Desactivados ({deactivatedArticles.length})
            </button>
          </div>

          <button
            id="btn-new-article"
            onClick={handleOpenCreateModal}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.625rem',
              border: 'none',
              background: '#2563eb',
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
            <Plus size={16} /> + Nuevo Artículo
          </button>
        </div>

        {/* TAB 1 & 3: CATALOG GRID & DEACTIVATED ITEMS */}
        {(activeTab === 'articles' || activeTab === 'deactivated') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Filter Bar */}
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              background: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Buscar por código, código de barras o descripción..."
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
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Price List Selector */}
                {priceLists.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>Lista:</span>
                    <select
                      id="select-catalogo-price-list"
                      value={selectedViewListId}
                      onChange={(e) => setSelectedViewListId(e.target.value)}
                      style={{
                        padding: '0.5rem 0.875rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #2563eb',
                        background: 'rgba(37, 99, 235, 0.08)',
                        color: '#2563eb',
                        fontWeight: 800,
                        fontSize: '0.85rem'
                      }}
                    >
                      {priceLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          🏷️ {list.name} {list.is_default ? '(Base)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    padding: '0.5rem 0.875rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    color: 'var(--brand-blue)',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="ALL">🏷️ Todos los Rubros</option>
                  {categories.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>

                {activeTab === 'articles' && (
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    style={{
                      padding: '0.5rem 0.875rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-surface)',
                      color: statusFilter === 'CRITICAL' ? '#ef4444' : (statusFilter === 'NO_PRICE' ? '#f59e0b' : 'var(--text-main)'),
                      fontWeight: 700,
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="ALL">📌 Todos los Estados</option>
                    <option value="CRITICAL">⚠️ Stock Crítico (&lt;= Mínimo)</option>
                    <option value="NO_PRICE">💲 Sin Precio Asignado ($0)</option>
                  </select>
                )}

                {/* Sort Order Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ArrowUpDown size={14} /> Ordenar:
                  </span>
                  <select
                    id="select-catalogo-orden"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    style={{
                      padding: '0.5rem 0.875rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #3b82f6',
                      background: 'rgba(59, 130, 246, 0.08)',
                      color: '#2563eb',
                      fontWeight: 800,
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="MODIFIED_DESC">🕒 Última Modificación (Nuevos)</option>
                    <option value="NAME_ASC">🔤 Nombre (A-Z)</option>
                    <option value="NAME_DESC">🔤 Nombre (Z-A)</option>
                    <option value="CREATED_DESC">📅 Fecha de Creación</option>
                    <option value="PRICE_ASC">💲 Precio (Menor a Mayor)</option>
                    <option value="PRICE_DESC">💲 Precio (Mayor a Menor)</option>
                    <option value="STOCK_ASC">📦 Stock (Menor a Mayor)</option>
                    <option value="STOCK_DESC">📦 Stock (Mayor a Menor)</option>
                  </select>
                </div>
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Mostrando <strong>{sortedArticles.length}</strong> de <strong>{listToDisplay.length}</strong> artículos
              </div>
            </div>

            {/* Articles Table */}
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
                      <th style={{ padding: '0.75rem 1rem' }}>Código / EAN</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Descripción del Producto</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Rubro / Familia</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        Precio ({selectedViewListName})
                      </th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Costo</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Stock Actual</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArticles.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No se encontraron artículos que coincidan con la búsqueda o filtro aplicado.
                        </td>
                      </tr>
                    ) : (
                      sortedArticles.map(art => {
                        const isLowStock = art.stock <= art.min_stock;

                        // Display price for selected list
                        const hasCustomPrice = selectedViewListId !== 'base' && art.custom_prices && selectedViewListId in art.custom_prices;
                        const displayedPrice = hasCustomPrice
                          ? art.custom_prices![selectedViewListId]
                          : art.price;

                        const isNoPrice = displayedPrice === 0;

                        return (
                          <tr key={art.code} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{art.code}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                📑 {art.barcode || art.code}
                              </div>
                            </td>

                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {art.description}
                                {art.is_priority_pricing && (
                                  <span style={{ fontSize: '0.68rem', background: '#a855f7', color: '#ffffff', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                    PRIORITARIO
                                  </span>
                                )}
                              </div>
                            </td>

                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '9999px',
                                background: 'rgba(37, 99, 235, 0.12)',
                                color: '#2563eb',
                                fontWeight: 700,
                                fontSize: '0.75rem'
                              }}>
                                {art.category}
                              </span>
                            </td>

                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: isNoPrice ? '#ef4444' : '#10b981', fontSize: '0.9rem' }}>
                              {isNoPrice ? 'SIN PRECIO ($0)' : `$${displayedPrice.toFixed(2)}`}
                              {hasCustomPrice && (
                                <div style={{ fontSize: '0.68rem', color: '#a855f7', fontWeight: 700 }}>
                                  (Sobreescritura)
                                </div>
                              )}
                              {selectedViewListId !== 'base' && !hasCustomPrice && (
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                  (Toma Base)
                                </div>
                              )}
                            </td>

                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>
                              ${art.cost.toFixed(2)}
                            </td>

                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <span style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: '0.5rem',
                                background: isLowStock ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: isLowStock ? '#ef4444' : '#10b981',
                                fontWeight: 900,
                                fontSize: '0.8rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
                                {isLowStock && <AlertTriangle size={13} />}
                                {art.stock} u.
                              </span>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Mín: {art.min_stock} u.
                              </div>
                            </td>

                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                <button
                                  onClick={() => handleOpenEditModal(art)}
                                  title="Editar Artículo y Precios"
                                  style={{
                                    padding: '0.35rem',
                                    borderRadius: '0.375rem',
                                    border: '1px solid var(--border-light)',
                                    background: 'var(--bg-app)',
                                    color: '#2563eb',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  onClick={() => handleToggleActive(art)}
                                  title={art.is_active ? 'Desactivar Artículo' : 'Restaurar Artículo'}
                                  style={{
                                    padding: '0.35rem',
                                    borderRadius: '0.375rem',
                                    border: '1px solid var(--border-light)',
                                    background: 'var(--bg-app)',
                                    color: art.is_active ? '#f59e0b' : '#10b981',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {art.is_active ? <X size={15} /> : <RotateCcw size={15} />}
                                </button>

                                {!art.is_active && (
                                  <button
                                    onClick={() => handleDeletePermanent(art.code, art.description)}
                                    title="Eliminar Permanentemente"
                                    style={{
                                      padding: '0.35rem',
                                      borderRadius: '0.375rem',
                                      border: '1px solid var(--border-light)',
                                      background: 'rgba(239, 68, 68, 0.1)',
                                      color: '#ef4444',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* SERVER-SIDE PAGINATION CONTROLS BAR */}
              <div style={{
                padding: '0.75rem 1.5rem',
                borderTop: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  {totalCount > 0 ? (
                    <>
                      Mostrando <strong style={{ color: 'var(--text-main)' }}>{Math.min((currentPage - 1) * pageSize + 1, totalCount)}</strong> - <strong style={{ color: 'var(--text-main)' }}>{Math.min(currentPage * pageSize, totalCount)}</strong> de <strong style={{ color: 'var(--text-main)' }}>{totalCount}</strong> artículos
                    </>
                  ) : (
                    'Sin resultados'
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Ítems por página:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      style={{
                        background: 'var(--bg-app)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-main)',
                        borderRadius: '0.375rem',
                        padding: '0.25rem 0.5rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      title="Primera Página"
                      style={{
                        padding: '0.35rem 0.6rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border-light)',
                        background: currentPage === 1 ? 'var(--bg-app)' : '#2563eb',
                        color: currentPage === 1 ? 'var(--text-muted)' : '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      ⏮️ Primera
                    </button>

                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      title="Página Anterior"
                      style={{
                        padding: '0.35rem 0.6rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border-light)',
                        background: currentPage === 1 ? 'var(--bg-app)' : '#2563eb',
                        color: currentPage === 1 ? 'var(--text-muted)' : '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      ◀️ Anterior
                    </button>

                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)', padding: '0 0.5rem' }}>
                      Página {currentPage} de {Math.max(1, Math.ceil(totalCount / pageSize))}
                    </span>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
                      disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                      title="Página Siguiente"
                      style={{
                        padding: '0.35rem 0.6rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border-light)',
                        background: currentPage >= Math.ceil(totalCount / pageSize) ? 'var(--bg-app)' : '#2563eb',
                        color: currentPage >= Math.ceil(totalCount / pageSize) ? 'var(--text-muted)' : '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: currentPage >= Math.ceil(totalCount / pageSize) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Siguiente ▶️
                    </button>

                    <button
                      onClick={() => setCurrentPage(Math.ceil(totalCount / pageSize))}
                      disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                      title="Última Página"
                      style={{
                        padding: '0.35rem 0.6rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border-light)',
                        background: currentPage >= Math.ceil(totalCount / pageSize) ? 'var(--bg-app)' : '#2563eb',
                        color: currentPage >= Math.ceil(totalCount / pageSize) ? 'var(--text-muted)' : '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: currentPage >= Math.ceil(totalCount / pageSize) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Última ⏭️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CATEGORIES & FAMILIES MANAGEMENT */}
        {activeTab === 'categories' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{
              background: 'var(--bg-app)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.875rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  🏷️ Gestión de Rubros / Categorías
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  Agrupadores principales para segmentar tus productos.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Nuevo Rubro (ej. Congelados)..."
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                />
                <button
                  onClick={handleAddCategory}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={16} /> Agregar
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {categories.map((cat, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span>{cat}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-app)', padding: '1px 5px', borderRadius: '4px' }}>
                      {articles.filter(a => a.category === cat).length} art.
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: 'var(--bg-app)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.875rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  📦 Familias y Subfamilias
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  Organización secundaria de catálogo para reportes avanzados.
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {families.map((fam, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: '#2563eb'
                    }}
                  >
                    {fam}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FORM MODAL (CREATE / EDIT ARTICLE & PRICE LISTS) */}
      {isFormModalOpen && (
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
            maxWidth: '680px',
            maxHeight: '90vh',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }} className="animate-fade-in">
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border-light)',
              background: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 id="form-title-article" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                {editingArticle ? `✏️ Editar Artículo: ${editingArticle.code}` : '➕ Alta de Nuevo Artículo'}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveArticle} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              {formError && (
                <div style={{ padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '0.8125rem', fontWeight: 700 }}>
                  ⚠️ {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Código del Artículo *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingArticle}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: editingArticle ? 'var(--bg-app)' : 'var(--bg-surface)',
                      fontWeight: 800,
                      color: 'var(--text-main)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Código de Barras (EAN)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. 7791234567890"
                    value={formData.barcode || ''}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Descripción del Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Coca-Cola Original 2.25L"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontWeight: 700
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Rubro / Categoría
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)'
                    }}
                  >
                    {categories.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Familia
                  </label>
                  <select
                    value={formData.family || 'General'}
                    onChange={(e) => setFormData({ ...formData, family: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)'
                    }}
                  >
                    {families.map((f, i) => (
                      <option key={i} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SECCIÓN PRECIOS POR LISTA DE PRECIOS */}
              <div style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-light)',
                borderRadius: '0.75rem',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <DollarSign size={16} /> Precios por Lista de Precios
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Precio Base (Lista Principal) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #10b981',
                        background: 'var(--bg-surface)',
                        fontWeight: 900,
                        color: '#10b981'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Costo ($)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-surface)',
                        fontWeight: 700,
                        color: 'var(--text-main)'
                      }}
                    />
                  </div>
                </div>

                {/* Secondary price lists overrides */}
                {priceLists.filter(l => !l.is_default && l.id !== 'base').length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Sobreescritura para Listas Secundarias (Opcional):
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {priceLists.filter(l => !l.is_default && l.id !== 'base').map(list => (
                        <div key={list.id}>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#a855f7', marginBottom: '0.2rem' }}>
                            🏷️ {list.name}
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            placeholder={`Base: $${formData.price}`}
                            value={formData.custom_prices?.[list.id] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                              const updatedCustom = { ...(formData.custom_prices || {}) };
                              if (val === undefined) {
                                delete updatedCustom[list.id];
                              } else {
                                updatedCustom[list.id] = val;
                              }
                              setFormData({ ...formData, custom_prices: updatedCustom });
                            }}
                            style={{
                              width: '100%',
                              padding: '0.4rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid var(--border-light)',
                              background: 'var(--bg-surface)',
                              fontWeight: 800,
                              color: '#a855f7',
                              fontSize: '0.8125rem'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Stock Actual
                  </label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-surface)',
                      fontWeight: 800,
                      color: 'var(--text-main)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-surface)',
                      fontWeight: 700,
                      color: '#ef4444'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-app)',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  id="form-submit-article"
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Save size={16} /> Guardar Artículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Article Import Wizard Modal */}
      {isBulkImportOpen && (
        <BulkArticleImportModal
          isOpen={true}
          onClose={() => setIsBulkImportOpen(false)}
          existingArticles={articles}
          onImportComplete={() => {
            setIsBulkImportOpen(false);
            // Refresh local state list
            try {
              const raw = localStorage.getItem(`pickingup_articles_${storeKey}`);
              if (raw) setArticles(JSON.parse(raw));
            } catch {}
          }}
        />
      )}
    </div>
  );
};
