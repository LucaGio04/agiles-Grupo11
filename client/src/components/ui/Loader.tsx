type LoaderProps = {
  label?: string;
  className?: string;
};

export function Loader({ label = 'Cargando...', className }: LoaderProps) {
  return (
    <div className={['loader-container', className].filter(Boolean).join(' ')} role="status">
      <span className="loader-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
