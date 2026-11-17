import { useEffect, useState } from 'react';
import { ArrowRight, Headphones, Layers3, Radio, MessageCircle, ShoppingBag, BarChart3, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import StarlightLogo from '../components/StarlightLogo';
import heroImage from '../assets/hero.png';

const highlights = [
  { icon: Layers3, title: 'Keep every version', text: 'Projects, folders, and the ideas between the first take and the finished sound.', image: heroImage, position: 'center' },
  { icon: Headphones, title: 'Listen in context', text: 'Play, compare, comment, and return to the exact version that made you stop and listen.', image: '/brand/rare-motion-mark.jpg', position: 'center' },
  { icon: Radio, title: 'Share the moment', text: 'Bring collaborators and listeners into the work through previews, stories, and live rooms.', image: heroImage, position: '70% center' },
  { icon: MessageCircle, title: 'Stay in the conversation', text: 'Chat with collaborators, reply to stories, and keep every useful reaction beside the work.', image: '/brand/rare-motion-mark.jpg', position: '35% center' },
  { icon: ShoppingBag, title: 'Find the next sound', text: 'Browse beats, songs, and samples in the marketplace, then save the sounds worth returning to.', image: heroImage, position: '25% center' },
  { icon: BarChart3, title: 'See the signal', text: 'Understand listens, engagement, and project momentum through focused insights.', image: '/brand/rare-motion-mark.jpg', position: '65% center' },
];

const landingQuotes = [
  'Make room for the next sound.',
  'Let the unfinished become something.',
  'Keep the idea moving.',
  'Hear what comes next.',
  'Give the work a place to grow.',
];

export default function Landing() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setQuoteIndex((current) => (current + 1) % landingQuotes.length), 4200);
    return () => window.clearInterval(timer);
  }, []);

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
          <h1 className="max-w-2xl text-[clamp(3.25rem,8vw,7.5rem)] font-semibold leading-[.9] tracking-[-.06em]"><span key={quoteIndex} className="inline-block animate-fade-in">{landingQuotes[quoteIndex]}</span></h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-secondary-label sm:text-lg sm:leading-8">Starlight Station gives your music a place to grow, with every version, conversation, and collaboration kept close.</p>
          <div className="mt-9 flex flex-wrap items-center gap-3"><Link to="/login?mode=register" className="landing-primary-action inline-flex min-h-12 items-center gap-2 rounded-xl px-5 py-3 font-semibold">Start creating <ArrowRight size={17} /></Link><Link to="/login" className="landing-secondary-action inline-flex min-h-12 items-center rounded-xl px-5 py-3 font-semibold">Sign in</Link></div>
          <p className="mt-5 text-xs text-secondary-label/75">Projects, playback, collaboration, and live rooms in one studio.</p>
        </div>

        <div className="landing-preview-wrap relative mx-auto w-full max-w-xl">
        <div className="landing-preview relative w-full">
          <div className="landing-preview-bar"><span /><span /><span /><p>your next idea</p></div>
          <div className="landing-preview-body"><div className="landing-preview-cover"><div className="landing-preview-orbit" /><Headphones size={34} /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.18em] text-white/55">Project workspace</p><h2 className="mt-2 truncate text-2xl font-semibold text-white sm:text-3xl">The unfinished takes</h2><p className="mt-2 text-sm text-white/55">4 versions · 12 comments · just now</p><div className="mt-8 flex items-end gap-1.5">{[18,34,24,52,38,68,42,82,56,34,74,45,62,28,48,76,39,58,30,66].map((height, index) => <span key={index} className="landing-wave" style={{ height: `${height}px` }} />)}</div><div className="mt-7 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[42%] rounded-full bg-[#F3EBDD]" /></div></div></div>
          <div className="landing-float-card"><Radio size={17} /><span><strong className="block text-sm">Live listening room</strong><small className="text-white/55">Conversation in progress</small></span><span className="landing-live-dot" /></div>
        </div>
        <div className="landing-orbit-card landing-orbit-one"><Heart size={15} /> <span>Story reaction</span></div>
        <div className="landing-orbit-card landing-orbit-two"><ShoppingBag size={15} /> <span>Marketplace saved</span></div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8 lg:px-12 lg:pb-24"><div className="mb-8 max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.22em] text-secondary-label">One station, many ways to move</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Everything around the idea, in one place.</h2></div><div className="landing-feature-grid">{highlights.map(({ icon: Icon, title, text, image, position }, index) => <article key={title} className={`landing-feature-card landing-feature-${index + 1}`}><div className="landing-feature-image"><img src={image} alt="" style={{ objectPosition: position }} /><div className="landing-feature-wash" /><span className="landing-feature-icon"><Icon size={19} /></span></div><div className="p-5 sm:p-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-secondary-label">{text}</p></div></article>)}</div></section>
      <footer className="relative z-10 mx-auto flex w-full max-w-7xl flex-wrap justify-between gap-3 border-t border-primary-label/10 px-5 py-6 text-xs text-secondary-label sm:px-8 lg:px-12"><span>Starlight Station</span><span>Make room for what comes next.</span></footer>
    </main>
  );
}
