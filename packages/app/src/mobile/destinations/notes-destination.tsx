import { MobileSurface } from "../components/mobile-surface";

export function NotesDestination() {
  return (
    <MobileSurface className="pb-20 md:pb-0">
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <h1 className="font-semibold text-2xl text-[var(--mobile-ink)]">笔记</h1>
        <p className="text-sm text-[var(--mobile-ink-muted)]">统一笔记库将在后续任务接入现有笔记与标注数据。</p>
      </div>
    </MobileSurface>
  );
}
