import { useState } from 'react';
import { Archive, ArrowLeft, Bookmark, CreditCard, LogOut, Shield, Trash2, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Settings({ user, onLogout }) {
  const navigate = useNavigate();
  const [action, setAction] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
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
  const menuItems = [
    { label: 'Account', icon: UserRound, onClick: () => setAccountMenuOpen(true) },
    { label: 'Privacy', icon: Shield, onClick: () => setFeedback('Privacy settings are coming soon.') },
    { label: 'Subscription', icon: CreditCard, onClick: () => setFeedback('Subscription settings are coming soon.') },
    { label: 'Archives', icon: Archive, onClick: () => setFeedback('Archives are coming soon.') },
    { label: 'Saved', icon: Bookmark, onClick: () => navigate('/saved') },
  ];
  return <div className="min-h-screen bg-primary-background px-5 pb-20 text-primary-label sm:px-8"><header className="mx-auto flex max-w-2xl items-center justify-between py-4"><Link to="/library" className="grid h-10 w-10 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link><h1 className="font-display text-base font-bold tracking-wider text-primary-label">sEtTiNgS</h1><span className="w-10" /></header><main className="mx-auto max-w-2xl py-8"><h1 className="font-display text-3xl font-bold tracking-wider text-primary-label">{accountMenuOpen ? 'Account' : 'sEtTiNgS'}</h1><p className="mt-2 text-sm text-secondary-label">{accountMenuOpen ? 'Manage your account details and access.' : 'Manage your account and preferences.'}</p>{feedback && <p role="status" className="mt-4 rounded-xl bg-shading px-4 py-3 text-sm">{feedback}</p>}{accountMenuOpen ? <section className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-shading/30"><button onClick={() => navigate(`/profile/${user.id}`)} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold transition-colors hover:bg-highlight"><UserRound className="h-5 w-5" />Account information</button><button onClick={() => setFeedback('Password change is available from the secure account flow.')} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold transition-colors hover:bg-highlight">Change your password</button><button onClick={() => setAction('deactivate')} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold text-amber-400 hover:bg-amber-500/10"><Trash2 className="h-5 w-5" />Deactivate account</button><button onClick={() => setAction('delete')} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold text-red-400 hover:bg-red-500/10"><Trash2 className="h-5 w-5" />Delete account</button><button onClick={() => setAccountMenuOpen(false)} className="px-5 py-4 text-left text-sm font-semibold text-secondary-label hover:text-primary-label">Back to settings</button></section> : <section className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-shading/30">{menuItems.map(({ label, icon: Icon, onClick }) => <button key={label} onClick={onClick} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold transition-colors hover:bg-highlight"><Icon className="h-5 w-5" />{label}</button>)}<button onClick={onLogout} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold transition-colors hover:bg-highlight"><LogOut className="h-5 w-5" />Log out</button><button onClick={() => setAction('deactivate')} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold text-amber-400 hover:bg-amber-500/10"><Trash2 className="h-5 w-5" />Temporarily deactivate account</button><button onClick={() => setAction('delete')} className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold text-red-400 hover:bg-red-500/10"><Trash2 className="h-5 w-5" />Permanently delete account</button></section>}</main><ConfirmModal isOpen={Boolean(action)} onClose={() => setAction(null)} onConfirm={confirmAction} title={action === 'delete' ? 'Delete account?' : 'Deactivate account?'} message={action === 'delete' ? 'This permanently removes your account and associated data.' : 'Your account will be temporarily deactivated until you return.'} confirmText={action === 'delete' ? 'Delete account' : 'Deactivate'} /></div>;
}
