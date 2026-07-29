// ---------------------------------------------------------------------------
// main.tsx — React entry point (replaces main.ts).
//
// Provider nesting (wagmi v2 docs): WagmiProvider wraps QueryClientProvider.
// QueryClient must be instantiated outside the render tree so it isn't
// recreated on every render.
// ---------------------------------------------------------------------------
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './wallet/config.js';
import { App } from './App.js';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>,
);
