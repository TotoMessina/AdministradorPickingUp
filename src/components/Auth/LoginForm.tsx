import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { APP_CONFIG } from '../../config/appConfig';
import { LogIn, UserPlus, Shield, Sparkles, ArrowRight, Lock, Mail, UserCheck, Building2, ShoppingCart, Users } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'cajero'>('admin');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, signUp, loginAsDemo } = useAuth();

  const [showAutoRegisterOpt, setShowAutoRegisterOpt] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowAutoRegisterOpt(false);
    setIsSubmitting(true);

    try {
      // Check if credentials match a created cashier account
      try {
        const globalCashiersRaw = localStorage.getItem('pickingup_cashiers_global');
        let cashierList: any[] = [];
        if (globalCashiersRaw) {
          cashierList = JSON.parse(globalCashiersRaw);
        }
        
        const matchedCashier = cashierList.find((c: any) => c.email.toLowerCase() === email.trim().toLowerCase());
        if (matchedCashier) {
          if (matchedCashier.password && matchedCashier.password !== password) {
            setErrorMsg('Contraseña de cajero incorrecta. Verifique sus datos.');
            setIsSubmitting(false);
            return;
          }
          // Set standalone POS cashier mode & store active cashier info
          localStorage.setItem('pickingup_active_pos_mode', 'true');
          localStorage.setItem('pickingup_active_cashier', JSON.stringify(matchedCashier));
          setSuccessMsg(`¡Bienvenido ${matchedCashier.fullName}! Redirigiendo a la Terminal POS...`);
          await loginAsDemo();
          return;
        }
      } catch (err) {}

      if (selectedRole === 'cajero') {
        localStorage.setItem('pickingup_active_pos_mode', 'true');
      } else {
        localStorage.setItem('pickingup_active_pos_mode', 'false');
      }

      if (isRegister) {
        if (!fullName.trim()) {
          setErrorMsg('Por favor ingrese su nombre completo.');
          setIsSubmitting(false);
          return;
        }
        if (!storeName.trim()) {
          setErrorMsg('Por favor ingrese el nombre de su negocio o supermercado.');
          setIsSubmitting(false);
          return;
        }
        const { error } = await signUp(email, password, fullName, storeName);
        if (error) {
          if (error.message?.includes('User already registered')) {
            setErrorMsg('Este correo ya se encuentra registrado en Supabase. Puedes iniciar sesión directamente.');
          } else {
            setErrorMsg(error.message || 'Error al registrar usuario en Supabase.');
          }
        } else {
          setSuccessMsg('¡Cuenta y negocio registrados en Supabase con éxito! Intentando iniciar sesión...');
          const { error: loginErr } = await signIn(email, password);
          if (loginErr) {
            setSuccessMsg('¡Registro completado! Si Supabase requiere confirmación por email, revisa tu casilla. De lo contrario, ya puedes ingresar.');
          }
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          const msg = error.message || '';
          if (msg.includes('Invalid login credentials') || error.status === 400) {
            setErrorMsg('El usuario o contraseña no existen en este proyecto de Supabase (HTTP 400 devuelto por la API de Auth).');
            setShowAutoRegisterOpt(true);
          } else {
            setErrorMsg(msg || 'Error al iniciar sesión. Verifique sus datos.');
          }
        }
      }
    } catch (err: any) {
      setErrorMsg('Error de autenticación. Si la cuenta aún no existe en Supabase, créala en 1 clic abajo.');
      setShowAutoRegisterOpt(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoCreateAccount = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    const nameToUse = fullName.trim() || email.split('@')[0] || 'Propietario';
    const storeToUse = storeName.trim() || `Mi Supermercado (${nameToUse})`;
    const { error } = await signUp(email, password, nameToUse, storeToUse);
    if (error) {
      setErrorMsg(error.message || 'Error al crear la cuenta en Supabase.');
    } else {
      setSuccessMsg('¡Cuenta y comercio creados en Supabase! Iniciando sesión...');
      await signIn(email, password);
    }
    setIsSubmitting(false);
  };

  const handleDemoAdmin = async () => {
    localStorage.setItem('pickingup_active_pos_mode', 'false');
    await loginAsDemo();
  };

  const handleDemoCajero = async () => {
    localStorage.setItem('pickingup_active_pos_mode', 'true');
    await loginAsDemo();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 20%, #1e293b 0%, #090d16 100%)',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Decorative Glows */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(2, 132, 199, 0.15) 0%, rgba(0,0,0,0) 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '1.5rem',
        padding: '2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        zIndex: 10
      }} className="animate-fade-in">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '1.25rem',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            color: '#ffffff',
            boxShadow: '0 8px 20px rgba(2, 132, 199, 0.35)'
          }}>
            <Shield size={28} />
          </div>

          <h1 style={{
            fontSize: '1.65rem',
            fontWeight: 900,
            color: '#ffffff',
            margin: '0 0 0.5rem',
            letterSpacing: '-0.02em'
          }}>
            {APP_CONFIG.name}
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: '#94a3b8',
            margin: 0
          }}>
            {isRegister ? 'Crear nueva cuenta y registrar supermercado' : 'Ingreso al portal de administración y caja'}
          </p>
        </div>

        {/* Tab Selector (Login vs Register) */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '0.25rem',
          borderRadius: '0.75rem',
          marginBottom: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '0.625rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: !isRegister ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: !isRegister ? '#ffffff' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              transition: 'all 0.2s ease'
            }}
          >
            <LogIn size={15} /> Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '0.625rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: isRegister ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: isRegister ? '#ffffff' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              transition: 'all 0.2s ease'
            }}
          >
            <UserPlus size={15} /> Crear Cuenta
          </button>
        </div>

        {/* Role Selector Box */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Ingresar Como / Rol de Trabajo:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setSelectedRole('admin')}
              style={{
                padding: '0.6rem',
                borderRadius: '0.5rem',
                border: selectedRole === 'admin' ? '2px solid #0284c7' : '1px solid #334155',
                background: selectedRole === 'admin' ? 'rgba(2, 132, 199, 0.2)' : '#1e293b',
                color: selectedRole === 'admin' ? '#38bdf8' : '#cbd5e1',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              👨‍💼 Administrador
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('cajero')}
              style={{
                padding: '0.6rem',
                borderRadius: '0.5rem',
                border: selectedRole === 'cajero' ? '2px solid #10b981' : '1px solid #334155',
                background: selectedRole === 'cajero' ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
                color: selectedRole === 'cajero' ? '#10b981' : '#cbd5e1',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              🛒 Cajero POS
            </button>
          </div>
        </div>

        {/* Error / Alert Messages */}
        {errorMsg && (
          <div style={{
            padding: '0.875rem 1rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.75rem',
            color: '#fca5a5',
            fontSize: '0.8125rem',
            marginBottom: '1.25rem',
            lineHeight: 1.4
          }}>
            {errorMsg}
            {showAutoRegisterOpt && (
              <button
                type="button"
                onClick={handleAutoCreateAccount}
                style={{
                  marginTop: '0.625rem',
                  width: '100%',
                  padding: '0.45rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                ✨ Crear Cuenta e Iniciar Sesión en 1 Clic
              </button>
            )}
          </div>
        )}

        {successMsg && (
          <div style={{
            padding: '0.875rem 1rem',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '0.75rem',
            color: '#6ee7b7',
            fontSize: '0.8125rem',
            marginBottom: '1.25rem',
            lineHeight: 1.4
          }}>
            {successMsg}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          {isRegister && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.375rem' }}>
                  Nombre Completo
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <UserCheck size={16} style={{ position: 'absolute', left: '0.875rem', color: '#64748b' }} />
                  <input
                    type="text"
                    required={isRegister}
                    placeholder="ej. Juan Pérez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.875rem 0.65rem 2.5rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '0.625rem',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.375rem' }}>
                  Nombre del Negocio / Supermercado
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Building2 size={16} style={{ position: 'absolute', left: '0.875rem', color: '#64748b' }} />
                  <input
                    type="text"
                    required={isRegister}
                    placeholder="ej. Supermercado El Centenario"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.875rem 0.65rem 2.5rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '0.625rem',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.375rem' }}>
              Correo Electrónico
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ position: 'absolute', left: '0.875rem', color: '#64748b' }} />
              <input
                type="email"
                required
                placeholder="ej. usuario@comercio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.875rem 0.65rem 2.5rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.625rem',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.375rem' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: '0.875rem', color: '#64748b' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.875rem 0.65rem 2.5rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.625rem',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: '0.5rem',
              padding: '0.85rem',
              background: selectedRole === 'cajero' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.625rem',
              fontWeight: 800,
              fontSize: '0.9375rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            {isSubmitting ? (
              'Procesando...'
            ) : isRegister ? (
              <> Registrarme <ArrowRight size={16} /> </>
            ) : (
              <> Ingresar como {selectedRole === 'cajero' ? 'Cajero POS' : 'Administrador'} <ArrowRight size={16} /> </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          margin: '1.5rem 0',
          color: '#64748b',
          fontSize: '0.75rem'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
          <span>ACCESO RÁPIDO DEMO</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
        </div>

        {/* 2 Demo Fast Access Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleDemoAdmin}
            style={{
              padding: '0.75rem',
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '0.625rem',
              color: '#c4b5fd',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem'
            }}
          >
            <Sparkles size={15} /> Demo Propietario
          </button>

          <button
            type="button"
            onClick={handleDemoCajero}
            style={{
              padding: '0.75rem',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '0.625rem',
              color: '#6ee7b7',
              fontWeight: 800,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem'
            }}
          >
            <ShoppingCart size={15} /> Demo Cajero POS
          </button>
        </div>
      </div>
    </div>
  );
};
