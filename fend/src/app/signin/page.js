"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginRequest, fetchSession } from "../lib/apiClient";
import { toast } from "../lib/notifications";

const googleSignInMessages = {
  google_cancelled: "Google sign-in was cancelled.",
  google_invalid_state: "Google sign-in expired. Please try again.",
  google_admin_not_allowed: "Administrator accounts must use the admin sign-in page.",
  google_unavailable: "Google sign-in is currently unavailable.",
  google_signin_failed: "We could not sign you in with Google. Please try again.",
};

export default function SignInPage() {
  const [email, setEmail] = useState('user@example.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    try {
      const s = localStorage.getItem('signinEmail')
      if (s) setEmail(s)
    } catch (e) {}

    const googleError = new URLSearchParams(window.location.search).get("error");
    if (googleError) {
      setError(googleSignInMessages[googleError] || googleSignInMessages.google_signin_failed);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [])

  function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    window.location.assign('/api/auth/google');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('')
    setLoading(true)
    try {
      await loginRequest(email, password, "user");
      try { localStorage.setItem('signinEmail', email) } catch (e) {}
      await fetchSession(); // prime session cache
      toast.success('Logged in!', { description: 'Redirecting to your panel...', duration: 700 });
      setTimeout(() => router.push('/account'), 700);
    } catch (err) {
      setError(err.message || 'Network error')
      toast.error('Network error', { description: err.message || 'Something went wrong' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ padding: 28 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Welcome back</h1>
        <p style={{ marginTop: 8, marginBottom: 20, color: '#475569' }}>Sign in to access your customer account</p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#1e293b',
            fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          <span aria-hidden="true" style={{ color: '#4285F4', fontSize: 18, fontWeight: 800 }}>G</span>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0', color: '#94a3b8', fontSize: 12 }}>
          <span style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
          or sign in with email
          <span style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
        </div>

        <form onSubmit={handleSubmit} aria-describedby={error ? 'signin-error' : undefined}>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#334155' }}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%' }}
                disabled={loading}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#334155' }}>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%' }}
                disabled={loading}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4 }}>
              <Link href="/forgot-password" style={{ color: '#0f766e', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>

            {error && (
              <div id="signin-error" role="alert" style={{ color: '#b91c1c', background: '#fff1f2', padding: 10, borderRadius: 8, border: '1px solid #fecaca' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: '#0ea5a4',
                  color: 'white',
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: loading ? 'default' : 'pointer',
                  minWidth: 120,
                }}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setEmail(''); setPassword(''); setError('') }} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer' }}>
                  Clear
                </button>
                <button type="button" onClick={() => router.push('/signup')} style={{ background: 'transparent', border: 'none', color: '#0ea5a4', cursor: 'pointer' }}>
                  Create account
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
