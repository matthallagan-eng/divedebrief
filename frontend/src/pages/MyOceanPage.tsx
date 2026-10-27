import { MyOcean } from "../components/achievements/MyOcean";

export default function MyOceanPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foam">My Ocean</h1>
        <p className="mt-1 text-sm text-mist">The sea creatures your diving has unlocked, and the ones still out there.</p>
      </div>
      <MyOcean />
    </div>
  );
}
