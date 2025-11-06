"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Alert from '@mui/material/Alert'
import Swal from 'sweetalert2'
import CircularProgress from '@mui/material/CircularProgress'
import styles from './register.module.css'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  // restore saved form from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('registerForm')
      if (raw) {
        setForm(JSON.parse(raw))
      }
    } catch (e) {
      // ignore
    }
  }, [])

  function validate() {
    const e = {}
    if (!form.username || form.username.length < 3) e.username = 'Username must be at least 3 characters'
    if (!form.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = 'Invalid email address'
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters'
    return e
  }

  const onChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
    try {
      const next = { ...form, [field]: e.target.value }
      localStorage.setItem('registerForm', JSON.stringify(next))
    } catch (err) {
      // ignore
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    const eObj = validate()
    if (Object.keys(eObj).length) return setErrors(eObj)

    setLoading(true)
    try {
      const res = await fetch('http://localhost:5000/`api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (res.status === 201) {
        localStorage.removeItem('registerForm')
        await Swal.fire({
          icon: 'success',
          title: 'Registered',
          text: 'Your account was created. Redirecting to sign in...',
          timer: 1500,
          showConfirmButton: false,
        })
        router.push('/signin')
        return
      }
      // Robust parsing: only call res.json() when content-type is JSON
      const contentType = res.headers.get('content-type') || ''
      let message = 'An error occurred'

      if (res.redirected) {
        message = 'Server redirected to ' + res.url
      } else if (contentType.includes('application/json')) {
        try {
          const body = await res.json()
          message = body.error || body.message || message
        } catch (parseErr) {
          message = 'Received malformed JSON from server'
        }
      } else {
        // attempt to read plain text (HTML or plain error message)
        try {
          const txt = await res.text()
          message = txt ? txt : message
        } catch (textErr) {
          // fallback
        }
      }

      setServerError(message)
      await Swal.fire({ icon: 'error', title: 'Registration failed', text: message })
    } catch (err) {
      const message = 'Network error - please try again'
      setServerError(message)
      await Swal.fire({ icon: 'error', title: 'Network error', text: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container component="main" maxWidth="sm" className={styles.container}>
      <Box className={styles.card}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5" className={styles.title}>
          Register
        </Typography>

        {serverError && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{serverError}</Alert>}

        <Box component="form" onSubmit={onSubmit} className={styles.form}>
          <TextField
            label="Username"
            value={form.username}
            onChange={onChange('username')}
            fullWidth
            margin="normal"
            error={!!errors.username}
            helperText={errors.username}
          />
          <TextField
            label="Email"
            value={form.email}
            onChange={onChange('email')}
            fullWidth
            margin="normal"
            error={!!errors.email}
            helperText={errors.email}
          />
          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={onChange('password')}
            fullWidth
            margin="normal"
            error={!!errors.password}
            helperText={errors.password}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Register'}
          </Button>

          <Button
            variant="text"
            fullWidth
            sx={{ mt: 1 }}
            onClick={() => router.push('/signin')}
          >
            Already have an account? Sign in
          </Button>
        </Box>
      </Box>
    </Container>
  )
}
