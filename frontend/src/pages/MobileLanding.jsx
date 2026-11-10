import { Monitor } from 'lucide-react';
import StarlightLogo from '../components/StarlightLogo';

// Small illustrative UI "snapshots" built from real design tokens rather than
// actual screenshots — gives a feel for the product without shipping bitmap
// assets we don't have captured yet.
function SnapshotWorkspace() {
  return (
    <div className="rounded-2xl border border-border bg-shading p-3 shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <div className="h-6 w-6 rounded-md bg-primary-label/20" aria-hidden="true" />
        <div className="h-2 w-24 rounded-full bg-primary-label/20" aria-hidden="true" />
        <div className="ml-auto h-2 w-10 rounded-full bg-primary-label/10" aria-hidden="true" />
      </div>
      <div className="mt-3 space-y-2.5">
        {[['Struggles', '72%'], ['New arrangement', '48%'], ['Final mix', '61%']].map(([label, width]) => (
          <div key={label} className="flex min-w-0 items-center gap-2.5">
            <div className="h-7 w-7 shrink-0 rounded-lg bg-primary-label/10" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 h-1.5 w-20 max-w-full rounded-full bg-primary-label/20" aria-label={label} />
              <div className="h-1.5 rounded-full bg-primary-label/15" style={{ width }} aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotWaveform() {
  const bars = [30, 55, 80, 45, 90, 60, 35, 70, 50, 85, 40, 65, 30, 75, 55, 20, 60, 90, 45, 65];
  return (
    <div className="rounded-2xl border border-border bg-shading p-3">
      <div className="flex h-16 items-end gap-[3px]">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-full bg-primary-label/25" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="h-2 w-16 rounded-full bg-primary-label/15" />
        <div className="h-6 w-6 rounded-full bg-primary-label/20" />
        <div className="h-2 w-10 rounded-full bg-primary-label/15" />
      </div>
    </div>
  );
}

function SnapshotChat() {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-shading p-3">
      <div className="ml-auto max-w-[70%] rounded-2xl rounded-tr-sm bg-primary-label/20 px-3 py-2">
        <div className="h-2 w-24 rounded-full bg-primary-label/40" />
      </div>
      <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-primary-label/10 px-3 py-2">
        <div className="h-2 w-32 rounded-full bg-primary-label/30" />
      </div>
      <div className="ml-auto max-w-[55%] rounded-2xl rounded-tr-sm bg-primary-label/20 px-3 py-2">
        <div className="h-2 w-14 rounded-full bg-primary-label/40" />
      </div>
    </div>
  );
}

const features = [
  {
    icon: Layers,
    title: 'Organize every project',
    body: 'Folders, tracks, and versions kept in one workspace — nothing lost in a chat thread or a downloads folder.',
    Snapshot: SnapshotWorkspace
  },
  {
    icon: Monitor,
    title: 'Play, compare, and mix',
    body: 'A built-in player with speed and pitch control so you can audition versions side by side.',
    Snapshot: SnapshotWaveform
  },
  {
    icon: MessageCircle,
    title: 'Talk it through',
    body: 'Comment on a track, message your collaborators, and keep feedback attached to the work itself.',
    Snapshot: SnapshotChat
  }
];

export default function MobileLanding() {
  return (
    <main className="mobile-landing min-h-[100svh] overflow-x-hidden bg-primary-background px-4 py-6 text-primary-label sm:px-6 sm:py-10">
      <section className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-xl flex-col items-center justify-center text-center sm:min-h-[calc(100svh-5rem)]">
        <StarlightLogo markClassName="h-14 w-14 sm:h-16 sm:w-16" />
        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.24em] text-secondary-label sm:mt-8 sm:text-xs">Starlight Station</p>
        <h1 className="mt-3 max-w-md text-[clamp(1.7rem,8vw,2.75rem)] font-bold leading-[1.05]">Open on desktop</h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-secondary-label sm:text-base sm:leading-7">
          The full workspace is designed for a larger screen. Open Starlight Station on a desktop or laptop to continue.
        </p>
        <div className="mt-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-label/10 sm:mt-9" aria-hidden="true">
          <Monitor className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
      </section>
    </main>
  );
}
