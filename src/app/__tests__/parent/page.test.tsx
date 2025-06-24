import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ParentPortalPage from '../../parent/page';

// Mock the ParentPortal component
jest.mock('@/components/ParentPortal', () => {
  return function MockParentPortal() {
    return <div data-testid="parent-portal">Parent Portal Component</div>;
  };
});

describe('ParentPortalPage', () => {
  it('should render the parent portal page', () => {
    render(<ParentPortalPage />);
    
    expect(screen.getByTestId('parent-portal')).toBeInTheDocument();
    expect(screen.getByText('Parent Portal Component')).toBeInTheDocument();
  });

  it('should have the correct page layout structure', () => {
    const { container } = render(<ParentPortalPage />);
    
    // Check for the main container structure
    const mainDiv = container.querySelector('.min-h-screen.bg-background');
    expect(mainDiv).toBeInTheDocument();
    
    const containerDiv = container.querySelector('.container.mx-auto.p-4');
    expect(containerDiv).toBeInTheDocument();
  });

  it('should have correct CSS classes applied', () => {
    const { container } = render(<ParentPortalPage />);
    
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('min-h-screen', 'bg-background');
    
    const innerDiv = outerDiv.firstChild as HTMLElement;
    expect(innerDiv).toHaveClass('container', 'mx-auto', 'p-4');
  });
}); 