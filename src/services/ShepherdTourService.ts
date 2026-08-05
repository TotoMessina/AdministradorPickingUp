import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';

export interface TourStepAction {
  openAction?: (slug: string) => void;
  closeModal?: () => void;
  openPOS?: () => void;
}

export const initShepherdTour = (actions?: TourStepAction) => {
  const tour = new Shepherd.Tour({
    useModalOverlay: false, // Prevents SVG overlay from blocking input typing
    defaultStepOptions: {
      classes: 'shepherd-theme-custom',
      scrollTo: { behavior: 'smooth', block: 'center' },
      cancelIcon: {
        enabled: true
      }
    }
  });

  const triggerOpen = (slug: string) => {
    if (actions?.openAction) actions.openAction(slug);
  };

  const triggerClose = () => {
    if (actions?.closeModal) actions.closeModal();
  };

  // STEP 1: Welcome Overview
  tour.addStep({
    id: 'step-welcome',
    title: '🎓 Tour Guiado Interactivo — Shepherd.js',
    text: '¡Bienvenido al Tour Guiado! Este tour te acompañará paso a paso en orden lógico: primero crearás la <strong>Lista de Precios</strong>, luego registrarás un <strong>Producto en Catálogo</strong>, y recién ahí aplicarás el <strong>Cambio Masivo de Precios</strong>.',
    buttons: [
      {
        text: 'Omitir Tour',
        action: () => tour.complete(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Comenzar Tour ▶',
        action: () => tour.next(),
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // FASE 1: PRECIOS — LISTAS DE PRECIOS
  // STEP 2: Abrir Listas de Precios
  tour.addStep({
    id: 'step-open-price-lists',
    title: '🏷️ 1. Módulo de Precios — Listas de Precios',
    text: 'Haz clic directo sobre la tarjeta <strong>"Listas de Precios"</strong> para abrir la pantalla de gestión.',
    attachTo: {
      element: '#action-card-listas-precios',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#action-card-listas-precios',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Abrir y Siguiente ▶',
        action: () => {
          triggerOpen('listas-precios');
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 3: Inside Price Lists Modal — Click + Nueva Lista
  tour.addStep({
    id: 'step-click-new-list',
    title: '➕ 2. Abrir Alta de Lista',
    text: 'Haz clic en el botón <strong>"+ Nueva Lista de Precios"</strong> para desplegar el formulario.',
    attachTo: {
      element: '#btn-new-price-list',
      on: 'left'
    },
    advanceOn: {
      selector: '#btn-new-price-list',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Siguiente ▶',
        action: () => tour.next(),
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 4: Inside Price Lists Modal — Fill & Submit Form (Attached to form title on TOP so form fields below are 100% visible!)
  tour.addStep({
    id: 'step-submit-price-list',
    title: '💾 3. Completar y Guardar Lista',
    text: 'Podés escribir el nombre de tu lista en la casilla (ej. Mayorista 15%) y luego hacer clic en el botón azul <strong>"Guardar Lista"</strong>.',
    attachTo: {
      element: '#form-title-price-list',
      on: 'top'
    },
    advanceOn: {
      selector: '#form-submit-price-list',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Siguiente ▶',
        action: () => tour.next(),
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 5: Close Price Lists Modal
  tour.addStep({
    id: 'step-close-price-lists',
    title: '✖️ 4. Cerrar Modal de Listas',
    text: 'Haz clic en la <strong>"X"</strong> superior para cerrar la ventana modal y regresar al Dashboard.',
    attachTo: {
      element: '#btn-close-price-lists-modal',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#btn-close-price-lists-modal',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Cerrar y Siguiente ▶',
        action: () => {
          triggerClose();
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // FASE 2: CATÁLOGO DE ARTÍCULOS
  // STEP 6: Catálogo de Artículos — Abrir Modal
  tour.addStep({
    id: 'step-open-articles',
    title: '📦 5. Abrir Catálogo de Artículos',
    text: 'Ahora haz clic en la tarjeta <strong>"Artículos"</strong> para ingresar al catálogo de productos.',
    attachTo: {
      element: '#action-card-articulos-list',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#action-card-articulos-list',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Abrir y Siguiente ▶',
        action: () => {
          triggerOpen('articulos-list');
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 7: Inside Articles Modal — Click + Nuevo Artículo
  tour.addStep({
    id: 'step-click-new-article',
    title: '➕ 6. Abrir Alta de Producto',
    text: 'Haz clic en el botón <strong>"+ Nuevo Artículo"</strong> para abrir el formulario de alta de producto.',
    attachTo: {
      element: '#btn-new-article',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#btn-new-article',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Siguiente ▶',
        action: () => tour.next(),
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 8: Inside Articles Modal — Fill & Submit Form (Attached to form header title on TOP so all inputs below are 100% visible!)
  tour.addStep({
    id: 'step-submit-article',
    title: '💾 7. Completar Datos y Guardar Producto',
    text: 'Completá la <strong>Descripción, EAN y Precio Base</strong> en el formulario libre inferior y luego haz clic en <strong>"Guardar Artículo"</strong>.',
    attachTo: {
      element: '#form-title-article',
      on: 'top'
    },
    advanceOn: {
      selector: '#form-submit-article',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Siguiente ▶',
        action: () => tour.next(),
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 9: Select Price List in Catalog Grid
  tour.addStep({
    id: 'step-select-price-list',
    title: '💲 8. Seleccionar Lista y Verificar Precios',
    text: 'Utilizá este selector para alternar entre la Lista Base y la Lista Secundaria recién creada.',
    attachTo: {
      element: '#select-catalogo-price-list',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#select-catalogo-price-list',
      event: 'change'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Siguiente ▶',
        action: () => tour.next(),
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 10: Close Articles Modal
  tour.addStep({
    id: 'step-close-articles',
    title: '✖️ 9. Cerrar Catálogo de Artículos',
    text: 'Haz clic en la <strong>"X"</strong> superior para cerrar la ventana modal del catálogo.',
    attachTo: {
      element: '#btn-close-articles-modal',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#btn-close-articles-modal',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Cerrar y Siguiente ▶',
        action: () => {
          triggerClose();
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // FASE 3: CAMBIO MASIVO DE PRECIOS (Ahora que YA existen productos)
  // STEP 11: Cambio Masivo de Precios
  tour.addStep({
    id: 'step-cambio-masivo',
    title: '⚡ 10. Cambio Masivo de Precios Porcentual',
    text: 'Ahora que ya existen productos en el catálogo, haz clic en <strong>"Cambio Masivo"</strong> para aplicar aumentos o descuentos % masivos.',
    attachTo: {
      element: '#action-card-cambio-masivo',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#action-card-cambio-masivo',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Abrir y Siguiente ▶',
        action: () => {
          triggerOpen('cambio-masivo');
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // FASE 4: INVENTARIO — CONCILIACIÓN
  // STEP 12: Inventario — Conciliación (Dashboard)
  tour.addStep({
    id: 'step-conciliacion',
    title: '⚖️ 11. Conciliación de Inventario',
    text: 'Haz clic en <strong>"Conciliación de Inventario"</strong> para comparar el stock teórico contra el conteo físico real.',
    attachTo: {
      element: '#action-card-conciliacion',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#action-card-conciliacion',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Abrir y Siguiente ▶',
        action: () => {
          triggerOpen('conciliacion');
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 13: Close Conciliación Modal
  tour.addStep({
    id: 'step-close-conciliacion',
    title: '✖️ 12. Inspeccionar y Cerrar Conciliación',
    text: 'Podés revisar las discrepancias de stock y luego hacer clic en <strong>"X"</strong> para cerrar la ventana modal.',
    attachTo: {
      element: '#btn-close-conciliacion-modal',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#btn-close-conciliacion-modal',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Cerrar y Siguiente ▶',
        action: () => {
          triggerClose();
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // FASE 5: PROVEEDORES
  // STEP 14: Proveedores — Gestión (Dashboard)
  tour.addStep({
    id: 'step-gestion-proveedores',
    title: '🚚 13. Gestión de Proveedores y Cuentas Corrientes',
    text: 'Haz clic en <strong>"Gestión de Proveedores"</strong> para ver cuentas por pagar, saldos y comprobantes.',
    attachTo: {
      element: '#action-card-gestion-proveedores',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#action-card-gestion-proveedores',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Abrir y Siguiente ▶',
        action: () => {
          triggerOpen('gestion-proveedores');
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 15: Close Proveedores Modal
  tour.addStep({
    id: 'step-close-suppliers',
    title: '✖️ 14. Cerrar Gestión de Proveedores',
    text: 'Revisá la lista de proveedores y haz clic en <strong>"X"</strong> para volver al panel principal.',
    attachTo: {
      element: '#btn-close-suppliers-modal',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#btn-close-suppliers-modal',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Cerrar y Siguiente ▶',
        action: () => {
          triggerClose();
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // FASE 6: CAJA CENTRAL
  // STEP 16: Caja Central — Cierre de Cajeros (Dashboard)
  tour.addStep({
    id: 'step-cierre-cajeros',
    title: '🔒 15. Caja Central — Cierre de Cajeros y Arqueo',
    text: 'Haz clic en <strong>"Cierre de Cajeros"</strong> para realizar el arqueo de efectivo de turno.',
    attachTo: {
      element: '#action-card-cierre-cajeros',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#action-card-cierre-cajeros',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Abrir y Siguiente ▶',
        action: () => {
          triggerOpen('cierre-cajeros');
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 17: Close Caja Central Modal
  tour.addStep({
    id: 'step-close-caja',
    title: '✖️ 16. Cerrar Caja Central',
    text: 'Haz clic en <strong>"X"</strong> para cerrar el módulo de caja central.',
    attachTo: {
      element: '#btn-close-caja-modal',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#btn-close-caja-modal',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Cerrar y Siguiente ▶',
        action: () => {
          triggerClose();
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // FASE 7: TERMINAL POS
  // STEP 18: POS Mode Header Button
  tour.addStep({
    id: 'step-open-pos-mode',
    title: '🛒 17. Terminal de Venta POS en Vivo',
    text: 'Haz clic en el botón <strong>"🛒 Modo Cajero POS"</strong> del encabezado para acceder a la terminal de ventas.',
    attachTo: {
      element: '#btn-header-pos',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#btn-header-pos',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Abrir POS y Siguiente ▶',
        action: () => {
          if (actions?.openPOS) actions.openPOS();
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 19: Close POS Modal
  tour.addStep({
    id: 'step-close-pos',
    title: '🔒 18. Salir de la Terminal POS',
    text: 'Haz clic en el botón <strong>"Salir del POS"</strong> para volver al panel de administración.',
    attachTo: {
      element: '#btn-close-pos-modal',
      on: 'bottom'
    },
    advanceOn: {
      selector: '#btn-close-pos-modal',
      event: 'click'
    },
    buttons: [
      {
        text: 'Atrás',
        action: () => tour.back(),
        classes: 'shepherd-button-secondary'
      },
      {
        text: 'Salir y Finalizar ▶',
        action: () => {
          triggerClose();
          setTimeout(() => tour.next(), 350);
        },
        classes: 'shepherd-button-primary'
      }
    ]
  });

  // STEP 20: Completion & Graduation
  tour.addStep({
    id: 'step-complete',
    title: '🎉 ¡Felicitaciones! Dominio Completo del Sistema',
    text: 'Has recorrido de principio a fin todos los módulos y modales de <strong>PickingUp! Administración</strong>. Tu negocio está 100% listo para operar.',
    buttons: [
      {
        text: '¡Empezar a Operar Ahora! 🚀',
        action: () => tour.complete(),
        classes: 'shepherd-button-primary'
      }
    ]
  });

  return tour;
};
