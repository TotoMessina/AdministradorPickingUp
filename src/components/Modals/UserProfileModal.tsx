import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { supabase } from '../../lib/supabase';
import { User, Mail, Shield, Building2, Key, CheckCircle2, AlertCircle, X, Save } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, isDemoMode } = useAuth();
  const { activeStore } = useTenant();

  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  if (!isOpen || !user) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSaving(true);

    try {
      if (newPassword) {
        if (newPassword.length < 6) {
          setFeedback({ type: 'error', msg: 'La contraseña debe tener al menos 6 caracteres.' });
          setIsSaving(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setFeedback({ type: 'error', msg: 'Las contraseñas no coinciden.' });
          setIsSaving(false);
          return;
        }
      }

      if (!isDemoMode && user.id !== 'demo-user-1234') {
        // Update Supabase auth metadata
        const updatePayload: any = {
          data: { full_name: fullName }
        };
        if (newPassword) {
          updatePayload.password = newPassword;
        }

        const { error: authErr } = await supabase.auth.updateUser(updatePayload);
        if (authErr) throw authErr;

        // Update profiles table
        await supabase
          .from('profiles')
          .update({ full_name: fullName, updated_at: new Date().toISOString() })
          .eq('id', user.id);
      }

      setFeedback({
        type: 'success',
        msg: '¡Perfil y datos actualizados correctamente!'
      });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        msg: err.message || 'Error al guardar los cambios en Supabase.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1.5rem',
      fontFamily: 'var(--font-main)'
    }} onClick={onClose}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--brand-blue)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.1rem'
            }}>
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Mi Perfil de Usuario
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Gestión de cuenta y credenciales de acceso
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-app)',
              border: '1px solid var(--border-light)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSaveProfile} style={{ padding: '1.5rem' }}>
          {feedback && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.625rem',
              fontSize: '0.8125rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: feedback.type === 'success' ? '#10b981' : '#ef4444'
            }}>
              {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.msg}</span>
            </div>
          )}

          {/* User & Store Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{
              padding: '0.75rem',
              borderRadius: '0.625rem',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-light)'
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                ROL EN NEGOCIO
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--brand-blue)', marginTop: '2px' }}>
                {activeStore?.user_role || 'Propietario'}
              </div>
            </div>

            <div style={{
              padding: '0.75rem',
              borderRadius: '0.625rem',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-light)'
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                NEGOCIO ACTIVO
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeStore?.name || 'Mi Negocio'}
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              NOMBRE COMPLETO
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={16} style={{ position: 'absolute', left: '0.875rem', color: 'var(--text-muted)' }} />
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.5rem',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '0.625rem',
                  color: 'var(--text-main)',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </div>

          {/* Email (Readonly) */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
              CORREO ELECTRÓNICO (CUENTA)
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ position: 'absolute', left: '0.875rem', color: 'var(--text-muted)' }} />
              <input
                type="email"
                disabled
                value={user.email || ''}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.5rem',
                  background: 'rgba(0,0,0,0.05)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '0.625rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                  cursor: 'not-allowed'
                }}
              />
            </div>
          </div>

          {/* Password Change Section */}
          <div style={{
            padding: '1rem',
            borderRadius: '0.75rem',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
              <Key size={14} style={{ color: 'var(--brand-blue)' }} />
              <span>Cambiar Contraseña (Opcional)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <input
                  type="password"
                  placeholder="Nueva Contraseña"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.5rem',
                    color: 'var(--text-main)',
                    fontSize: '0.8125rem'
                  }}
                />
              </div>

              <div>
                <input
                  type="password"
                  placeholder="Confirmar Contraseña"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.5rem',
                    color: 'var(--text-main)',
                    fontSize: '0.8125rem'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
            >
              <Save size={16} />
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
