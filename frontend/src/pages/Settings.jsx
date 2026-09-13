import { useState } from 'react';
import { Archive, ArrowLeft, Bookmark, CreditCard, LogOut, Shield, Trash2, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Settings({ user, onLogout }) {
  const navigate = useNavigate();
  const [action, setAction] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountUsername, setAccountUsername] = useState(user?.username || '');
  const [accountSaving, setAccountSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const confirmAction = async () => {
    const isDelete = action === 'delete';
    const url = isDelete ? `${apiUrl}/api/users/${user.id}` : `${apiUrl}/api/auth/${user.id}/deactivate`;
    try {
      const res = await fetch(url, { method: isDelete ? 'DELETE' : 'POST' });
      if (!res.ok) throw new Error('Could not complete this request.');
      setFeedback(isDelete ? 'Account deleted successfully.' : 'Account deactivated successfully.');
      setAction(null);
      setTimeout(onLogout, 700);
    } catch (error) {
      setAction(null);
      setFeedback(error.message || 'Could not complete this request.');
    }
  };
  const saveAccountUsername = async (event) => {
    event.preventDefault();
    if (!accountUsername.trim() || accountSaving) return;
    setAccountSaving(true);
    try {
      const response = await fetch(`${apiUrl}/api/auth/${user.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: user.name, username: accountUsername.trim(), bio: user.bio || '' }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update username.');
      setAccountUsername(data.user?.username || accountUsername.trim());
      setFeedback('Username updated successfully.');
    } catch (error) {
      setFeedback(error.message || 'Could not update username.');
    } finally {
      setAccountSaving(false);
    }
  };
  const menuItems = [
    { label: 'Account', icon: UserRound, onClick: () => setAccountMenuOpen(true) },
    { label: 'Privacy', icon: Shield, onClick: () => setFeedback('Privacy settings are coming soon.') },
    { label: 'Subscription', icon: CreditCard, onClick: () => setFeedback('Subscription settings are coming soon.') },
    { label: 'Archives', icon: Archive, onClick: () => setFeedback('Archives are coming soon.') },
    { label: 'Saved', icon: Bookmark, onClick: () => navigate('/saved') },
  ];
  return <div className="min-h-screen bg-primary-background px-5 pb-20 text-primary-label sm:px-8"><header className="mx-auto flex max-w-2xl items-center justify-between py-4"><Link to="/library" className="grid h-10 w-10 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link><h1 className="font-display text-base font-bold tracking-wider text-primary-label">sEtTiNgS</h1><span className="w-10" /></header><main className="mx-auto max-w-2xl py-8"><h1 className="font-display text-3xl font-bold tracking-wider text-primary-label">{accountMenuOpen ? 'Account' : 'sEtTiNgS'}</h1><p className="mt-2 text-sm text-secondary-label">{accountMenuOpen ? 'Manage your account details and access.' : 'Manage your account and preferences.'}</p>{feedback && <p role="status" className="mt-4 rounded-xl bg-shading px-4 py-3 text-sm">{feedback}</p>}{accountMenuOpen ? <section className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-shading/30"><div className="space-y-4 px-5 py-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-secondary-label">Email</p><p className="mt-1 break-all text-sm font-semibold">{user?.email || 'Email unavailable'}</p></div><form onSubmit={saveAccountUsername} className="space-y-2"><label className="text-xs font-semibold uppercase tracking-wider text-secondary-label" htmlFor="account-username">Username</label><div className="flex flex-col gap-2 sm:flex-row"><input id="account-username" value={accountUsername} onChange={(event) => setAccountUsername(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-primary-background px-3 text-sm outline-none focus:border-primary-label/50" required /><button type="submit" disabled={accountSaving} className="h-11 rounded-xl bg-primary-label px-4 text-sm font-semibold text-primary-background disabled:opacity-50">{accountSaving ? 'Saving...' : 'Save username'}</button></div></form></div><button onClick={() => setFeedback('Password change is available from the secure account flow.')} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold transition-colors hover:bg-highlight">Change your password</button><button onClick={() => setAction('deactivate')} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold text-amber-400 hover:bg-amber-500/10"><Trash2 className="h-5 w-5" />Deactivate account</button><button onClick={() => setAction('delete')} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold text-red-400 hover:bg-red-500/10"><Trash2 className="h-5 w-5" />Delete account</button><button onClick={() => setAccountMenuOpen(false)} className="px-5 py-4 text-left text-sm font-semibold text-secondary-label hover:text-primary-label">Back to settings</button></section> : <section className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-shading/30">{menuItems.map(({ label, icon: Icon, onClick }) => <button key={label} onClick={onClick} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold transition-colors hover:bg-highlight"><Icon className="h-5 w-5" />{label}</button>)}<button onClick={onLogout} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold transition-colors hover:bg-highlight"><LogOut className="h-5 w-5" />Log out</button></section>}</main><ConfirmModal isOpen={Boolean(action)} onClose={() => setAction(null)} onConfirm={confirmAction} title={action === 'delete' ? 'Delete account?' : 'Deactivate account?'} message={action === 'delete' ? 'This permanently removes your account and associated data.' : 'Your account will be temporarily deactivated until you return.'} confirmText={action === 'delete' ? 'Delete account' : 'Deactivate'} /></div>;
}
