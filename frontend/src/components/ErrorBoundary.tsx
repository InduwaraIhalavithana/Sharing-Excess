import { Component, type ErrorInfo, type ReactNode } from 'react';
import { phrases, tr } from '../i18n/phrases';

/** The boundary sits outside the language provider, so it reads the saved language directly. */
function say(text: string): string {
  try {
    const lang = localStorage.getItem('se-lang');
    return (lang === 'si' || lang === 'ta' ? (phrases as Record<string, Record<string, string>>)[lang]?.[text] : undefined) ?? text;
  } catch {
    return text;
  }
}

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors so one broken page shows a friendly message instead of a blank screen. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="se-error-boundary" role="alert">
        <div className="se-error-boundary__icon">🍃</div>
        <h1>{say(tr('Something went wrong'))}</h1>
        <p>{say(tr('The page hit an unexpected problem. Your data is safe - try reloading.'))}</p>
        <div className="se-error-boundary__actions">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            {say(tr("Reload page"))}
          </button>
          <a className="btn btn-outline" href="/">
            {say(tr("Go to Home"))}
          </a>
        </div>
      </div>
    );
  }
}
