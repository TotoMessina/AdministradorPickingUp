# 🛒 PickingUp! Enterprise Portal & POS System

[![React](https://img.shields.io/badge/React-18.3-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Multi--Tenant-3ECF8E.svg?logo=supabase)](https://supabase.com/)
[![WebUSB ESC/POS](https://img.shields.io/badge/Printer-WebUSB%20ESC%2FPOS-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/USB)

> Sistema Integral de Administración Empresarial, Punto de Venta (POS) Standalone, Gestión de Inventario Multi-Sucursal y Auditoría Financiera.

---

## 🌟 Características Principales

### 🛒 Terminal POS & Impresión Directa ESC/POS (WebUSB / Bluetooth)
* **Venta Rápida y Escaneo EAN**: Lector de código de barras para venta en caja con soporte offline.
* **Impresión Térmica Directa (80mm)**: Integración nativa con WebUSB API para ticketera térmica sin ventanas emergentes.
* **Apertura de Cajón RJ11**: Comando ESC/POS directo (`ESC p 0 25 250`) para apertura de cajón de dinero al cobrar.
* **Motor POS Offline (IndexedDB + Service Sync)**: Registro de ventas sin conexión con cola de sincronización automática al restablecer red.

### 🏢 Arquitectura Multi-Comercio (Multi-Tenant)
* **Aislamiento por Sucursal (`TenantContext`)**: Todos los artículos, cajas, precios y movimientos están estrictamente delimitados por `store_id`.
* **Políticas de Seguridad RLS en Supabase**: Control de acceso a nivel de fila (*Row Level Security*) según membresías y roles del usuario.

### 🛡️ Auditoría e Historial de Precios (`price_audit_logs`)
* **Trazabilidad Inmutable**: Registro automático de quién modificó el precio/stock (correo electrónico), fecha, hora, valor anterior vs nuevo y motivo del ajuste.
* **Filtros Avanzados**: Búsqueda por artículo, rango de fechas (Hoy, 7D, 30D, Todos) y usuario.

### 📦 Gestión de Inventario y Conciliación
* **Historial de Movimientos**: Consultas detalladas con ítems hijos (`stock_movement_items`), tipo de movimiento (*Ingreso*, *Egreso*, *Ajuste*, *Transferencia*).
* **Conciliación de Stock**: Módulo para comparar stock teórico vs stock real y generar ajustes inmediatos.

### 💼 Caja Central, Arqueos y Aranceles de Tarjetas
* **Arqueo y Cierre de Turno**: Registro del efectivo de sistema, efectivo declarado y cálculo de diferencias guardados en `cash_movements`.
* **Calculadora de Aranceles de Tarjeta**: Gestión de comisiones (% fee) y días de acreditación para Visa, Mastercard, MercadoPago QR y Naranja.
* **Transferencias inter-cajas**: Registro de retiros hacia la tesorería central.

### 📊 Dashboard Ejecutivo & Reportes Analytics
* **Métricas en Tiempo Real**: Gráficos interactivos construidos con `Recharts` para ventas por hora, productos más vendidos y distribución de medios de pago.
* **Exportación CSV Nativa**: Generación y descarga directa de reportes para Artículos, Movimientos de Stock, Cuentas Bancarias, Cotizaciones y Vales.

---

## 🛠️ Tecnologías Utilizadas

| Categoría | Tecnología |
|---|---|
| **Core UI / Framework** | React 18, TypeScript, Vite 6 |
| **Backend & BD** | Supabase (Auth, PostgreSQL DB, Realtime Channels, RLS) |
| **Almacenamiento Offline** | IndexedDB (`PickingUp_POS_Offline_v1`) + LocalStorage fallback |
| **Hardware Directo** | WebUSB API (Control directo de ticketeras ESC/POS & Cajón RJ11) |
| **Estilos & Iconos** | Vanilla CSS (CSS Variables Theme Switcher), Lucide React |
| **Visualización de Datos** | Recharts |
| **Guias Interactivas** | Shepherd.js |

---

## 📂 Estructura del Proyecto

```text
Administrador/
├── schema.sql                         # Esquema PostgreSQL multi-tenant y datos semilla para Supabase
├── src/
│   ├── components/
│   │   ├── Dashboard/                 # Widgets del Panel Principal y Barra de Favoritos
│   │   ├── Modals/                    # Modales de Negocio (POS, Cajas, Inventario, Auditoría, etc.)
│   │   └── Layout/                    # Sidebar, Navbar y Estructura Principal
│   ├── context/
│   │   ├── AuthContext.tsx            # Contexto de Autenticación Supabase
│   │   ├── TenantContext.tsx          # Multi-Tenant Active Store Context
│   │   └── NotificationContext.tsx    # Sistema Global de Notificaciones Toast
│   ├── lib/
│   │   └── supabase.ts                # Cliente Supabase JS configurado
│   ├── services/
│   │   ├── AuditLoggerService.ts      # Servicio de auditoría inmutable de precios
│   │   ├── OfflinePOSStore.ts         # Motor de ventas POS Offline con IndexedDB y Auto-Sync
│   │   ├── ThermalPrinterService.ts   # Servicio WebUSB ESC/POS y cajón de dinero
│   │   └── ShepherdTourService.ts     # Tours guiados interactivos para usuarios
│   ├── App.tsx                        # Componente Raíz
│   └── main.tsx                       # Punto de Entrada React
├── package.json
└── README.md
```

---

## 🚀 Guía de Instalación y Ejecución

### 1. Requisitos Previos
* Node.js v18.0.0 o superior
* npm v9.0.0 o superior
* Cuenta en Supabase (para modo conectado)

### 2. Clonar el Repositorio e Instalar Dependencias
```bash
git clone <URL_DEL_REPOSITORIO>
cd Administrador
npm install
```

### 3. Configuración de Variables de Entorno (`.env`)
Crea un archivo `.env` en la raíz del proyecto con las credenciales de tu proyecto Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### 4. Configurar la Base de Datos en Supabase
Ejecuta el archivo [`schema.sql`](file:///c:/Users/Usr/Desktop/Administrador/schema.sql) en el **SQL Editor** de tu panel de Supabase para crear las tablas, políticas RLS, funciones y datos semilla.

### 5. Iniciar el Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`.

### 6. Verificación de Código y Compilación de Producción
```bash
# Validar tipos TypeScript
npx tsc --noEmit

# Compilar para producción
npm run build
```

---

## 🔐 Roles y Permisos de Usuario

* 👑 **Owner / Administrador**: Acceso total a la sucursal, configuración de listas de precios, asignación de usuarios/cajeros y auditoría.
* 🛡️ **Supervisor**: Acceso a monitoreo de cajas, conciliación de inventario y anulación de ventas.
* 👤 **Operador / Cajero**: Acceso directo al modo POS Terminal Standalone sin vista de métricas administrativas globales.

---

## 📜 Licencia

Desarrollado para **PickingUp! Enterprise Retail Systems**. Todos los derechos reservados.
