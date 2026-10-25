import { Link, useLocation } from 'react-router';
import { ComingSoon } from '../components/ui/ComingSoon.tsx';

// Destino después del login. El listado real de ítems se implementa en su propia historia;
// por ahora muestra un placeholder del listado.
export function ItemsPage() {
  // Mensaje de confirmación que dejan otras pantallas al redirigir (ej. después de publicar).
  const flash = (useLocation().state as { flash?: string } | null)?.flash;

  return (
    <>
      {flash && (
        <p className="form-success" role="status">
          {flash}
        </p>
      )}
      <ComingSoon
        title="¡Estamos armando TruequeUTN!"
        message="Ya podés publicar los materiales que ya no usás. Muy pronto vas a poder buscar los que necesitás y proponer un intercambio a otros estudiantes de la UTN."
      >
        <Link to="/publicar" className="btn-primary">
          Publicar un material
        </Link>
      </ComingSoon>
    </>
  );
}
