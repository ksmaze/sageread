import StatisticsPage from "@/pages/statistics";
import { MobileSurface } from "../components/mobile-surface";

export function StatsDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <StatisticsPage />
    </MobileSurface>
  );
}
