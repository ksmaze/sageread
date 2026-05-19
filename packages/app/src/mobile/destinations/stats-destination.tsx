import StatisticsPage from "@/pages/statistics";
import { MobileSurface } from "../components/mobile-surface";

export function StatsDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <header>
          <h1 className="font-semibold text-2xl text-[var(--mobile-ink)]">阅读统计</h1>
          <p className="text-[var(--mobile-ink-muted)] text-sm">回顾阅读时间、热力图和近期阅读节奏</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <StatisticsPage />
        </div>
      </div>
    </MobileSurface>
  );
}
