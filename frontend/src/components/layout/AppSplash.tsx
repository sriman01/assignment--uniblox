/**
 * Same markup as the static splash in index.html (styled there), shown while the first route loaders run.
 * It replaces an already-visible splash, so it must not replay the entrance fade.
 */
export function AppSplash() {
  return (
    <div className="app-splash app-splash--mounted" role="status" aria-label="Loading the store">
      <span className="app-splash__mark">A</span>
      <span className="app-splash__bar">
        <span />
      </span>
    </div>
  );
}
