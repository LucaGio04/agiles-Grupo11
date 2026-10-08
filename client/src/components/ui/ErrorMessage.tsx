type ErrorMessageProps = {
  message: string;
  className?: string;
};

export function ErrorMessage({ message, className }: ErrorMessageProps) {
  return (
    <p className={['form-error', className].filter(Boolean).join(' ')} role="alert">
      {message}
    </p>
  );
}
