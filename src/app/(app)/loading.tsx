import { PawLoader } from "@/components/PawLoader";

/** Appears at once on every tap in the menu, while the server gathers the data. */
export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="skeleton h-44" />
      <PawLoader />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
      </div>
      <div className="skeleton h-56" />
    </div>
  );
}
