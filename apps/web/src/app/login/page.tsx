'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/auth.store';
import { authApi } from '@/lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail]         = useState('amaka.obi@soascorp.ng');
  const [password, setPassword]   = useState('Password123!');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      toast.success(`Welcome back, ${user.name}`); 
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-0)' }}
    >
      {/* Background grid */}
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
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-black text-base"
            style={{ background: 'var(--amber)' }}
          >
            S1
          </div>
          <div>
            <p className="font-black text-lg tracking-tight" style={{ color: 'var(--text)' }}>STALKER</p>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Receivables Control System</p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h1 className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>Sign in</h1>
          <p className="text-xs mb-6" style={{ color: 'var(--text-3)' }}>
            Enter your credentials to access the dashboard
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[11px] block mb-1.5 font-medium" style={{ color: 'var(--text-3)' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--amber)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <div>
              <label className="text-[11px] block mb-1.5 font-medium" style={{ color: 'var(--text-3)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--amber)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-3)' }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              style={{ background: 'var(--amber)', color: '#000' }}
            >
              {loading ? <><Loader2 size={14} className="animate-spin" />Signing in…</> : 'Sign in'}
            </button>
          </form>

          {/* Demo credentials */}
          <div
            className="mt-5 p-3 rounded-lg"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
          >
            <p className="text-[10px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
              Demo Credentials
            </p>
            <div className="space-y-1">
              {[
                { role: 'CFO',     email: 'amaka.obi@soascorp.ng',   pass: 'Password123!' },
                { role: 'Finance', email: 'chidi.nwosu@soascorp.ng', pass: 'Password123!' },
              ].map(c => (
                <button
                  key={c.role}
                  onClick={() => { setEmail(c.email); setPassword(c.pass); }}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded text-left hover:opacity-80 transition-all"
                  style={{ background: 'var(--bg-3)' }}
                >
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--amber)' }}
                  >
                    {c.role}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{c.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: 'var(--text-3)' }}>
          Stalker v1 — Receivables Control System · Enterprise Edition
        </p>
      </div>
    </div>
  );
}
