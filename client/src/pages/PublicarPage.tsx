import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
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
import { PHOTO_ACCEPT, PHOTO_MAX_BYTES, uploadPhoto, validatePhoto } from '../lib/uploads.ts';

type Field = 'titulo' | 'categoria' | 'estadoConservacion' | 'descripcion' | 'materia' | 'foto';
type FieldErrors = Partial<Record<Field, string>>;

const DESCRIPCION_MAX = 500;

// Formulario para publicar un material (HU-03) con foto opcional (HU-13).
// La ruta ya está protegida por PrivateRoute.
export function PublicarPage() {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [estadoConservacion, setEstadoConservacion] = useState<EstadoConservacion | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [materia, setMateria] = useState('');
  // Foto elegida y su vista previa local. La subida al servidor recién ocurre al publicar.
  const [foto, setFoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const fotoInput = useRef<HTMLInputElement>(null);
  // Última foto ya subida: si la publicación falla y el usuario reintenta, no se vuelve a subir.
  const uploadedFoto = useRef<{ file: File; url: string } | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Libera la vista previa anterior cuando cambia la foto y al salir de la página.
  useEffect(
    () => () => {
      if (foto) URL.revokeObjectURL(foto.previewUrl);
    },
    [foto]
  );

  const clearError = (field: Field) =>
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  function clearFotoInput() {
    if (fotoInput.current) fotoInput.current.value = '';
  }

  function handleFotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const problem = validatePhoto(file);
    if (problem) {
      // Se descarta la selección para que no quede un archivo inválido en el input.
      clearFotoInput();
      setFoto(null);
      setFieldErrors((prev) => ({ ...prev, foto: problem }));
      return;
    }

    setFoto({ file, previewUrl: URL.createObjectURL(file) });
    clearError('foto');
  }

  function removeFoto() {
    clearFotoInput();
    setFoto(null);
    clearError('foto');
  }

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

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError(null);
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      let fotoUrl: string | undefined;
      if (foto) {
        if (uploadedFoto.current?.file !== foto.file) {
          uploadedFoto.current = { file: foto.file, url: await uploadPhoto(foto.file) };
        }
        fotoUrl = uploadedFoto.current.url;
      }

      const body: CreateItemData = {
        titulo: titulo.trim(),
        categoria: categoria as Categoria,
        estadoConservacion: estadoConservacion as EstadoConservacion,
        descripcion: descripcion.trim() || undefined,
        materia: materia.trim() || undefined,
        fotoUrl,
      };
      const { item } = await apiFetch<{ item: Item }>('/api/items', { method: 'POST', body });
      navigate(`/items/${item.id}`, { state: { flash: '¡Listo! Tu material ya está publicado.' } });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 400 && Array.isArray(err.details)) {
          const errors: FieldErrors = {};
          for (const { field, message } of err.details as { field: string; message: string }[]) {
            const name = field.replace(/^body\./, '');
            // Si el servidor rechaza la URL de la foto, el error se muestra en el campo de la foto.
            errors[name === 'fotoUrl' ? 'foto' : (name as Field)] ??= message;
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

        <label className="field" htmlFor="foto">
          <span>Foto (opcional)</span>
          <input
            ref={fotoInput}
            id="foto"
            name="foto"
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={handleFotoChange}
            className={fieldErrors.foto ? 'input-error' : undefined}
            aria-invalid={fieldErrors.foto ? true : undefined}
            disabled={submitting}
          />
          <span className="field-hint">
            JPG, PNG o WebP, hasta {PHOTO_MAX_BYTES / 1024 / 1024} MB. Sin foto, mostramos una
            imagen genérica según la categoría.
          </span>
          {fieldErrors.foto && (
            <span className="field-error" role="alert">
              {fieldErrors.foto}
            </span>
          )}
        </label>
        {foto && (
          <div className="publish-photo">
            <img className="publish-preview" src={foto.previewUrl} alt="Vista previa de la foto" />
            <Button variant="secondary" onClick={removeFoto} disabled={submitting}>
              Quitar foto
            </Button>
          </div>
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
