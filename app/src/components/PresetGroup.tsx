interface PresetItem<T> {
  value: T;
  label: string;
}

interface Props<T> {
  options: PresetItem<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function PresetGroup<T>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`font-mono text-sm font-semibold px-4 min-h-[40px] border tracking-wide transition-all duration-200 ${
              selected
                ? "bg-green text-black border-green shadow-[0_0_24px_rgba(0,255,136,.3)]"
                : "bg-panel text-text border-border hover:border-green hover:text-green"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
