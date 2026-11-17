import { ArrowRight, Headphones, Layers3, Radio, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import StarlightLogo from '../components/StarlightLogo';

const highlights = [
  { icon: Layers3, title: 'Keep every version', text: 'A calm home for projects, folders, and the ideas between the first take and the finished sound.' },
  { icon: Headphones, title: 'Listen in context', text: 'Play, compare, comment, and return to the exact version that made you stop and listen.' },
  { icon: Radio, title: 'Share the moment', text: 'Bring collaborators and listeners into the work through previews, stories, and live rooms.' },
];

export default function Landing() {
  return (
    <main className="landing-page min-h-screen overflow-hidden bg-primary-background text-primary-label">
      <div className="landing-glow landing-glow-one" aria-hidden="true" />
      <div className="landing-glow landing-glow-two" aria-hidden="true" />
      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <StarlightLogo showTagline={false} markClassName="h-10 w-10" className="text-primary-label" />
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/login" className="landing-nav-link rounded-xl px-3 py-2 text-sm font-semibold sm:px-4">Sign in</Link>
          <Link to="/login?mode=register" className="landing-nav-cta inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold sm:px-4">Create account <ArrowRight size={15} /></Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[min(760px,calc(100vh-5rem))] w-full max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(25rem,.98fr)] lg:px-12 lg:pb-24 lg:pt-16">
        <div className="max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-label/15 bg-white/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-secondary-label"><Sparkles size={14} /> A softer place for unfinished ideas</p>
          <h1 className="max-w-2xl text-[clamp(3.25rem,8vw,7.5rem)] font-semibold leading-[.9] tracking-[-.06em]">Make room for the next sound.</h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-secondary-label sm:text-lg sm:leading-8">Starlight Station gives your music a place to grow, with every version, conversation, and collaboration kept close.</p>
          <div className="mt-9 flex flex-wrap items-center gap-3"><Link to="/login?mode=register" className="landing-primary-action inline-flex min-h-12 items-center gap-2 rounded-xl px-5 py-3 font-semibold">Start creating <ArrowRight size={17} /></Link><Link to="/login" className="landing-secondary-action inline-flex min-h-12 items-center rounded-xl px-5 py-3 font-semibold">Sign in</Link></div>
          <p className="mt-5 text-xs text-secondary-label/75">Projects, playback, collaboration, and live rooms in one studio.</p>
        </div>

        <div className="landing-preview relative mx-auto w-full max-w-xl">
          <div className="landing-preview-bar"><span /><span /><span /><p>your next idea</p></div>
          <div className="landing-preview-body"><div className="landing-preview-cover"><div className="landing-preview-orbit" /><Headphones size={34} /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.18em] text-white/55">Project workspace</p><h2 className="mt-2 truncate text-2xl font-semibold text-white sm:text-3xl">The unfinished takes</h2><p className="mt-2 text-sm text-white/55">4 versions · 12 comments · just now</p><div className="mt-8 flex items-end gap-1.5">{[18,34,24,52,38,68,42,82,56,34,74,45,62,28,48,76,39,58,30,66].map((height, index) => <span key={index} className="landing-wave" style={{ height: `${height}px` }} />)}</div><div className="mt-7 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[42%] rounded-full bg-[#F3EBDD]" /></div></div></div>
          <div className="landing-float-card"><Radio size={17} /><span><strong className="block text-sm">Live listening room</strong><small className="text-white/55">Conversation in progress</small></span><span className="landing-live-dot" /></div>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl gap-4 px-5 pb-16 sm:grid-cols-3 sm:px-8 lg:px-12 lg:pb-24">{highlights.map(({ icon: Icon, title, text }) => <article key={title} className="landing-highlight rounded-2xl p-5 sm:p-6"><Icon size={21} className="mb-8 text-primary-label/70" /><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-secondary-label">{text}</p></article>)}</section>
      <footer className="relative z-10 mx-auto flex w-full max-w-7xl flex-wrap justify-between gap-3 border-t border-primary-label/10 px-5 py-6 text-xs text-secondary-label sm:px-8 lg:px-12"><span>Starlight Station</span><span>Make room for what comes next.</span></footer>
    </main>
  );
}
