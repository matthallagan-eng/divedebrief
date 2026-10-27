// A row of mutually exclusive buttons, e.g. metric or imperial
export interface ToggleProps<V extends string> {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  disabled?: boolean;
  onChange: (value: V) => void;
}

export function Toggle<V extends string>({ label, value, options, disabled, onChange }: ToggleProps<V>) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-surface-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => value !== o.value && onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm transition-colors disabled:cursor-wait ${
            value === o.value ? "bg-lagoon/20 text-foam" : "text-murk hover:text-mist"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
