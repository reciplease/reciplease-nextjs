import { useState } from 'react';
import ThrowAwayPanel from '@/components/inventory/ThrowAwayPanel';

interface ThrowAwayFlowProps {
  uuid: string;
  item: InventoryItem;
  onSaved: () => void;
}

// The item detail page's throw-away entry point: a FAB that opens
// ThrowAwayPanel. Records binning some of an inventory item — decrements
// `remaining` exactly like EatFlow does (clamped at zero, item never
// deleted), but nothing was eaten so there is no food-diary step —
// thrown-away food must never reach Google Health. The amount prefills with
// what's left, since the common case is binning the whole thing once it's
// expired.
export default function ThrowAwayFlow({ uuid, item, onSaved }: ThrowAwayFlowProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Sits directly above EatFlow's FAB (bottom-6 + 14 height + a gap). */}
      <button
        type="button"
        aria-label="Throw away"
        title="Throw away"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-[max(1rem,calc(50vw_-_40ch))] z-50 flex h-14 w-14 items-center justify-center rounded-full border-0 bg-secondary leading-none text-white shadow-lg transition transition-transform hover:scale-110 hover:bg-secondary/90 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-2 focus:ring-secondary/60 focus:ring-offset-2"
      >
        <span className="text-2xl" aria-hidden="true">🗑</span>
      </button>

      {open && <ThrowAwayPanel uuid={uuid} item={item} onSaved={onSaved} onClose={() => setOpen(false)} />}
    </>
  );
}
