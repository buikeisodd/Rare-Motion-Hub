import { useEffect, useState } from 'react';
import { ArrowLeft, Bookmark, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import StarlightLogo from '../components/StarlightLogo';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Saved() {
  const [items, setItems] = useState([]);
  useEffect(() => { fetch(apiUrl + '/api/feed').then((res) => res.json()).then((data) => setItems((data.items || []).filter((item) => item.savedByMe))); }, []);
  return <div className="min-h-screen bg-primary-background px-4 pb-20 text-primary-label sm:px-8"><header className="mx-auto flex max-w-3xl items-center justify-between py-4"><Link to="/feed" className="grid h-10 w-10 place-items-center rounded-full bg-shading hover:bg-highlight" aria-label="Back to feed"><ArrowLeft className="h-5 w-5" /></Link><h1 className="text-base font-bold tracking-tight text-[#F7F4EC]">Saved</h1><Bookmark className="h-5 w-5 text-secondary-label" /></header><main className="mx-auto max-w-3xl py-8"><h1 className="text-3xl font-semibold">Saved</h1><p className="mt-2 text-sm text-secondary-label">Your saved previews.</p>{items.length === 0 ? <p className="py-16 text-center text-sm text-secondary-label">No saved previews yet.</p> : <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map((item) => <Link key={item.id} to="/feed" className="group relative aspect-square overflow-hidden rounded-xl bg-highlight">{item.project?.coverArt && <img src={item.project.coverArt} alt="" className="h-full w-full object-cover" />}<div className="absolute inset-0 grid place-items-center bg-black/20 group-hover:bg-black/45"><Play className="h-8 w-8 fill-white text-white opacity-0 group-hover:opacity-100" /></div><span className="absolute bottom-2 left-2 right-2 truncate text-xs font-semibold text-white">{item.title}</span></Link>)}</div>}</main></div>;
}
