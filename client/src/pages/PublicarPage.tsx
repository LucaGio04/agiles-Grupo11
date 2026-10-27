import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/Button.tsx';
import { ErrorMessage } from '../components/ui/ErrorMessage.tsx';
import { Input } from '../components/ui/Input.tsx';
import { ApiError, apiFetch } from '../lib/api.ts';
import {
  CATEGORIAS,
  ESTADOS_CONSERVACION,
  type Categoria,
  type CreateItemData,
  type EstadoConservacion,
  type Item,
} from '../lib/items.ts';

type Field = 'titulo' | 'categoria' | 'estadoConservacion' | 'descripcion' | 'materia' | 'fotoUrl';
type FieldErrors = Partial<Record<Field, string>>;

const DESCRIPCION_MAX = 500;

function isHttpUrl(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

// Formulario para publicar un material (HU-03). La ruta ya está protegida por PrivateRoute.
export function PublicarPage() {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [estadoConservacion, setEstadoConservacion] = useState<EstadoConservacion | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [materia, setMateria] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoRota, setFotoRota] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clearError = (field: Field) =>
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  function validateForm(): boolean {
    const errors: FieldErrors = {};
    const trimmedTitulo = titulo.trim();

    if (!trimmedTitulo) errors.titulo = 'Ingresá un título';
    else if (trimmedTitulo.length < 3) errors.titulo = 'El título debe tener al menos 3 caracteres';
    else if (trimmedTitulo.length > 80) errors.titulo = 'El título puede tener hasta 80 caracteres';

    if (!categoria) errors.categoria = 'Elegí una categoría';
    if (!estadoConservacion) errors.estadoConservacion = 'Elegí el estado de conservación';

    if (descripcion.trim().length > DESCRIPCION_MAX) {
      errors.descripcion = `La descripción puede tener hasta ${DESCRIPCION_MAX} caracteres`;
    }
    if (fotoUrl.trim() && !isHttpUrl(fotoUrl.trim())) {
      errors.fotoUrl = 'Ingresá una URL válida (http o https)';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError(null);
    if (!validateForm()) return;

    setSubmitting(true);
    const body: CreateItemData = {
      titulo: titulo.trim(),
      categoria: categoria as Categoria,
      estadoConservacion: estadoConservacion as EstadoConservacion,
      descripcion: descripcion.trim() || undefined,
      materia: materia.trim() || undefined,
      fotoUrl: fotoUrl.trim() || undefined,
    };

    try {
      const { item } = await apiFetch<{ item: Item }>('/api/items', { method: 'POST', body });
      navigate(`/items/${item.id}`, { state: { flash: '¡Listo! Tu material ya está publicado.' } });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 400 && Array.isArray(err.details)) {
          const errors: FieldErrors = {};
          for (const { field, message } of err.details as { field: string; message: string }[]) {
            const name = field.replace(/^body\./, '') as Field;
            errors[name] ??= message;
          }
          setFieldErrors(errors);
        }
        setGeneralError(err.message);
      } else {
        setGeneralError('No se pudo conectar con el servidor. Probá de nuevo en unos minutos.');
      }
      setSubmitting(false);
    }
  }

  const previewUrl = isHttpUrl(fotoUrl.trim()) ? fotoUrl.trim() : null;

  return (
    <div className="publish-page">
      <h1>Publicar material</h1>
      <p className="subtitle">
        Contá qué querés intercambiar para que otros estudiantes lo encuentren.
      </p>

      <form className="publish-form" onSubmit={handleSubmit} noValidate>
        {generalError && <ErrorMessage message={generalError} />}

        <Input
          label="Título"
          name="titulo"
          placeholder="Ej. Análisis Matemático I - Stewart"
          maxLength={80}
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            clearError('titulo');
          }}
          error={fieldErrors.titulo}
          required
        />

        <div className="publish-row">
          <label className="field" htmlFor="categoria">
            <span>Categoría</span>
            <select
              id="categoria"
              name="categoria"
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value as Categoria | '');
                clearError('categoria');
              }}
              className={fieldErrors.categoria ? 'input-error' : undefined}
              aria-invalid={fieldErrors.categoria ? true : undefined}
              required
            >
              <option value="">Seleccioná una categoría</option>
              {Object.entries(CATEGORIAS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {fieldErrors.categoria && (
              <span className="field-error" role="alert">
                {fieldErrors.categoria}
              </span>
            )}
          </label>

          <label className="field" htmlFor="estadoConservacion">
            <span>Estado de conservación</span>
            <select
              id="estadoConservacion"
              name="estadoConservacion"
              value={estadoConservacion}
              onChange={(e) => {
                setEstadoConservacion(e.target.value as EstadoConservacion | '');
                clearError('estadoConservacion');
              }}
              className={fieldErrors.estadoConservacion ? 'input-error' : undefined}
              aria-invalid={fieldErrors.estadoConservacion ? true : undefined}
              required
            >
              <option value="">Seleccioná el estado</option>
              {Object.entries(ESTADOS_CONSERVACION).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {fieldErrors.estadoConservacion && (
              <span className="field-error" role="alert">
                {fieldErrors.estadoConservacion}
              </span>
            )}
          </label>
        </div>

        <Input
          label="Materia (opcional)"
          name="materia"
          placeholder="Ej. Análisis Matemático I"
          maxLength={80}
          value={materia}
          onChange={(e) => {
            setMateria(e.target.value);
            clearError('materia');
          }}
          error={fieldErrors.materia}
        />

        <label className="field" htmlFor="descripcion">
          <span>Descripción (opcional)</span>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={4}
            maxLength={DESCRIPCION_MAX}
            placeholder="Edición, estado, si tiene anotaciones..."
            value={descripcion}
            onChange={(e) => {
              setDescripcion(e.target.value);
              clearError('descripcion');
            }}
            className={fieldErrors.descripcion ? 'input-error' : undefined}
            aria-invalid={fieldErrors.descripcion ? true : undefined}
          />
          <span className="field-hint">
            {descripcion.length}/{DESCRIPCION_MAX}
          </span>
          {fieldErrors.descripcion && (
            <span className="field-error" role="alert">
              {fieldErrors.descripcion}
            </span>
          )}
        </label>

        <Input
          label="URL de la foto (opcional)"
          name="fotoUrl"
          type="url"
          placeholder="https://..."
          value={fotoUrl}
          onChange={(e) => {
            setFotoUrl(e.target.value);
            setFotoRota(false);
            clearError('fotoUrl');
          }}
          error={fieldErrors.fotoUrl}
        />
        {previewUrl && !fotoRota && (
          <img
            className="publish-preview"
            src={previewUrl}
            alt="Vista previa de la foto"
            onError={() => setFotoRota(true)}
          />
        )}
        {previewUrl && fotoRota && (
          <span className="field-hint">No pudimos cargar la imagen de esa URL.</span>
        )}

        <div className="publish-actions">
          <Button variant="secondary" onClick={() => navigate(-1)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Publicar
          </Button>
        </div>
      </form>
    </div>
  );
}
