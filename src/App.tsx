import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { IngredientsPage } from './pages/IngredientsPage'
import { ImportIngredientsPage } from './pages/ImportIngredientsPage'
import { MealsPage } from './pages/MealsPage'
import { MealFormPage } from './pages/MealFormPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import { WeekPage } from './pages/WeekPage'
import { ShoppingListPage } from './pages/ShoppingListPage'
import { PersonProvider } from './lib/PersonContext'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { HouseholdProvider, useHousehold } from './lib/HouseholdContext'
import { AuthPage } from './pages/AuthPage'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-transition">
      <Routes location={location}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/semana" element={<WeekPage />} />
        <Route path="/biblioteca" element={<MealsPage />} />
        <Route path="/biblioteca/nuevo" element={<MealFormPage />} />
        <Route path="/biblioteca/:id/editar" element={<MealFormPage />} />
        <Route path="/ingredientes" element={<IngredientsPage />} />
        <Route path="/ingredientes/importar" element={<ImportIngredientsPage />} />
        <Route path="/compra" element={<ShoppingListPage />} />
        <Route path="/ajustes" element={<SettingsPage />} />
      </Routes>
    </div>
  )
}

function AppContent() {
  const { session, loading: authLoading, recoveryMode } = useAuth()

  if (authLoading) return <p className="min-h-dvh bg-bg py-12 text-center text-muted">Cargando...</p>
  if (recoveryMode || !session) return <AuthPage />

  return (
    <HouseholdProvider>
      <HouseholdGate />
    </HouseholdProvider>
  )
}

function HouseholdGate() {
  const { activeHousehold, loading } = useHousehold()

  if (loading) return <p className="min-h-dvh bg-bg py-12 text-center text-muted">Cargando...</p>
  if (!activeHousehold) return <p className="min-h-dvh bg-bg py-12 text-center text-muted">Preparando cuenta...</p>

  return (
    <BrowserRouter>
      <PersonProvider>
        <div className="min-h-dvh bg-bg pb-16">
          <AnimatedRoutes />
        </div>
        <BottomNav />
      </PersonProvider>
    </BrowserRouter>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
