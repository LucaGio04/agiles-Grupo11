import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { ItemCard } from '../components/items/ItemCard.tsx';
import { Button } from '../components/ui/Button.tsx';
import { ErrorMessage } from '../components/ui/ErrorMessage.tsx';
import { Loader } from '../components/ui/Loader.tsx';
import { ApiError, apiFetch } from '../lib/api.ts';
import { CATEGORIAS, type Categoria, type ItemsPageResult } from '../lib/items.ts';

// Topes que valida el server (query hasta 100 caracteres, page hasta 100000). Un link editado a mano
// con valores mayores se recorta acá en vez de terminar en un 400.
const MAX_QUERY_LENGTH = 100;
const MAX_PAGE = 100_000;

// Resultado de la carga para la búsqueda `forKey`. Mientras no coincide con la URL, se muestra el loader.
type Result = { status: 'ok'; data: ItemsPageResult } | { status: 'error'; message: string };

function isCategoria(value: string | null): value is Categoria {
  return value !== null && value in CATEGORIAS;
}

// Inicio: listado de ítems disponibles con búsqueda, filtro por categoría y paginación (HU-04).
// Los filtros viven en la URL (?q=&categoria=&page=), así el buscador de la navbar, el botón
// "atrás" del navegador y un link compartido muestran lo mismo.
export function ItemsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const flash = (useLocation().state as { flash?: string } | null)?.flash;
  const q = (searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH).trim();
  const rawCategoria = searchParams.get('categoria');
  const categoria = isCategoria(rawCategoria) ? rawCategoria : null;
  const page = Math.min(
    MAX_PAGE,
    Math.max(1, Number.parseInt(searchParams.get('page') ?? '', 10) || 1)
  );

  // No se manda `limit`: el tamaño de página lo decide el server.
  const apiParams = new URLSearchParams({ page: String(page) });
  if (q) apiParams.set('query', q);
  if (categoria) apiParams.set('category', categoria);
  const key = apiParams.toString();

  const [result, setResult] = useState<(Result & { forKey: string }) | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const setState = (r: Result) => !cancelled && setResult({ ...r, forKey: key });
    apiFetch<ItemsPageResult>(`/api/items?${key}`)
      .then((data) => setState({ status: 'ok', data }))
      .catch((err: unknown) =>
        setState({
          status: 'error',
          // Un error del server (400, 500...) trae su propio mensaje; sin respuesta, se asume la conexión.
          message:
            err instanceof ApiError
              ? err.message
              : 'No pudimos cargar los materiales. Revisá tu conexión y probá de nuevo.',
        })
      );
    return () => {
      cancelled = true;
    };
  }, [key, retry]);

  // Cambia un filtro de la URL. Salvo que se pida otra página, se vuelve a la primera.
  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(changes)) {
      if (value) next.set(name, value);
      else next.delete(name);
    }
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  }

  // Volver a pedir con la misma búsqueda: se descarta el error para que se vea el loader mientras carga.
  function handleRetry() {
    setResult(null);
    setRetry((n) => n + 1);
  }

  function goToPage(nextPage: number) {
    updateParams({ page: nextPage > 1 ? String(nextPage) : null });
    window.scrollTo({ top: 0 });
  }

  const hasFilters = Boolean(q || categoria);
  const loading = !result || result.forKey !== key;

  return (
    <section className="items-page">
      {flash && (
        <p className="form-success" role="status">
          {flash}
        </p>
      )}

      <header className="items-header">
        <h1>{q ? `Resultados para “${q}”` : 'Materiales disponibles'}</h1>
        {!loading && result.status === 'ok' && result.data.total > 0 && (
          <p className="muted">
            {result.data.total} {result.data.total === 1 ? 'material' : 'materiales'}
          </p>
        )}
      </header>

      <nav className="category-chips" aria-label="Filtrar por categoría">
        <button
          type="button"
          className="category-chip"
          aria-pressed={!categoria}
          onClick={() => updateParams({ categoria: null })}
        >
          Todas
        </button>
        {(Object.keys(CATEGORIAS) as Categoria[]).map((value) => (
          <button
            key={value}
            type="button"
            className="category-chip"
            aria-pressed={categoria === value}
            onClick={() => updateParams({ categoria: value })}
          >
            {CATEGORIAS[value]}
          </button>
        ))}
      </nav>

      {loading ? (
        <Loader label="Buscando materiales..." />
      ) : result.status === 'error' ? (
        <div className="empty-state">
          <ErrorMessage message={result.message} />
          <Button variant="secondary" onClick={handleRetry}>
            Reintentar
          </Button>
        </div>
      ) : result.data.data.length === 0 ? (
        <EmptyState
          hasFilters={hasFilters}
          pageOutOfRange={result.data.total > 0}
          onClear={() => updateParams({ q: null, categoria: null })}
          onFirstPage={() => goToPage(1)}
        />
      ) : (
        <>
          <ul className="items-grid">
            {result.data.data.map((item) => (
              <li key={item.id}>
                <ItemCard item={item} />
              </li>
            ))}
          </ul>

          {result.data.totalPages > 1 && (
            <nav className="pagination" aria-label="Páginas">
              <Button variant="secondary" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                ← Anterior
              </Button>
              <span className="pagination-status">
                Página {page} de {result.data.totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= result.data.totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Siguiente →
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

type EmptyStateProps = {
  hasFilters: boolean;
  pageOutOfRange: boolean;
  onClear: () => void;
  onFirstPage: () => void;
};

function EmptyState({ hasFilters, pageOutOfRange, onClear, onFirstPage }: EmptyStateProps) {
  // Un link viejo o editado a mano puede pedir una página que ya no existe.
  if (pageOutOfRange) {
    return (
      <div className="empty-state">
        <h2>No hay más resultados</h2>
        <Button variant="secondary" onClick={onFirstPage}>
          Volver a la primera página
        </Button>
      </div>
    );
  }

  if (hasFilters) {
    return (
      <div className="empty-state">
        <h2>No encontramos ítems con esa búsqueda</h2>
        <p className="muted">Probá con otras palabras o con otra categoría.</p>
        <Button variant="secondary" onClick={onClear}>
          Ver todos los materiales
        </Button>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <h2>Todavía no hay materiales publicados</h2>
      <p className="muted">
        Sé el primero: publicá algo que ya no uses y alguien lo va a aprovechar.
      </p>
      <Link to="/publicar" className="btn-primary">
        Publicar un material
      </Link>
    </div>
  );
}
