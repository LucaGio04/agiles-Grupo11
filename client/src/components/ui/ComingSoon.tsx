import type { ReactNode } from 'react';
import { Card } from './Card.tsx';

type ComingSoonProps = {
  title: string;
  message: string;
  children?: ReactNode;
};

export function ComingSoon({ title, message, children }: ComingSoonProps) {
  return (
    <div className="coming-soon">
      <Card className="coming-soon-card">
        <span className="coming-soon-badge">Próximamente</span>
        <h1 className="coming-soon-title">{title}</h1>
        <p className="coming-soon-message">{message}</p>
        {children}
      </Card>
    </div>
  );
}
