import type { ReactNode } from 'react';

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  zIndex?: string;
}

// Bottom-sheet modal: a backdrop that closes on click and a sheet that stops
// propagation so its own controls don't dismiss it. The app's sheets (pantry
// sort/filter, eat, throw away) share this shell and differ only in title and
// content; a caller that must paint above fixed siblings (e.g. a FAB) passes
// an explicit zIndex.
export default function BottomSheet({ title, onClose, children, zIndex = 'z-50' }: BottomSheetProps) {
  return (
    <div className={`fixed inset-0 ${zIndex} flex items-end justify-center bg-black/50`} onClick={onClose}>
      <div
        className="w-full max-w-[80ch] rounded-t-lg border-2 border-secondary bg-black p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-lg font-semibold">{title}</h4>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}