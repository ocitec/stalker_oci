'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api/client';

function ResetPasswordForm() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const token         = searchParams.get('token') ?? '';

  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');

  const validate = () => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirm) return 'Passwords do not match';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (ex: any) {
      const msg = ex.response?.data?.message ?? 'This reset link is invalid or has expired.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center py-4">
        <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>No reset token provided.</p>
        <Link href={"/forgot-password" as any} className="text-sm font-semibold" style={{ color: 'var(--indigo-2)' }}>
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <>
      {!done ? (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <ShieldCheck size={17} style={{ color: 'var(--indigo-2)' }} />
            </div>
            <div>
              <h1 className="text-base font-bold" style={{ color: 'var(--text)' }}>Set new password</h1>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Choose a strong password for your account</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] block mb-1.5 font-medium" style={{ color: 'var(--text-3)' }}>New password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required minLength={8}
                  placeholder="Min. 8 characters"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm outline-none transition-all"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  onFocus={e  => (e.target.style.borderColor = 'var(--indigo)')}
                  onBlur={e   => (e.target.style.borderColor = 'var(--border)')}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-3)' }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] block mb-1.5 font-medium" style={{ color: 'var(--text-3)' }}>Confirm password</label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Repeat your new password"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                onFocus={e  => (e.target.style.borderColor = 'var(--indigo)')}
                onBlur={e   => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              style={{ background: 'var(--indigo)', color: '#fff' }}
            >
              {loading ? <><Loader2 size={14} className="animate-spin" />Resetting…</> : 'Reset password'}
            </button>
          </form>
        </>
      ) : (
        <div className="text-center py-2">
          <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <ShieldCheck size={22} style={{ color: 'var(--green)' }} />
          </div>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text)' }}>Password reset!</h2>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Redirecting you to login…</p>
        </div>
      )}

      <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <Link href="/login" className="flex items-center justify-center gap-1.5 text-xs transition-all hover:opacity-70" style={{ color: 'var(--text-3)' }}>
          <ArrowLeft size={12} />Back to sign in
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-0)' }}>
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base" style={{ background: 'var(--indigo)' }}>S1</div>
          <div>
            <p className="font-black text-lg tracking-tight" style={{ color: 'var(--text)' }}>STALKER</p>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Receivables Control System</p>
          </div>
        </div>
        <div className="card p-8">
          <Suspense fallback={<div className="text-center text-xs" style={{ color: 'var(--text-3)' }}>Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
