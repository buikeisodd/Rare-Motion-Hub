import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ShareLinkModal({ isOpen, onClose, type, targetId, userId }) {
  const [expiration, setExpiration] = useState('never');
  const [shareLink, setShareLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const expirationOptions = [
    { label: '1 Day', value: '1_day', ms: 24 * 60 * 60 * 1000 },
    { label: '1 Week', value: '1_week', ms: 7 * 24 * 60 * 60 * 1000 },
    { label: '1 Month', value: '1_month', ms: 30 * 24 * 60 * 60 * 1000 },
    { label: 'Never Expires', value: 'never', ms: null }
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setShareLink('');
    setCopied(false);

    try {
      const selectedOption = expirationOptions.find(opt => opt.value === expiration);
      const res = await fetch(`${apiUrl}/api/share/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          targetId,
          userId,
          expiresInMs: selectedOption.ms
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to generate link');

      const fullLink = `${window.location.origin}/shared/link/${data.token}`;
      setShareLink(fullLink);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setShareLink('');
    setExpiration('never');
    setCopied(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-md rounded-2xl border border-border panel-bg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary-label">Share {type === 'folder' ? 'Folder' : 'Project'}</h2>
              <button onClick={handleClose} className="rounded-full p-1 text-secondary-label transition-colors hover:bg-highlight hover:text-primary-label">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <label className="text-sm font-semibold text-secondary-label">Link Expiration</label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {expirationOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setExpiration(opt.value)}
                    className={`rounded-xl border p-2 text-sm font-medium transition-colors ${
                      expiration === opt.value
                        ? 'border-primary-label bg-primary-label text-primary-background'
                        : 'border-border bg-shading text-secondary-label hover:bg-highlight hover:text-primary-label'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {!shareLink ? (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full rounded-xl bg-primary-label py-3 text-base font-semibold text-primary-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : 'Generate Share Link'}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-shading p-2">
                  <input
                    type="text"
                    readOnly
                    value={shareLink}
                    className="flex-1 bg-transparent px-2 text-sm text-primary-label outline-none"
                  />
                  <button
                    onClick={handleCopy}
                    className={`flex items-center justify-center rounded-lg p-2 transition-colors ${
                      copied ? 'bg-green-500 text-white' : 'bg-highlight text-primary-label hover:bg-border'
                    }`}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
