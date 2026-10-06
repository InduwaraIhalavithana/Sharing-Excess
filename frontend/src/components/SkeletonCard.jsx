function SkeletonCard() {
  return (
    <div className="dashboard-card skeleton-card" aria-hidden="true">
      <div className="skeleton-img" />
      <div className="skeleton-line skeleton-line--title" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-line--short" />
      <div className="skeleton-btn-row">
        <div className="skeleton-btn" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="cards-grid">
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
