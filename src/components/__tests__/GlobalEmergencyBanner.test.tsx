import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GlobalEmergencyBanner } from '../GlobalEmergencyBanner';

// Mock the EmergencyBanner component
jest.mock('../EmergencyBanner', () => ({
  EmergencyBanner: ({ active, activatedBy, activatedAt }: any) => (
    <div data-testid="emergency-banner">
      {active && (
        <div>
          <div data-testid="banner-active">Emergency Active</div>
          {activatedBy && <div data-testid="activated-by">{activatedBy}</div>}
          {activatedAt && <div data-testid="activated-at">{activatedAt.toISOString()}</div>}
        </div>
      )}
    </div>
  ),
}));

// Mock the Firebase firestore function
const mockUnsubscribe = jest.fn();
const mockSubscribeToEmergencyState = jest.fn();

jest.mock('@/lib/firebase/firestore', () => ({
  subscribeToEmergencyState: (callback: any) => {
    mockSubscribeToEmergencyState(callback); 
    return mockUnsubscribe;
  },
}));

describe('GlobalEmergencyBanner Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render EmergencyBanner with initial state', () => {
    render(<GlobalEmergencyBanner />);
    
    expect(screen.getByTestId('emergency-banner')).toBeInTheDocument();
    expect(mockSubscribeToEmergencyState).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should pass inactive state to EmergencyBanner initially', () => {
    render(<GlobalEmergencyBanner />);
    
    expect(screen.getByTestId('emergency-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('banner-active')).not.toBeInTheDocument();
  });

  it('should update EmergencyBanner when emergency state changes to active', async () => {
    render(<GlobalEmergencyBanner />);
    
    // Get the callback function that was passed to subscribeToEmergencyState
    const setEmergencyStateCallback = mockSubscribeToEmergencyState.mock.calls[0][0];
    
    // Simulate Firebase calling the callback with active emergency state
    const mockEmergencyState = {
      active: true,
      activatedBy: 'Principal Smith',
      activatedAt: new Date('2024-01-15T10:30:00Z')
    };
    
    setEmergencyStateCallback(mockEmergencyState);
    
    await waitFor(() => {
      expect(screen.getByTestId('banner-active')).toBeInTheDocument();
      expect(screen.getByTestId('activated-by')).toHaveTextContent('Principal Smith');
      expect(screen.getByTestId('activated-at')).toHaveTextContent('2024-01-15T10:30:00.000Z');
    });
  });

  it('should handle emergency state with only active flag', async () => {
    render(<GlobalEmergencyBanner />);
    
    const setEmergencyStateCallback = mockSubscribeToEmergencyState.mock.calls[0][0];
    
    // Simulate Firebase calling with minimal emergency state
    const mockEmergencyState = {
      active: true
    };
    
    setEmergencyStateCallback(mockEmergencyState);
    
    await waitFor(() => {
      expect(screen.getByTestId('banner-active')).toBeInTheDocument();
      expect(screen.queryByTestId('activated-by')).not.toBeInTheDocument();
      expect(screen.queryByTestId('activated-at')).not.toBeInTheDocument();
    });  
  });

  it('should handle inactive emergency state', async () => {
    render(<GlobalEmergencyBanner />);
    
    const setEmergencyStateCallback = mockSubscribeToEmergencyState.mock.calls[0][0];
    
    // First activate
    setEmergencyStateCallback({ active: true });
    
    await waitFor(() => {
      expect(screen.getByTestId('banner-active')).toBeInTheDocument();
    });
    
    // Then deactivate
    setEmergencyStateCallback({ active: false });
    
    await waitFor(() => {
      expect(screen.queryByTestId('banner-active')).not.toBeInTheDocument();
    });
  });

  it('should handle null emergency state', async () => {
    render(<GlobalEmergencyBanner />);
    
    const setEmergencyStateCallback = mockSubscribeToEmergencyState.mock.calls[0][0];
    
    // Simulate Firebase calling with null state
    setEmergencyStateCallback(null);
    
    await waitFor(() => {
      expect(screen.queryByTestId('banner-active')).not.toBeInTheDocument();
    });
  });

  it('should clean up subscription on unmount', () => {
    const { unmount } = render(<GlobalEmergencyBanner />);
    
    expect(mockSubscribeToEmergencyState).toHaveBeenCalled();
    
    unmount();
    
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
}); 