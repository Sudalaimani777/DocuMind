import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignInView } from '../src/features/auth/views/SignInView';
import { AuthGuard } from '../src/core/auth/AuthGuard';
import { useAuthStore } from '../src/core/store/authStore';
import { apiClient } from '../src/core/api/client';

function renderWithProviders(initialPath = '/signin') {
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
          <Route path="/signin" element={<SignInView />} />
          <Route path="/signup" element={<div>Sign Up Page</div>} />
          <Route
            path="/library"
            element={
              <AuthGuard>
                <div>Library Workspace</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SignInView & AuthGuard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isCheckingAuth: false,
      hasCheckedAuth: true,
    });
  });

  it('renders SignIn editorial layout, fields, and Create Account link', () => {
    renderWithProviders('/signin');

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create account/i })).toHaveAttribute('href', '/signup');
  });

  it('toggles password visibility accessibly', async () => {
    const user = userEvent.setup();
    renderWithProviders('/signin');

    const passwordInput = screen.getByLabelText(/^password$/i);
    const toggleBtn = screen.getByRole('button', { name: /show password/i });

    expect(passwordInput).toHaveAttribute('type', 'password');
    await user.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows Zod validation messages on invalid input without calling API', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(apiClient, 'post');
    renderWithProviders('/signin');

    await user.type(screen.getByLabelText(/email address/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('submits valid credentials, updates auth store, and redirects to /library', async () => {
    const user = userEvent.setup();
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          user: {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Alice',
            organization: 'Acme',
            email: 'alice@example.com',
            createdAt: '2026-11-25T00:00:00.000Z',
          },
        },
        timestamp: '2026-11-25T00:00:00.000Z',
      },
    });

    renderWithProviders('/signin');

    await user.type(screen.getByLabelText(/email address/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'SecurePassword123!');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText('Library Workspace')).toBeInTheDocument();
    });
    expect(postSpy).toHaveBeenCalledWith('/auth/signin', {
      email: 'alice@example.com',
      password: 'SecurePassword123!',
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('redirects unauthenticated users from protected /library route to /signin', async () => {
    renderWithProviders('/library');

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });
});
