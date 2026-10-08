import { ComingSoon } from '../components/ui/ComingSoon.tsx';

// Destino después del login. El listado real de ítems se implementa en su propia historia;
// por ahora muestra un placeholder del listado.
export function ItemsPage() {
  return (
    <ComingSoon
      title="¡Estamos armando TruequeUTN!"
      message="Muy pronto vas a poder publicar los materiales que ya no usás, buscar los que necesitás y proponer un intercambio a otros estudiantes de la UTN."
    />
  );
}
