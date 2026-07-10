import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '55vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '60px 20px', gap: 12,
    }}>
      <div style={{ fontSize: 72 }}>🍃</div>
      <h1 style={{ fontSize: '2.2rem', margin: 0 }}>404 — Page Not Found</h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 420 }}>
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: 8 }}>
        ← Back to Home
      </Link>
    </div>
  );
}
