import { Mail, Monitor, MessageCircle, Share2, Layers, LogOut } from 'lucide-react';
import StarlightLogo from '../components/StarlightLogo';

// Small illustrative UI "snapshots" built from real design tokens rather than
// actual screenshots — gives a feel for the product without shipping bitmap
// assets we don't have captured yet.
function SnapshotWorkspace() {
  return (
    <div className="rounded-2xl border border-border bg-shading p-3">
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <div className="h-6 w-6 rounded-md bg-primary-label/20" />
        <div className="h-2 w-20 rounded-full bg-primary-label/20" />
      </div>
      <div className="mt-3 space-y-2">
        {[70, 45, 60].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-label/10 text-[10px] text-secondary-label">{i + 1}</div>
            <div className="h-2 rounded-full bg-primary-label/15" style={{ width: `${w}%` }} />
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

export default function MobileLanding({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-primary-background pb-10 text-primary-label">
      {/* Persistent desktop nudge */}
      <div className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-primary-label px-4 py-2 text-center text-xs font-semibold text-primary-background">
        <Monitor className="h-3.5 w-3.5 shrink-0" />
        Open Starlight Station on desktop for the full experience
      </div>

      <div className="mx-auto flex max-w-md flex-col items-center px-5 pt-10 text-center">
        <div className="mobile-landing-signal" aria-hidden="true"><span /><span /><span /></div>
        <StarlightLogo markClassName="h-14 w-14" />
        <h1 className="mt-6 text-2xl font-bold leading-tight">
          Your music, organized and moving.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-secondary-label">
          Starlight Station is where you upload tracks, manage versions, and collaborate with
          the people you make music with — built for focused work at a full-size screen.
        </p>

        {user && (
          <div className="mt-5 flex w-full items-center justify-between rounded-2xl border border-border bg-shading px-4 py-3 text-left">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name || user.email}</p>
              <p className="text-xs text-secondary-label">Signed in</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-secondary-label transition-colors hover:text-primary-label"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        )}
      </div>

      {/* Feature snapshots */}
      <div className="mx-auto mt-10 flex max-w-md flex-col gap-8 px-5">
        {features.map(({ icon: Icon, title, body, Snapshot }) => (
          <div key={title}>
            <Snapshot />
            <div className="mt-4 flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-label/10">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-secondary-label">{body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="mx-auto mt-12 max-w-md px-5" aria-labelledby="about-heading">
        <div className="rounded-2xl border border-border bg-shading p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-label">About Starlight Station</p>
          <h2 id="about-heading" className="mt-2 text-xl font-bold">A calmer home for the work behind the music.</h2>
          <p className="mt-3 text-sm leading-relaxed text-secondary-label">We bring drafts, versions, feedback, and collaboration into one focused studio so creative teams can keep moving without losing the details.</p>
        </div>
      </section>

      {/* Contact */}
      <div className="mx-auto mt-12 max-w-md px-5">
        <div className="rounded-2xl border border-border bg-shading p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary-label/10">
            <Mail className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold">Questions or feedback?</p>
          <p className="mt-1 text-sm text-secondary-label">We read every message.</p>
          <a
            href="mailto:hello@starlightstation.app"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-primary-label px-6 text-sm font-semibold text-primary-background"
          >
            Contact us
          </a>
        </div>
      </div>

      <p className="mx-auto mt-10 max-w-md px-5 text-center text-xs text-secondary-label">
        Starlight Station works best on a laptop or desktop browser. Come back on a bigger
        screen to upload, mix, and manage your projects.
      </p>
    </div>
  );
}
