'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api/client';

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base" style={{ background: 'var(--indigo)' }}>
            S1
          </div>
          <div>
            <p className="font-black text-lg tracking-tight" style={{ color: 'var(--text)' }}>STALKER</p>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Receivables Control System</p>
          </div>
        </div>

        <div className="card p-8">
          {!submitted ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.12)' }}>
                  <Mail size={17} style={{ color: 'var(--indigo-2)' }} />
                </div>
                <div>
                  <h1 className="text-base font-bold" style={{ color: 'var(--text)' }}>Reset password</h1>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>Enter your email and we'll send a reset link</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[11px] block mb-1.5 font-medium" style={{ color: 'var(--text-3)' }}>Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    onFocus={e  => (e.target.style.borderColor = 'var(--indigo)')}
                    onBlur={e   => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  style={{ background: 'var(--indigo)', color: '#fff' }}
                >
                  {loading ? <><Loader2 size={14} className="animate-spin" />Sending…</> : 'Send reset link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                <Mail size={22} style={{ color: 'var(--green)' }} />
              </div>
              <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text)' }}>Check your inbox</h2>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
                If <strong style={{ color: 'var(--text-2)' }}>{email}</strong> is registered, you'll receive a reset link shortly. The link expires in 2 hours.
              </p>
            </div>
          )}

          <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <Link href="/login" className="flex items-center justify-center gap-1.5 text-xs transition-all hover:opacity-70" style={{ color: 'var(--text-3)' }}>
              <ArrowLeft size={12} />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
