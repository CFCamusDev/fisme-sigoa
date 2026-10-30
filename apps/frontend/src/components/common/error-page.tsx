import { type ReactNode } from 'react';
import { Logo } from './logo';
import { Illustration } from './illustration';
import { type IllustrationName } from '@/lib/illustrations';
import { cn } from '@/lib/utils';

export interface ErrorPageProps {
  illustration: IllustrationName;
  title: string;
  description: string;
  action: ReactNode;
  role?: string;
  className?: string;
}

export function ErrorPage({
  illustration,
  title,
  description,
  action,
  role = 'region',
  className,
}: ErrorPageProps) {
  return (
    <main
      role={role}
      aria-label={title}
      className={cn(
        'flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center',
        className,
      )}
    >
      <div className="mb-6">
        <Logo variant="square" size={48} />
      </div>
      <Illustration name={illustration} size={200} />
      <h1 className="mt-6 text-h2 font-bold tracking-tight text-foreground sm:text-h1">{title}</h1>
      <p className="mt-2 max-w-md text-body text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div>
    </main>
  );
}
