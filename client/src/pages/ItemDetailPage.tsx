import { useParams } from 'react-router';

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <>
      <h1>Detalle del ítem</h1>
      <p className="muted">Ítem #{id} — pantalla pendiente de implementación.</p>
    </>
  );
}
