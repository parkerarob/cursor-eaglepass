import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminReportsPage from '../../../admin/reports/page';

// Mock the child components
jest.mock('@/components/FrequentFlyersCard', () => ({
  FrequentFlyersCard: ({ title, limit }: any) => (
    <div data-testid="frequent-flyers-card">
      {title} - Limit: {limit}
    </div>
  ),
}));

jest.mock('@/components/StallSitterCard', () => ({
  StallSitterCard: ({ limit }: any) => (
    <div data-testid="stall-sitter-card">
      Stall Sitter Card - Limit: {limit}
    </div>
  ),
}));

jest.mock('@/components/StudentSearch', () => ({
  StudentSearch: () => (
    <div data-testid="student-search">Student Search Component</div>
  ),
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, className, ...props }: any) => (
    <button data-variant={variant} className={className} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children }: any) => (
    <div data-testid="card-content">
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => (
    <div data-testid="card-header">
      {children}
    </div>
  ),
  CardTitle: ({ children }: any) => (
    <h3 data-testid="card-title">
      {children}
    </h3>
  ),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  ArrowLeft: ({ className }: any) => (
    <span data-testid="arrow-left-icon" className={className}>
      ←
    </span>
  ),
}));

describe('AdminReportsPage', () => {
  it('should render the admin reports page', () => {
    render(<AdminReportsPage />);
    
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
  });

  it('should display the header with title and back button', () => {
    render(<AdminReportsPage />);
    
    const title = screen.getByText('Reports');
    expect(title).toBeInTheDocument();
    expect(title.tagName).toBe('H1');
    
    const backButton = screen.getByText('Back to Dashboard');
    expect(backButton).toBeInTheDocument();
    expect(backButton.closest('a')).toHaveAttribute('href', '/teacher');
  });

  it('should display student pass history card', () => {
    render(<AdminReportsPage />);
    
    expect(screen.getByText('Student Pass History')).toBeInTheDocument();
    expect(screen.getByText('Select a student to view their complete pass history.')).toBeInTheDocument();
    expect(screen.getByTestId('student-search')).toBeInTheDocument();
  });

  it('should display frequent flyers card with correct props', () => {
    render(<AdminReportsPage />);
    
    const frequentFlyersCard = screen.getByTestId('frequent-flyers-card');
    expect(frequentFlyersCard).toBeInTheDocument();
    expect(frequentFlyersCard).toHaveTextContent('School-Wide Frequent Flyers - Limit: 10');
  });

  it('should display stall sitter card with correct props', () => {
    render(<AdminReportsPage />);
    
    const stallSitterCard = screen.getByTestId('stall-sitter-card');
    expect(stallSitterCard).toBeInTheDocument();
    expect(stallSitterCard).toHaveTextContent('Stall Sitter Card - Limit: 10');
  });

  it('should have correct layout structure', () => {
    const { container } = render(<AdminReportsPage />);
    
    const mainContainer = container.querySelector('.container.mx-auto.p-4.md\\:p-8');
    expect(mainContainer).toBeInTheDocument();
    
    const headerSection = container.querySelector('.flex.items-center.justify-between.mb-6');
    expect(headerSection).toBeInTheDocument();
    
    const contentSection = container.querySelector('.space-y-6');
    expect(contentSection).toBeInTheDocument();
  });

  it('should have arrow left icon in back button', () => {
    render(<AdminReportsPage />);
    
    expect(screen.getByTestId('arrow-left-icon')).toBeInTheDocument();
  });

  it('should apply correct CSS classes', () => {
    const { container } = render(<AdminReportsPage />);
    
    const title = screen.getByText('Reports');
    expect(title).toHaveClass('text-3xl', 'font-bold', 'tracking-tight');
    
    const backButton = screen.getByText('Back to Dashboard');
    expect(backButton).toHaveAttribute('data-variant', 'outline');
  });
}); 