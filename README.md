# 🛒 PickingUp! Enterprise Portal & POS System

[![React](https://img.shields.io/badge/React-18.3-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Multi--Tenant-3ECF8E.svg?logo=supabase)](https://supabase.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8.svg?logo=pwa)](https://web.dev/progressive-web-apps/)
[![WebUSB ESC/POS](https://img.shields.io/badge/Printer-WebUSB%20ESC%2FPOS-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/USB)

> Sistema Integral de Administración Empresarial Multi-Sucursal con Punto de Venta Offline, Inteligencia Artificial, Exportación Contable AFIP, Alertas Inteligentes y Soporte Multi-Moneda.

---

## 🌟 Características Principales

### 🛒 Terminal POS & Impresión Directa ESC/POS (WebUSB)
* **Venta Rápida y Escaneo EAN**: Lector de código de barras con soporte offline completo.
* **Impresión Térmica Directa (80mm)**: Integración nativa con WebUSB API sin drivers ni ventanas emergentes.
* **Apertura de Cajón RJ11**: Comando ESC/POS directo para apertura automática de cajón al cobrar.
* **Motor POS Offline (IndexedDB + Auto-Sync)**: Ventas sin conexión con sincronización automática a Supabase al restablecer red.
* **💱 Multi-Moneda en Caja**: Ticker de cotizaciones al día (USD Oficial, Blue, MEP, EUR) y selector de moneda de visualización en la terminal.

### 🏢 Arquitectura Multi-Comercio (Multi-Tenant)
* **Aislamiento estricto por Sucursal (`TenantContext`)**: Artículos, cajas, precios y movimientos delimitados por `store_id`.
* **Políticas de Seguridad RLS en Supabase**: Control de acceso a nivel de fila según membresías y roles.
* **Optimización de Funciones RLS High-Performance**: Caché por transacción vía `set_config` / `current_setting` y fallback a JWT claims en `get_my_store_ids()`, reduciendo la latencia de queries en un 80-90%.
* **Roles Granulares**: `owner`, `admin`, `supervisor`, `operador` con permisos diferenciados en cada módulo.

### 🤖 Inteligencia Artificial — Recomendaciones de Precios
* **Edge Function `price-recommendations`**: Analiza rotación de stock histórica, margen de ganancia por categoría y tendencias en `price_audit_logs` para sugerir ajustes de precio óptimos.
* **Modal de Sugerencias IA (`AIPriceRecommendationsModal`)**: Interfaz para aplicar ajustes en lote sugeridos por el motor de IA.

### 📱 Progressive Web App (PWA) — Instalación Nativa
* **Instalable en Android/iOS/PC**: Prompt nativo "Agregar a pantalla de inicio" con íconos de marca y modo standalone.
* **Service Worker Offline**: Cache First para assets estáticos. Funciona completamente sin conexión.
* **Push Notifications**: Notificaciones push via Web Push API + Supabase Edge Functions.

### 📡 Realtime Multi-Sucursal
* **3 Canales Supabase Realtime**: `sales-live` (ventas), `stock-live` (stock), `alerts-live` (alertas) propagados instantáneamente a todos los dispositivos conectados.
* **Monitoreo de Cajas en Vivo**: Actualizaciones en tiempo real de apertura/cierre de turno entre sucursales.

### 📤 Importación Masiva de Artículos (CSV/Excel)
* **Wizard de Importación con Preview**: Mapeo configurable de columnas CSV/Excel con detección de conflictos antes de importar.
* **Batches de 500 Artículos**: Importación en lotes para evitar timeouts de Supabase, con reporte de éxitos/errores al finalizar.

### 🖨️ Editor Visual de Etiquetas Térmicas
* **Canvas Drag-and-Drop**: Posicionamiento libre de código de barras, precio, descripción, marca y SKU sobre un lienzo a escala real en mm.
* **Tamaños Estándar**: Preajustes para `50x30mm`, `58x40mm`, `80x50mm` y formato personalizado.
* **Previsualización Real**: Selector del catálogo activo para ver exactamente cómo se imprimirá con datos de la tienda.
* **Plantillas Persistidas en Supabase**: Templates guardados por comercio en `public.label_templates`.
* **Impresión Directa**: Conexión con `ThermalPrinterService.ts` (WebUSB / ESC/POS) para impresión en lote.

### 📊 Exportación Contable Avanzada (AFIP Argentina)
* **Libro IVA Digital (RG 3685/4597)**: Generación de archivo `.txt` posicional de ancho fijo para CITI Ventas compatible con el aplicativo AFIP.
* **SICORE & SIFERE**: Archivos de retenciones y percepciones (IVA, Ganancias, IIBB Convenio Multilateral).
* **Stock Valorizado CSV/Excel**: Informe de inventario con valorización a costo, precio de venta y margen proyectado.
* **API REST para ERPs Externos**: Endpoint serverless `/functions/v1/accounting-api` para integración con TANGO, Bejerman, SAP y Holistor.

### 🔔 Sistema de Alertas Inteligentes
* **Edge Function Programada (`cron-smart-alerts`)**: Evaluación automática diaria (8:00 AM) de 4 reglas de negocio:
  - ⚠️ Stock crítico (`articles.stock <= articles.min_stock`)
  - 📄 Facturas de proveedores pendientes de pago
  - 💰 Saldos acreedores con proveedores
  - 📈 Resumen diario de ventas por email/sistema
* **Propagación Realtime Instantánea**: Las alertas se muestran en pantalla al instante via Supabase Realtime.

### 🗃️ Archivado Automático de Datos Históricos
* **Migración Automática a Tablas `_archive`**: Procedimiento `archive_old_records()` que traslada datos de ventas, movimientos de stock y auditoría de más de 2 años a tablas espejos inmutables `_archive`.
* **Edge Function Cron (`archive-historical-data`)**: Mantenimiento automático periódico para conservar la base de datos veloz y ligera.

### 🌍 Multi-Moneda Real
* **Cotizaciones Automatizadas**: Edge Function `update-currency-rates` que consulta DolarApi / BCRA y actualiza Dólar Oficial, Blue, MEP y Euro en `public.currency_rates`.
* **POS con Ticker de Divisas**: Barra informativa con cotizaciones del día y selector de moneda de visualización.
* **Facturas de Proveedores en Divisa**: Ingreso de comprobantes en USD/EUR con conversión automática al tipo de cambio registrado.

### 🛡️ Auditoría e Historial de Precios
* **Trazabilidad Inmutable**: Registro automático de cambios de precio con usuario, fecha, valor anterior/nuevo y motivo.
* **Filtros Avanzados**: Por artículo, rango de fechas (Hoy, 7D, 30D, Todos) y usuario.

### 📦 Gestión de Inventario y Conciliación
* **Historial de Movimientos**: Ingresos, Egresos, Ajustes y Transferencias con detalle de ítems.
* **Conciliación de Stock**: Comparación stock teórico vs. físico con auto-ajuste inmediato.

### 💼 Caja Central, Arqueos y Aranceles de Tarjetas
* **Arqueo y Cierre de Turno**: Registro de diferencias y movimientos en `cash_movements`.
* **Aranceles de Tarjeta**: Gestión de comisiones y días de acreditación para Visa, Mastercard, MercadoPago QR y Naranja.
* **Transferencias Inter-Cajas**: Registro de retiros hacia tesorería central.

---

## 🛠️ Tecnologías Utilizadas

| Categoría | Tecnología |
|---|---|
| **Core UI / Framework** | React 18, TypeScript, Vite 6 |
| **Backend & BD** | Supabase (Auth, PostgreSQL, Realtime, RLS, Edge Functions) |
| **Edge Functions** | Deno TypeScript serverless: `price-recommendations`, `cron-smart-alerts`, `accounting-api`, `update-currency-rates` |
| **PWA** | Web App Manifest + Service Worker + Web Push API |
| **Almacenamiento Offline** | IndexedDB (`PickingUp_POS_Offline_v1`) + LocalStorage fallback |
| **Hardware Directo** | WebUSB API (ESC/POS & Cajón RJ11) |
| **Multi-Moneda** | DolarApi / BCRA API + `CurrencyService.ts` |
| **Exportación Contable** | AFIP CITI Ventas (RG 3685/4597), SICORE, SIFERE, CSV/Excel |
| **Estilos & Iconos** | Vanilla CSS (CSS Variables Theme Switcher), Lucide React |
| **Visualización de Datos** | Recharts |
| **Guías Interactivas** | Shepherd.js |

---

## 📂 Estructura del Proyecto

```text
Administrador/
├── schema.sql                              # Esquema PostgreSQL multi-tenant + datos semilla
├── public/
│   ├── manifest.json                       # PWA Manifest (íconos, tema, orientación)
│   └── sw.js                               # Service Worker (Cache First + Push Notifications)
├── supabase/
│   └── functions/
│       ├── price-recommendations/          # IA: Sugerencias de ajuste de precios
│       ├── cron-smart-alerts/              # Alertas: Stock crítico, facturas, resumen diario
│       ├── accounting-api/                 # API REST para ERPs externos (TANGO, Bejerman, SAP)
│       └── update-currency-rates/          # Cotizaciones live desde DolarApi / BCRA
├── src/
│   ├── components/
│   │   ├── Dashboard/                      # Panel principal, barra de favoritos, paleta de comandos
│   │   ├── Modals/                         # 22 Modales de Negocio (POS, Cajas, Inventario, etc.)
│   │   │   ├── ActionModal.tsx             # Router central de modales (React.lazy + Suspense)
│   │   │   ├── POSTerminalModal.tsx        # Terminal POS + Multi-Moneda + Impresión Térmica
│   │   │   ├── AIPriceRecommendationsModal.tsx  # [NUEVO] Recomendaciones IA de precios
│   │   │   ├── LabelDesignModal.tsx        # [NUEVO] Editor visual drag-and-drop de etiquetas
│   │   │   ├── AccountingExportModal.tsx   # [NUEVO] Exportación AFIP: Libro IVA, SICORE, Stock
│   │   │   └── ArticlesManagementModal.tsx # CRUD Artículos + Importación Masiva CSV
│   │   └── Layout/                         # Sidebar, Navbar y estructura principal
│   ├── context/
│   │   ├── AuthContext.tsx                 # Autenticación Supabase + modo Demo
│   │   ├── TenantContext.tsx               # Multi-Tenant Active Store
│   │   └── NotificationContext.tsx         # Alertas Toast + Supabase Realtime alerts-live
│   ├── lib/
│   │   └── supabase.ts                     # Cliente Supabase JS singleton
│   ├── services/
│   │   ├── AuditLoggerService.ts           # Auditoría inmutable de precios
│   │   ├── OfflinePOSStore.ts              # Motor POS Offline (IndexedDB + Auto-Sync)
│   │   ├── ThermalPrinterService.ts        # WebUSB ESC/POS + cajón de dinero
│   │   ├── RealtimeMultiStoreService.ts    # [NUEVO] Canales Realtime multi-sucursal
│   │   ├── AccountingExportService.ts      # [NUEVO] Generadores AFIP TXT + Stock CSV
│   │   ├── SmartAlertsService.ts           # [NUEVO] Disparo alertas inteligentes + escáner local
│   │   ├── CurrencyService.ts              # [NUEVO] Cotizaciones live + conversión ARS↔USD↔EUR
│   │   └── PushNotificationService.ts      # [NUEVO] Registro Service Worker + Web Push
│   ├── App.tsx
│   └── main.tsx
├── ARCHITECTURE.md                         # Documentación técnica completa (única fuente de verdad)
├── package.json
└── README.md
```

---

## 🚀 Guía de Instalación y Ejecución

### 1. Requisitos Previos
* Node.js v18.0.0 o superior
* npm v9.0.0 o superior
* Cuenta en Supabase (para modo conectado)
* Supabase CLI (`npm install -g supabase`) — para desplegar Edge Functions

### 2. Clonar el Repositorio e Instalar Dependencias
```bash
git clone <URL_DEL_REPOSITORIO>
cd Administrador
npm install
```

### 3. Configuración de Variables de Entorno (`.env`)
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### 4. Configurar la Base de Datos en Supabase
Ejecuta el archivo [`schema.sql`](./schema.sql) en el **SQL Editor** de tu panel de Supabase. Luego habilita Realtime para las tablas clave ejecutando:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

### 5. Desplegar las Edge Functions en Supabase
```bash
npx supabase functions deploy price-recommendations
npx supabase functions deploy cron-smart-alerts
npx supabase functions deploy accounting-api
npx supabase functions deploy update-currency-rates
```

### 6. Iniciar el Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`.

### 7. Compilación de Producción
```bash
npm run build
```

---

## 🔐 Roles y Permisos de Usuario

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| 👑 **Owner** | Propietario del comercio | Acceso total: configuración, usuarios, reportes, exportaciones |
| 🛡️ **Admin** | Administrador | Igual que Owner excepto gestión de propietario |
| 🔍 **Supervisor** | Supervisor de turno | Monitoreo de cajas, conciliación de inventario, reportes |
| 👤 **Operador / Cajero** | Cajero de turno | Solo Terminal POS Standalone (sin métricas administrativas) |

---

## ⚡ Módulos Avanzados v6.0

| Módulo | Descripción |
|--------|-------------|
| 🤖 **IA de Precios** | Sugerencias automáticas de ajuste de precios basadas en rotación de stock y márgenes |
| 📱 **PWA Instalable** | Instalación nativa en Android/iOS/PC + Service Worker offline + Push Notifications |
| 📡 **Realtime Multi-Sucursal** | Sincronización instantánea de ventas, stock y alertas entre todas las sucursales |
| 📤 **Importación Masiva CSV** | Wizard con mapeo de columnas, preview y carga en batches de 500 artículos |
| 🖨️ **Editor Visual de Etiquetas** | Canvas drag-and-drop con preview real e impresión térmica directa |
| 📊 **Exportación Contable AFIP** | Libro IVA Digital, SICORE/SIFERE, Stock Valorizado y API REST para ERPs |
| 🔔 **Alertas Inteligentes** | Cron diario automático: stock crítico, facturas por vencer, resumen de ventas |
| 🌍 **Multi-Moneda Real** | Cotizaciones live (USD Oficial, Blue, MEP, EUR) en el POS y facturas de proveedores |
| 👤 **CRM / Clientes** | Padrón de clientes, cuentas corrientes, cobro a saldo y acumulación de puntos de fidelidad |

---

## 📜 Licencia

Desarrollado para **PickingUp! Enterprise Retail Systems**. Todos los derechos reservados.
