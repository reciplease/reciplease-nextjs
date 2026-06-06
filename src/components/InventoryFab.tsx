import Fab from '@/components/Fab';

// FAB for the inventory section: launches the scanner flow.
export default function InventoryFab() {
  return <Fab href="/inventory/scan" label="Scan item" />;
}
