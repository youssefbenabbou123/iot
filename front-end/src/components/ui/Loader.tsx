export function Loader({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-primary-400 ${className}`}
      role="status"
      aria-label="Chargement"
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader className="h-8 w-8 border-t-primary-300" />
      <span className="ml-3 text-sm text-slate-400">Chargement…</span>
    </div>
  );
}
