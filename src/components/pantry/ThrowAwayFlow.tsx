import { useState } from 'react';
import ThrowAwayPanel from '@/components/pantry/ThrowAwayPanel';

interface ThrowAwayFlowProps {
  uuid: string;
  item: PantryItem;
  onSaved: () => void;
}

// The item detail page's throw-away entry point: a FAB that opens
// ThrowAwayPanel. Records binning some of a pantry item — decrements
// `remaining` exactly like EatFlow does (clamped at zero, emptying it
// archives and deletes the item server-side), but nothing was eaten so there
// is no food-diary step — thrown-away food must never reach Google Health.
// The amount prefills with what's left, since the common case is binning the
// whole thing once it's expired.
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
        className="fab bottom-24 bg-secondary hover:bg-secondary/90 focus:ring-secondary/60"
      >
        <span className="text-2xl" aria-hidden="true">🗑</span>
      </button>

      {open && <ThrowAwayPanel uuid={uuid} item={item} onSaved={onSaved} onClose={() => setOpen(false)} />}
    </>
  );
}
