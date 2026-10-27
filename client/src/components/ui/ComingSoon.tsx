import type { ReactNode } from 'react';
import { Card } from './Card.tsx';

type ComingSoonProps = {
  title: string;
  message: string;
  showBadge?: boolean;
  children?: ReactNode;
};

export function ComingSoon({ title, message, showBadge = true, children }: ComingSoonProps) {
  return (
    <div className="coming-soon">
      <Card className="coming-soon-card">
        {showBadge && <span className="coming-soon-badge">Próximamente</span>}
        <h1 className="coming-soon-title">{title}</h1>
        <p className="coming-soon-message">{message}</p>
        {children}
      </Card>
    </div>
  );
}
