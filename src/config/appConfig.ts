// Central Configuration for Application Brand, Identity and Constants
// Change values here to automatically update app branding across all components

export const APP_CONFIG = {
  // Application Branding
  name: 'PickingUp! Administración',
  shortName: 'PickingUp!',
  logoInitial: 'P',
  subtitle: 'Portal Administrativo Multi-Comercio',
  
  // HTML Title
  pageTitle: 'PickingUp! Administración | Sistema Portal Multi-Comercio',
  
  // LocalStorage Prefix
  storagePrefix: 'pickingup_admin',
  
  // Demo Account Settings
  demoEmail: 'operador@pickingup.com',
  demoUserName: 'Carlos Admin',
  demoRole: 'Propietario Multi-Comercio',
  
  // System Badges
  systemActiveText: 'Sistema Operativo Activo',
  serverStatusText: 'ESTADO SERVIDOR MULTI-TENANT'
} as const;
