import { useEffect, useState } from 'react';

type HealthStatus = 'loading' | 'ok' | 'error';

function App() {
  const [status, setStatus] = useState<HealthStatus>('loading');

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;

    fetch(`${apiUrl}/api/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Health check failed');
        }
        return response.json() as Promise<{ status: string }>;
      })
      .then((data) => {
        setStatus(data.status === 'ok' ? 'ok' : 'error');
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);

  return (
    <main className="app">
      <h1>TruequeUTN</h1>
      <p className="subtitle">Plataforma de intercambio de materiales de estudio</p>
      <section className="health">
        <h2>Estado del backend</h2>
        {status === 'loading' && <p className="status loading">Conectando...</p>}
        {status === 'ok' && <p className="status ok">ok</p>}
        {status === 'error' && (
          <p className="status error">No se pudo conectar con el backend</p>
        )}
      </section>
    </main>
  );
}

export default App;
