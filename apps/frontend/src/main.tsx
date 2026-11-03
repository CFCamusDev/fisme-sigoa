import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import '@fontsource-variable/open-sans';
import { setAuthTokenProvider } from './lib/axios';
import { useAuthStore } from './stores/auth.store';
import { configureSession } from './session';
import { router } from './router';
import './index.css';

setAuthTokenProvider(() => useAuthStore.getState().accessToken);
configureSession({
  navigateToLogin: (reason) => {
    void router.navigate({
      to: '/login',
      search: reason ? { reason } : undefined,
      replace: true,
    });
  },
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento raíz #root no encontrado en el DOM.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
