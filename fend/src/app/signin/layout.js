import React from 'react'

export const metadata = {
  title: 'Sign in',
}

export default function SignInLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#f7fafc,#edf2f7)' }}>
      <div style={{ width: '100%', maxWidth: 540, margin: '2rem', background: 'white', boxShadow: '0 4px 18px rgba(20,20,40,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
