import type { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  sub?: ReactNode;
  icon?: ReactNode;
}

export function StatCard({ label, value, sub, icon }: Props) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised/80 p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-murk">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foam">{value}</p>
      {sub && <div className="mt-1 text-sm text-mist">{sub}</div>}
    </div>
  );
}
