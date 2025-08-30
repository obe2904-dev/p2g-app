'use client';

// app/(app)/dashboard/page.tsx
// Client Component + no SSG/ISR + ErrorBoundary

export const dynamic = 'force-dynamic';

import React from 'react';
import TabAiAssistant from '@/components/dashboard/TabAiAssistant';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: err?.message || String(err) };
  }
  componentDidCatch(error: any, info: any) {
    // Hjælper når vi skal fejlfinde i prod
    // (du kan fjerne denne senere)
    console.error('Dashboard error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <main style={{ maxWidth: 720, margin: '40px auto' }}>
          <h2>Der opstod en fejl i Dashboard</h2>
          <p style={{ color: '#b00' }}>{this.state.message}</p>
          <p style={{ fontSize: 13, color: '#555' }}>
            Tjek evt. browserens console for detaljer. Prøv at reloade siden.
          </p>
        </main>
      );
    }
    return <>{this.props.children}</>;
  }
}

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <TabAiAssistant />
    </ErrorBoundary>
  );
}
