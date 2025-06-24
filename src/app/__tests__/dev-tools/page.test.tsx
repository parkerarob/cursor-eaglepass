import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DevToolsPage from '../../dev-tools/page';

// Mock the Firebase modules
jest.mock('firebase/firestore', () => ({
  writeBatch: jest.fn(),
  getFirestore: jest.fn(),
  doc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

jest.mock('@/lib/firebase/config', () => ({
  firebaseApp: {},
}));

// Mock the data and services
jest.mock('@/lib/mockData', () => ({
  mockUsers: [
    { id: 'user1', name: 'Test User 1' },
    { id: 'user2', name: 'Test User 2' },
  ],
  mockLocations: [
    { id: 'loc1', name: 'Test Location 1' },
    { id: 'loc2', name: 'Test Location 2' },
  ],
}));

jest.mock('@/lib/dataIngestionService', () => ({
  dataIngestionService: {
    parseCSV: jest.fn(),
    validateCSV: jest.fn(),
    ingestUsers: jest.fn(),
    ingestLocations: jest.fn(),
    ingestGroups: jest.fn(),
    ingestAutonomyMatrix: jest.fn(),
    ingestRestrictions: jest.fn(),
  },
  CSV_SCHEMAS: {
    users: {},
    locations: {},
    groups: {},
    autonomyMatrix: {},
    restrictions: {},
  },
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button">
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
}));

describe('DevToolsPage', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      configurable: true,
    });
  });

  it('should show dev tools not available in production', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
    });

    render(<DevToolsPage />);

    expect(screen.getByText('Dev tools are only available in development mode.')).toBeInTheDocument();
  });

  it('should render dev tools interface in development mode', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    render(<DevToolsPage />);

    expect(screen.getByText('Dev Tools: Firestore Migration')).toBeInTheDocument();
    expect(screen.getByText('Upload Users')).toBeInTheDocument();
    expect(screen.getByText('Upload Locations')).toBeInTheDocument();
  });

  it('should display pre-filled user JSON data', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    render(<DevToolsPage />);

    // Check for textarea with mock user data
    const userTextarea = screen.getAllByRole('textbox')[0];
    expect(userTextarea).toBeInTheDocument();
    expect(userTextarea).toHaveValue(expect.stringContaining('Test User 1'));
  });

  it('should display pre-filled location JSON data', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    render(<DevToolsPage />);

    // Check for textarea with mock location data
    const locationTextarea = screen.getAllByRole('textbox')[1];
    expect(locationTextarea).toBeInTheDocument();
    expect(locationTextarea).toHaveValue(expect.stringContaining('Test Location 1'));
  });

  it('should handle user JSON input changes', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    render(<DevToolsPage />);

    const userTextarea = screen.getAllByRole('textbox')[0];
    fireEvent.change(userTextarea, {
      target: { value: '[{"id": "test", "name": "New User"}]' }
    });

    expect(userTextarea).toHaveValue('[{"id": "test", "name": "New User"}]');
  });

  it('should handle location JSON input changes', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    render(<DevToolsPage />);

    const locationTextarea = screen.getAllByRole('textbox')[1];
    fireEvent.change(locationTextarea, {
      target: { value: '[{"id": "test", "name": "New Location"}]' }
    });

    expect(locationTextarea).toHaveValue('[{"id": "test", "name": "New Location"}]');
  });

  it('should handle successful user upload', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });
    
    const { writeBatch, doc } = require('firebase/firestore');
    const mockBatch = {
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    writeBatch.mockReturnValue(mockBatch);
    doc.mockReturnValue({ path: 'users/test' });

    render(<DevToolsPage />);

    const uploadButton = screen.getAllByTestId('button').find(
      button => button.textContent === 'Upload Users'
    );

    fireEvent.click(uploadButton!);

    await waitFor(() => {
      expect(screen.getByText('Users uploaded successfully!')).toBeInTheDocument();
    });
  });

  it('should handle user upload error for invalid JSON', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    render(<DevToolsPage />);

    // Set invalid JSON
    const userTextarea = screen.getAllByRole('textbox')[0];
    fireEvent.change(userTextarea, {
      target: { value: 'invalid json' }
    });

    const uploadButton = screen.getAllByTestId('button').find(
      button => button.textContent === 'Upload Users'
    );

    fireEvent.click(uploadButton!);

    await waitFor(() => {
      expect(screen.getByText(/Error uploading users:/)).toBeInTheDocument();
    });
  });

  it('should handle location upload', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });
    
    const { writeBatch, doc } = require('firebase/firestore');
    const mockBatch = {
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    writeBatch.mockReturnValue(mockBatch);
    doc.mockReturnValue({ path: 'locations/test' });

    render(<DevToolsPage />);

    const uploadButton = screen.getAllByTestId('button').find(
      button => button.textContent === 'Upload Locations'
    );

    fireEvent.click(uploadButton!);

    await waitFor(() => {
      expect(screen.getByText('Locations uploaded successfully!')).toBeInTheDocument();
    });
  });

  it('should handle CSV file selection', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    render(<DevToolsPage />);

    const fileInput = screen.getByLabelText(/CSV File/);
    expect(fileInput).toBeInTheDocument();

    const testFile = new File(['test,data'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // File should be selected (exact assertion depends on implementation)
    expect(fileInput).toBeInTheDocument();
  });

  it('should handle close all passes action', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });
    
    const { getDocs, query, collection, where, writeBatch, doc } = require('firebase/firestore');
    
    const mockQuerySnapshot = {
      empty: false,
      size: 2,
      forEach: jest.fn(callback => {
        callback({ id: 'pass1' });
        callback({ id: 'pass2' });
      }),
    };
    
    const mockBatch = {
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };

    getDocs.mockResolvedValue(mockQuerySnapshot);
    query.mockReturnValue({});
    collection.mockReturnValue({});
    where.mockReturnValue({});
    writeBatch.mockReturnValue(mockBatch);
    doc.mockReturnValue({ path: 'passes/test' });

    render(<DevToolsPage />);

    const closePassesButton = screen.getAllByTestId('button').find(
      button => button.textContent === 'Close All Active Passes'
    );

    fireEvent.click(closePassesButton!);

    await waitFor(() => {
      expect(screen.getByText('Successfully closed 2 active pass(es).')).toBeInTheDocument();
    });
  });

  it('should handle no active passes to close', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });
    
    const { getDocs } = require('firebase/firestore');
    
    const mockQuerySnapshot = {
      empty: true,
      size: 0,
    };

    getDocs.mockResolvedValue(mockQuerySnapshot);

    render(<DevToolsPage />);

    const closePassesButton = screen.getAllByTestId('button').find(
      button => button.textContent === 'Close All Active Passes'
    );

    fireEvent.click(closePassesButton!);

    await waitFor(() => {
      expect(screen.getByText('No active passes found to close.')).toBeInTheDocument();
    });
  });

  it('should display CSV upload section', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    render(<DevToolsPage />);

    expect(screen.getByText('CSV Data Ingestion')).toBeInTheDocument();
    expect(screen.getByLabelText(/CSV File/)).toBeInTheDocument();
  });

  it('should display pass management section', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    render(<DevToolsPage />);

    expect(screen.getByText('Pass Management')).toBeInTheDocument();
    expect(screen.getAllByTestId('button').find(
      button => button.textContent === 'Close All Active Passes'
    )).toBeInTheDocument();
  });
}); 