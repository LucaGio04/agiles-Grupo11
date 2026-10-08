import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="page not-found-page">
      <h1>Página no encontrada</h1>
      <p className="muted">La ruta que buscás no existe.</p>
      <p>
        <Link to="/">Volver al inicio</Link>
      </p>
    </main>
  );
}
