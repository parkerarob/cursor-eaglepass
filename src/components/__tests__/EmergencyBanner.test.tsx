import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EmergencyBanner } from '../EmergencyBanner';

describe('EmergencyBanner Component', () => {
  const mockDate = new Date('2024-01-15T10:30:00Z');

  it('should not render when not active', () => {
    const { container } = render(
      <EmergencyBanner active={false} />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('should render emergency banner when active', () => {
    render(
      <EmergencyBanner active={true} />
    );
    
    expect(screen.getByText('🚨 EMERGENCY FREEZE ACTIVE 🚨')).toBeInTheDocument();
  });

  it('should display basic emergency message without additional info', () => {
    render(
      <EmergencyBanner active={true} />
    );
    
    const banner = screen.getByText('🚨 EMERGENCY FREEZE ACTIVE 🚨');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveClass('w-full', 'bg-red-700', 'text-white', 'py-3', 'px-4', 'text-center', 'font-bold', 'text-lg', 'z-50', 'fixed', 'top-0', 'left-0', 'shadow-lg', 'animate-pulse');
  });

  it('should display activated by information when provided', () => {
    render(
      <EmergencyBanner 
        active={true} 
        activatedBy="Principal Smith" 
      />
    );
    
    expect(screen.getByText('🚨 EMERGENCY FREEZE ACTIVE 🚨')).toBeInTheDocument();
    expect(screen.getByText('Activated by: Principal Smith')).toBeInTheDocument();
  });

  it('should display activated by and time when both provided', () => {
    render(
      <EmergencyBanner 
        active={true} 
        activatedBy="Principal Smith" 
        activatedAt={mockDate}
      />
    );
    
    expect(screen.getByText('🚨 EMERGENCY FREEZE ACTIVE 🚨')).toBeInTheDocument();
    expect(screen.getByText(/Activated by: Principal Smith/)).toBeInTheDocument();
    expect(screen.getByText(/at \d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('should not display time without activatedBy', () => {
    render(
      <EmergencyBanner 
        active={true} 
        activatedAt={mockDate}
      />
    );
    
    expect(screen.getByText('🚨 EMERGENCY FREEZE ACTIVE 🚨')).toBeInTheDocument();
    expect(screen.queryByText(/at \d{1,2}:\d{2}:\d{2}/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Activated by:/)).not.toBeInTheDocument();
  });

  it('should have correct styling classes', () => {
    render(
      <EmergencyBanner active={true} />
    );
    
    const banner = screen.getByText('🚨 EMERGENCY FREEZE ACTIVE 🚨');
    expect(banner).toHaveClass(
      'w-full',
      'bg-red-700', 
      'text-white',
      'py-3',
      'px-4',
      'text-center',
      'font-bold',
      'text-lg',
      'z-50',
      'fixed',
      'top-0',
      'left-0',
      'shadow-lg',
      'animate-pulse'
    );
  });

  it('should have additional info styled correctly when provided', () => {
    render(
      <EmergencyBanner 
        active={true} 
        activatedBy="Principal Smith" 
        activatedAt={mockDate}
      />
    );
    
    const additionalInfo = screen.getByText(/Activated by: Principal Smith/);
    expect(additionalInfo).toHaveClass('block', 'text-sm', 'font-normal', 'mt-1');
  });
}); 