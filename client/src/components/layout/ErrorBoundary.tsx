import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * Top-level React ErrorBoundary catching unexpected render errors with a recovery UI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-20">
        <div
          role="alert"
          className="max-w-md w-full bg-surface border border-outline rounded-card p-32 flex flex-col items-center text-center gap-20 shadow-sm"
        >
          <span className="w-12 h-12 rounded-pill bg-status-failed-bg text-status-failed-text flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="font-t01 text-t01 text-on-surface">Something went wrong</h1>
            <p className="font-t04 text-t04 text-on-surface-variant">{this.state.message}</p>
          </div>
          <div className="flex items-center gap-15">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-15 py-2.5 rounded-md border border-outline bg-surface text-on-surface hover:bg-surface-subtle font-t04 text-t04-medium"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Try again</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-20 py-2.5 rounded-md bg-secondary text-on-secondary hover:bg-primary hover:text-on-primary font-t04 text-t04-medium"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
