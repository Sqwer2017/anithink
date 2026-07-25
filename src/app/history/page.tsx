import { HistoryList } from "./history-list";

export default function HistoryPage() {
  return <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8"><h1 className="font-display text-3xl font-extrabold">История</h1><p className="mt-2 text-sm text-muted">Последние 30 открытых аниме на этом устройстве.</p><HistoryList /></main>;
}
