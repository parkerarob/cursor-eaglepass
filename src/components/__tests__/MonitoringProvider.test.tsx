import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MonitoringProvider } from '../MonitoringProvider';

describe('MonitoringProvider Component', () => {
  it('should render children', () => {
    render(
      <MonitoringProvider>
        <div data-testid="test-child">Test Content</div>
      </MonitoringProvider>
    );
    
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render with multiple children', () => {
    render(
      <MonitoringProvider>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <span data-testid="child-3">Child 3</span>
      </MonitoringProvider>
    );
    
    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
    expect(screen.getByText('Child 3')).toBeInTheDocument();
  });

  it('should render with null children', () => {
    const { container } = render(
      <MonitoringProvider>
        {null}
      </MonitoringProvider>
    );
    
    // Should render but be empty with null children
    expect(container.firstChild).toBeInTheDocument();
  });
}); 