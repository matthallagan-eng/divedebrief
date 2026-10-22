import { CircleCheck, TriangleAlert } from "lucide-react";

// Status always pairs color with an icon and a label
export function AscentBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-mist">
        <CircleCheck size={14} className="text-seagrass" />
        None
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-foam">
      <TriangleAlert size={14} className="text-coral" />
      {count} too fast
    </span>
  );
}
