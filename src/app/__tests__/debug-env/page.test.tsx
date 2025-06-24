import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DebugEnv from '../../debug-env/page';

// Mock process.env for consistent testing
const mockEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test-auth-domain',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project-id',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'test-storage-bucket',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'test-sender-id',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'test-app-id',
  NODE_ENV: 'test',
  VERCEL_ENV: 'test',
};

describe('DebugEnv Page', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Mock process.env
    Object.assign(process.env, mockEnv);
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  it('should render the debug environment page', () => {
    render(<DebugEnv />);
    
    expect(screen.getByText('🔍 Environment Variables Debug')).toBeInTheDocument();
  });

  it('should display environment info section', () => {
    render(<DebugEnv />);
    
    expect(screen.getByText('📊 Environment Info')).toBeInTheDocument();
    expect(screen.getByText(/NODE_ENV:/)).toBeInTheDocument();
    expect(screen.getByText(/VERCEL_ENV:/)).toBeInTheDocument();
    expect(screen.getByText(/Build Time:/)).toBeInTheDocument();
  });

  it('should display Firebase environment variables section', () => {
    render(<DebugEnv />);
    
    expect(screen.getByText('🔥 Firebase Environment Variables')).toBeInTheDocument();
    expect(screen.getByText('Status Check:')).toBeInTheDocument();
  });

  it('should show Firebase variable status indicators', () => {
    render(<DebugEnv />);
    
    // Should show SET status for mocked variables
    expect(screen.getAllByText('✅ SET').length).toBeGreaterThan(0);
    
    // Should show variable names
    expect(screen.getByText(/NEXT_PUBLIC_FIREBASE_API_KEY:/)).toBeInTheDocument();
    expect(screen.getByText(/NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:/)).toBeInTheDocument();
  });

  it('should display all NEXT_PUBLIC environment variables section', () => {
    render(<DebugEnv />);
    
    expect(screen.getByText('🔑 All NEXT_PUBLIC Environment Variables')).toBeInTheDocument();
    expect(screen.getByText(/Count:/)).toBeInTheDocument();
  });

  it('should display debugging tips', () => {
    render(<DebugEnv />);
    
    expect(screen.getByText('🛠️ Debugging Tips')).toBeInTheDocument();
    expect(screen.getByText(/Environment variables should be set in Vercel dashboard/)).toBeInTheDocument();
    expect(screen.getByText(/Variables must start with NEXT_PUBLIC_/)).toBeInTheDocument();
  });

  it('should handle missing environment variables', () => {
    // Test with minimal env vars
    process.env = { NODE_ENV: 'test' };
    
    render(<DebugEnv />);
    
    expect(screen.getAllByText('❌ MISSING').length).toBeGreaterThan(0);
  });

  it('should have correct styling', () => {
    const { container } = render(<DebugEnv />);
    
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveStyle({
      padding: '20px',
      fontFamily: 'monospace',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    });
  });
}); 