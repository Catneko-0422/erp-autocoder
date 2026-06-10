import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="pt-8 px-6 text-center">{children}</div>;
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="p-6">{children}</div>;
}
