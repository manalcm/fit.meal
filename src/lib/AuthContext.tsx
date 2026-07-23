import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  recoveryMode: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<boolean>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      recoveryMode,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        return !data.session
      },
      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/?recovery=1`,
        })
        if (error) throw error
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
        if (signOutError) throw signOutError
        setRecoveryMode(false)
        window.history.replaceState({}, '', window.location.pathname)
      },
      async signOut() {
        const { error } = await supabase.auth.signOut({ scope: 'local' })
        if (error) throw error
      },
    }),
    [loading, recoveryMode, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}