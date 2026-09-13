import { useState } from 'react';
import { ArrowLeft, Upload, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Marketplace({ user }) {
  const [form, setForm] = useState({ title: '', price: '', licenseType: 'lease' });
  const [beat, setBeat] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!beat || !agreement) return setStatus('Add both the beat and agreement certification.');
    setSaving(true);
    setStatus('');
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    body.append('beat', beat);
    body.append('agreement', agreement);
    try {
      const response = await fetch(`${apiUrl}/api/marketplace/beats`, { method: 'POST', credentials: 'include', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not publish beat.');
      setStatus('Beat listed successfully.');
      setForm({ title: '', price: '', licenseType: 'lease' });
      setBeat(null);
      setAgreement(null);
    } catch (error) {
      setStatus(error.message || 'Could not publish beat.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="min-h-screen bg-primary-background px-4 pb-24 text-primary-label sm:px-8">
    <header className="mx-auto flex max-w-5xl items-center justify-between py-5">
      <Link to="/feed" className="grid h-10 w-10 place-items-center rounded-2xl bg-shading hover:bg-highlight" aria-label="Back to feed"><ArrowLeft className="h-5 w-5" /></Link>
      <h1 className="font-display text-xl font-bold tracking-wider">mArKeTpLaCe</h1>
      <Store className="h-6 w-6 text-accent" />
    </header>
    <main className="mx-auto grid max-w-5xl gap-8 py-8 lg:grid-cols-[1fr_22rem]">
      <section><h2 className="text-4xl font-bold tracking-tight">Find the next sound.</h2><p className="mt-2 max-w-xl text-secondary-label">Buy beats from independent creators with clear licensing and downloadable agreements.</p><div className="mt-8 rounded-3xl border border-border bg-shading/40 p-6"><p className="text-sm text-secondary-label">Marketplace listings will appear here as creators publish beats.</p></div></section>
      <form onSubmit={submit} className="rounded-3xl border border-border bg-shading/50 p-5 shadow-xl">
        <h2 className="text-lg font-bold">List a beat</h2>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">Beat title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none" /></label>
          <label className="grid gap-2 text-sm font-semibold">Price<input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none" /></label>
          <label className="grid gap-2 text-sm font-semibold">License<select value={form.licenseType} onChange={(e) => setForm({ ...form, licenseType: e.target.value })} className="h-11 rounded-xl border border-border bg-primary-background px-3 outline-none"><option value="lease">For lease</option><option value="exclusive">Exclusive</option></select></label>
          <label className="grid gap-2 text-sm font-semibold">Beat file<input type="file" accept="audio/*" onChange={(e) => setBeat(e.target.files?.[0] || null)} required className="block w-full text-xs" /></label>
          <label className="grid gap-2 text-sm font-semibold">Agreement certification<input type="file" accept="application/pdf,.pdf" onChange={(e) => setAgreement(e.target.files?.[0] || null)} required className="block w-full text-xs" /></label>
          {status && <p role="status" className="text-sm text-secondary-label">{status}</p>}
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-label px-4 text-sm font-semibold text-primary-background disabled:opacity-50"><Upload className="h-4 w-4" />{saving ? 'Publishing...' : 'Publish beat'}</button>
        </div>
      </form>
    </main>
  </div>;
}
