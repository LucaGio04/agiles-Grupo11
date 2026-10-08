import { Route, Routes } from 'react-router';
import { PrivateRoute, RedirectIfAuthenticated } from './auth/guards.tsx';
import { Layout } from './components/layout/Layout.tsx';
import { ItemDetailPage } from './pages/ItemDetailPage.tsx';
import { ItemsPage } from './pages/ItemsPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { PerfilPage } from './pages/PerfilPage.tsx';
import { PropuestasPage } from './pages/PropuestasPage.tsx';
import { PublicarPage } from './pages/PublicarPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import './styles/ui.css';

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/registro"
        element={
          <RedirectIfAuthenticated>
            <RegisterPage />
          </RedirectIfAuthenticated>
        }
      />

      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<ItemsPage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route path="/publicar" element={<PublicarPage />} />
          <Route path="/propuestas" element={<PropuestasPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
