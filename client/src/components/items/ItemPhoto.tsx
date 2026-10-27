import { useState } from 'react';
import { CATEGORIAS, type Categoria } from '../../lib/items.ts';

type ItemPhotoProps = {
  fotoUrl: string | null;
  categoria: Categoria;
  titulo: string;
  className?: string;
};

// Foto del ítem. Si no tiene, o no carga, muestra una imagen genérica según la categoría.
export function ItemPhoto({ fotoUrl, categoria, titulo, className }: ItemPhotoProps) {
  const [broken, setBroken] = useState(false);
  const classes = ['item-photo', className].filter(Boolean).join(' ');

  if (fotoUrl && !broken) {
    return (
      <div className={classes}>
        <img src={fotoUrl} alt={titulo} onError={() => setBroken(true)} />
      </div>
    );
  }

  const label = CATEGORIAS[categoria];
  return (
    <div className={`${classes} item-photo-generic`} role="img" aria-label={`${label} sin foto`}>
      <span className="item-photo-initial" aria-hidden="true">
        {label.charAt(0)}
      </span>
      <span className="item-photo-label" aria-hidden="true">
        {label} · sin foto
      </span>
    </div>
  );
}
