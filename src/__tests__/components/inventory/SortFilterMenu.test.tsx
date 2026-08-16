import { render, screen, fireEvent } from '@testing-library/react';
import SortFilterMenu, { DEFAULT_INVENTORY_FILTERS } from '@/components/inventory/SortFilterMenu';

describe('SortFilterMenu', () => {
  it('marks the current sort option as checked', () => {
    render(
      <SortFilterMenu
        sortBy="expiration"
        onSortByChange={jest.fn()}
        filters={DEFAULT_INVENTORY_FILTERS}
        onFiltersChange={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Expiration')).toBeChecked();
    expect(screen.getByLabelText('Name (A–Z)')).not.toBeChecked();
    expect(screen.getByLabelText('Date added (newest first)')).not.toBeChecked();
  });

  it('reports the selected sort option', () => {
    const onSortByChange = jest.fn();
    render(
      <SortFilterMenu
        sortBy="name"
        onSortByChange={onSortByChange}
        filters={DEFAULT_INVENTORY_FILTERS}
        onFiltersChange={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Date added (newest first)'));

    expect(onSortByChange).toHaveBeenCalledWith('dateAdded');
  });

  it('toggles the partially eaten filter', () => {
    const onFiltersChange = jest.fn();
    render(
      <SortFilterMenu
        sortBy="name"
        onSortByChange={jest.fn()}
        filters={DEFAULT_INVENTORY_FILTERS}
        onFiltersChange={onFiltersChange}
        onClose={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Partially eaten'));

    expect(onFiltersChange).toHaveBeenCalledWith({ partiallyEaten: true });
  });

  it('resets filters to the default via "Clear filter", and disables that button when already at the default', () => {
    const onFiltersChange = jest.fn();
    const { rerender } = render(
      <SortFilterMenu
        sortBy="name"
        onSortByChange={jest.fn()}
        filters={{ partiallyEaten: true }}
        onFiltersChange={onFiltersChange}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Clear filter')).toBeEnabled();
    fireEvent.click(screen.getByText('Clear filter'));
    expect(onFiltersChange).toHaveBeenCalledWith(DEFAULT_INVENTORY_FILTERS);

    rerender(
      <SortFilterMenu
        sortBy="name"
        onSortByChange={jest.fn()}
        filters={DEFAULT_INVENTORY_FILTERS}
        onFiltersChange={onFiltersChange}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Clear filter')).toBeDisabled();
  });

  it('closes via the close button and via clicking the backdrop, but not via clicking the sheet itself', () => {
    const onClose = jest.fn();
    render(
      <SortFilterMenu
        sortBy="name"
        onSortByChange={jest.fn()}
        filters={DEFAULT_INVENTORY_FILTERS}
        onFiltersChange={jest.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('Sort & filter'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
