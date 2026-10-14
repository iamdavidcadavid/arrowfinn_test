'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(email, password);
      queryClient.clear(); // never show a previous user's cached snapshot
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Invalid email or password.' : err instanceof ApiError && err.status === 429 ? 'Too many attempts. Wait a minute.' : 'Sign-in failed. Is the backend running?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">Trader portal</div>
          <h1 className="text-xl font-semibold">Sign in</h1>
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-ink-300">Email</span>
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm outline-none focus:border-sky-500" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-ink-300">Password</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm outline-none focus:border-sky-500" />
        </label>
        {error && <p role="alert" className="text-sm text-down">{error}</p>}
        <button disabled={busy} className="w-full rounded-md bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-ink-400">Demo credentials are listed in the README.</p>
      </form>
    </main>
  );
}
