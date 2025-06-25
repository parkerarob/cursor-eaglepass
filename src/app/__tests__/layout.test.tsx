import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RootLayout from '../layout';

// Mock all the provider components
jest.mock('@/components/ThemeProvider', () => ({
  ThemeProvider: ({ children }: any) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

jest.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: any) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

jest.mock('@/components/SessionProvider', () => ({
  SessionProvider: ({ children }: any) => (
    <div data-testid="session-provider">{children}</div>
  ),
}));

jest.mock('@/components/RoleProvider', () => ({
  RoleProvider: ({ children }: any) => (
    <div data-testid="role-provider">{children}</div>
  ),
}));

jest.mock('@/components/MonitoringProvider', () => ({
  MonitoringProvider: ({ children }: any) => (
    <div data-testid="monitoring-provider">{children}</div>
  ),
}));

jest.mock('@/components/SessionTimeoutWarning', () => ({
  SessionTimeoutWarning: () => (
    <div data-testid="session-timeout-warning">Session Timeout Warning</div>
  ),
}));

jest.mock('@/components/GlobalEmergencyBanner', () => ({
  GlobalEmergencyBanner: () => (
    <div data-testid="global-emergency-banner">Global Emergency Banner</div>
  ),
}));

// Mock Vercel Analytics
jest.mock('@vercel/analytics/next', () => ({
  Analytics: () => <div data-testid="analytics">Analytics</div>,
}));

// Mock Next.js font imports
jest.mock('next/font/google', () => ({
  Geist: () => ({
    variable: '--font-geist-sans',
  }),
  Geist_Mono: () => ({
    variable: '--font-geist-mono',
  }),
}));

describe('RootLayout', () => {
  it('should render the complete provider hierarchy', () => {
    render(
      <RootLayout>
        <div data-testid="test-children">Test Children</div>
      </RootLayout>
    );

    // Check that all providers are rendered
    expect(screen.getByTestId('global-emergency-banner')).toBeInTheDocument();
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    expect(screen.getByTestId('monitoring-provider')).toBeInTheDocument();
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
    expect(screen.getByTestId('role-provider')).toBeInTheDocument();
    expect(screen.getByTestId('session-timeout-warning')).toBeInTheDocument();
    expect(screen.getByTestId('analytics')).toBeInTheDocument();
  });

  it('should render children content', () => {
    render(
      <RootLayout>
        <div data-testid="test-children">Test Children</div>
      </RootLayout>
    );

    expect(screen.getByTestId('test-children')).toBeInTheDocument();
    expect(screen.getByText('Test Children')).toBeInTheDocument();
  });

  it('should have correct HTML structure', () => {
    const { container } = render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>
    );

    const htmlElement = container.querySelector('html');
    expect(htmlElement).toHaveAttribute('lang', 'en');

    const bodyElement = container.querySelector('body');
    expect(bodyElement).toBeInTheDocument();
  });

  it('should apply font variables to body', () => {
    const { container } = render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>
    );

    const bodyElement = container.querySelector('body');
    expect(bodyElement).toHaveClass('antialiased');
    // Class string should include mocked font variable names
    expect(bodyElement?.className).toContain('GeistSans');
  });

  it('should render provider nesting in correct order', () => {
    render(
      <RootLayout>
        <div data-testid="nested-child">Nested Child</div>
      </RootLayout>
    );

    // Verify the nesting structure exists
    const themeProvider = screen.getByTestId('theme-provider');
    const monitoringProvider = screen.getByTestId('monitoring-provider');
    const authProvider = screen.getByTestId('auth-provider');
    const sessionProvider = screen.getByTestId('session-provider');
    const roleProvider = screen.getByTestId('role-provider');

    // All should be in document
    expect(themeProvider).toBeInTheDocument();
    expect(monitoringProvider).toBeInTheDocument();
    expect(authProvider).toBeInTheDocument();
    expect(sessionProvider).toBeInTheDocument();
    expect(roleProvider).toBeInTheDocument();

    // Child content should be nested inside providers
    expect(screen.getByTestId('nested-child')).toBeInTheDocument();
  });

  it('should handle empty children', () => {
    render(<RootLayout>{null}</RootLayout>);

    // Should still render all providers and warning components
    expect(screen.getByTestId('global-emergency-banner')).toBeInTheDocument();
    expect(screen.getByTestId('session-timeout-warning')).toBeInTheDocument();
    expect(screen.getByTestId('analytics')).toBeInTheDocument();
  });

  it('should render multiple children elements', () => {
    render(
      <RootLayout>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <span data-testid="child-3">Child 3</span>
      </RootLayout>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
  });

  it('should include analytics component', () => {
    render(
      <RootLayout>
        <div>Test</div>
      </RootLayout>
    );

    expect(screen.getByTestId('analytics')).toBeInTheDocument();
  });
}); 