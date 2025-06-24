import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Login } from '../Login';

// Mock Firebase auth functions
jest.mock('@/lib/firebase/auth', () => ({
  signInWithGoogle: jest.fn(),
}));

// Mock Next.js components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h1 className={className}>{children}</h1>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
}));

describe('Login Component', () => {
  const mockSignInWithGoogle = require('@/lib/firebase/auth').signInWithGoogle;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login form', () => {
    render(<Login />);
    
    expect(screen.getByText('Welcome to Eagle Pass')).toBeInTheDocument();
    expect(screen.getByText('Please sign in to continue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('should show loading state during login', async () => {
    mockSignInWithGoogle.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );

    render(<Login />);
    
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    
    expect(screen.getByText(/signing in/i)).toBeInTheDocument();
  });

  it('should handle successful login', async () => {
    mockSignInWithGoogle.mockResolvedValue({
      user: { uid: 'test-uid', email: 'test@example.com' }
    });

    render(<Login />);
    
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    
    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
  });

  it('should handle login error', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('Failed to sign in'));

    render(<Login />);
    
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/failed to sign in/i)).toBeInTheDocument();
    });
  });

  it('should disable button during loading', async () => {
    mockSignInWithGoogle.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );

    render(<Login />);
    
    const button = screen.getByRole('button', { name: /sign in with google/i });
    fireEvent.click(button);
    
    expect(button).toBeDisabled();
  });

  it('should clear error when starting new sign in', async () => {
    // First, cause an error
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('Network error'));
    render(<Login />);
    
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    // Then, start a new sign in
    mockSignInWithGoogle.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    
    expect(screen.queryByText(/network error/i)).not.toBeInTheDocument();
  });
}); 