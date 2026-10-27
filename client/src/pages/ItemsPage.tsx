import { Link } from 'react-router';
import { ComingSoon } from '../components/ui/ComingSoon.tsx';

// Destino después del login. El listado real de ítems se implementa en su propia historia (HU-04);
// por ahora muestra un placeholder del listado.
export function ItemsPage() {
  return (
    <ComingSoon
      title="¡Estamos armando TruequeUTN!"
      showBadge={false}
      message="Ya podés publicar los materiales que ya no usás. Muy pronto vas a poder buscar los que necesitás y proponer un intercambio a otros estudiantes de la UTN."
    >
      <Link to="/publicar" className="btn-primary">
        Publicar un material
      </Link>
    </ComingSoon>
  );
}
