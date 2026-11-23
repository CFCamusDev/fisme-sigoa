import { useCallback, useRef } from 'react';

export function useRestoreFocus() {
  const openerRef = useRef<HTMLElement | null>(null);

  const remember = useCallback((element: HTMLElement | null) => {
    openerRef.current = element;
  }, []);

  const restore = useCallback((event?: Event) => {
    const opener = openerRef.current;
    openerRef.current = null;

    if (opener) {
      event?.preventDefault();
      if (opener.isConnected) {
        opener.focus();
        return;
      }
      document.querySelector<HTMLElement>('main#main-content')?.focus();
      return;
    }

    if (!event) {
      document.querySelector<HTMLElement>('main#main-content')?.focus();
    }
  }, []);

  return { remember, restore };
}
