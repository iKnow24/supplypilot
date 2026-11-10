/**
 * Re-mounts on every navigation inside the app, so each page eases in instead of snapping.
 * (Reduced motion turns the animation off globally.)
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
