import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, useTheme } from '../ThemeProvider';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock document.documentElement.classList
const mockClassList = {
  toggle: jest.fn(),
  add: jest.fn(),
  remove: jest.fn(),
  contains: jest.fn(),
};
Object.defineProperty(document.documentElement, 'classList', {
  value: mockClassList,
});

// Test component that uses the theme
function TestComponent() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-display">{theme}</span>
      <button data-testid="toggle-button" onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
}

describe('ThemeProvider Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  it('should render children', () => {
    render(
      <ThemeProvider>
        <div data-testid="test-child">Test Child</div>
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should provide theme context to children', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('theme-display')).toHaveTextContent('light');
    expect(screen.getByTestId('toggle-button')).toBeInTheDocument();
  });

  it('should initialize with system preference when no saved theme', () => {
    // Mock system preference for dark mode
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: true, // System prefers dark mode
      media: '',
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('theme-display')).toHaveTextContent('dark');
    expect(mockClassList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should initialize with saved theme from localStorage', () => {
    mockLocalStorage.getItem.mockReturnValue('dark');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('theme-display')).toHaveTextContent('dark');
    expect(mockClassList.toggle).toHaveBeenCalledWith('dark', true);
  });

  it('should toggle theme when toggleTheme is called', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    
    const toggleButton = screen.getByTestId('toggle-button');
    
    // Initial state should be light
    expect(screen.getByTestId('theme-display')).toHaveTextContent('light');
    
    // Toggle to dark
    fireEvent.click(toggleButton);
    expect(screen.getByTestId('theme-display')).toHaveTextContent('dark');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
    expect(mockClassList.toggle).toHaveBeenCalledWith('dark', true);
    
    // Toggle back to light
    fireEvent.click(toggleButton);
    expect(screen.getByTestId('theme-display')).toHaveTextContent('light');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    expect(mockClassList.toggle).toHaveBeenCalledWith('dark', false);
  });

  it('should throw error when useTheme is used outside provider', () => {
    const TestComponentOutsideProvider = () => {
      const { theme } = useTheme();
      return <div>{theme}</div>;
    };

    // Suppress console.error for this test since we expect an error
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => render(<TestComponentOutsideProvider />)).toThrow(
      'useTheme must be used within a ThemeProvider'
    );
    
    consoleError.mockRestore();
  });
}); 