import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 select-text">
          <div className="w-full max-w-2xl bg-slate-900 border border-rose-500/30 rounded-3xl p-8 shadow-2xl shadow-rose-950/40">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <AlertTriangle className="w-8 h-8 text-rose-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white">Application Render Error</h1>
                <p className="text-xs text-rose-300/80">An unexpected React rendering error occurred</p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6 font-mono text-xs text-rose-300 overflow-x-auto whitespace-pre-wrap max-h-64">
              <p className="font-bold text-white mb-2">{this.state.error?.toString()}</p>
              {this.state.errorInfo?.componentStack && (
                <p className="text-[11px] text-slate-400">{this.state.errorInfo.componentStack}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleHardReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset Local Cache & Restart</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
