type Props = {
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorMessage({ message, onRetry, className = "" }: Props) {
  return (
    <div
      className={`rounded-xl border border-red-700/60 bg-red-950/40 px-4 py-3 text-sm text-red-300 flex items-center justify-between gap-3 flex-wrap ${className}`}
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-xs font-medium"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
