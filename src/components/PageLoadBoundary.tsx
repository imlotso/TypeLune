import { Component, type ReactNode } from 'react';

/** Keep a failed online-only page chunk from taking down the practice shell. */
export class PageLoadBoundary extends Component<{ children: ReactNode; message: string; retryLabel: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="content-panel feature-panel" role="alert">
      <p>{this.props.message}</p>
      <button type="button" className="outline-button" onClick={() => window.location.reload()}>{this.props.retryLabel}</button>
    </section>;
    return this.props.children;
  }
}
