import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignUpView } from '../src/features/auth/views/SignUpView';
import { useAuthStore } from '../src/core/store/authStore';
import { apiClient } from '../src/core/api/client';

function renderSignUp(initialPath = '/signup') {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/signup" element={<SignUpView />} />
          <Route path="/signin" element={<div>Sign In Page</div>} />
          <Route path="/library" element={<div>Library Workspace</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SignUpView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isCheckingAuth: false,
      hasCheckedAuth: true,
    });
  });

  it('renders SignUp fields, terms checkbox, and Sign in link', () => {
    renderSignUp();

    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/organization/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/signin');
  });

  it('validates all fields and terms acceptance before calling API', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(apiClient, 'post');
    renderSignUp();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/name must be at least 2 characters/i)).toBeInTheDocument();
    expect(await screen.findByText(/organization is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();
    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(await screen.findByText(/you must accept the enterprise terms/i)).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('submits valid signup payload, updates auth store, and navigates to /library', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          user: {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Elena Rostova',
            organization: 'Acme Global',
            email: 'elena@acme.com',
            createdAt: '2026-11-25T00:00:00.000Z',
          },
        },
        timestamp: '2026-11-25T00:00:00.000Z',
      },
    });

    renderSignUp();

    await user.type(screen.getByLabelText(/full name/i), 'Elena Rostova');
    await user.type(screen.getByLabelText(/organization/i), 'Acme Global');
    await user.type(screen.getByLabelText(/work email/i), 'Elena@Acme.com');
    await user.type(screen.getByLabelText(/^password$/i), 'SecurePassword123!');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Library Workspace')).toBeInTheDocument();
    });
    expect(postSpy).toHaveBeenCalledWith('/auth/signup', {
      name: 'Elena Rostova',
      organization: 'Acme Global',
      email: 'elena@acme.com',
      password: 'SecurePassword123!',
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
