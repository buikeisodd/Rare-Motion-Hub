import { Monitor } from 'lucide-react';
import StarlightLogo from '../components/StarlightLogo';

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
