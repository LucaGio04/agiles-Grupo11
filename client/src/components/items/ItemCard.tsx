import { Link } from 'react-router';
import { CATEGORIAS, ESTADOS_CONSERVACION, type Item } from '../../lib/items.ts';
import { ItemPhoto } from './ItemPhoto.tsx';

// Tarjeta del listado (HU-04): foto, título, categoría y estado de conservación. Lleva al detalle.
export function ItemCard({ item }: { item: Item }) {
  return (
    <Link to={`/items/${item.id}`} className="item-card">
      <ItemPhoto fotoUrl={item.fotoUrl} categoria={item.categoria} titulo={item.titulo} />
      <div className="item-card-body">
        <span className="item-card-category">{CATEGORIAS[item.categoria]}</span>
        <h2 className="item-card-title">{item.titulo}</h2>
        <div className="item-card-meta">
          <span className="item-card-condition">
            {ESTADOS_CONSERVACION[item.estadoConservacion]}
          </span>
          {item.materia && <span className="item-card-subject">{item.materia}</span>}
        </div>
      </div>
    </Link>
  );
}
