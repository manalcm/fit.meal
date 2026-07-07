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

function App() {
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

export default App
