import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterControls, { type FilterState } from '../FilterControls';

describe('FilterControls', () => {
  it('should render filter controls', () => {
    const mockOnFilterChange = vi.fn();
    render(<FilterControls onFilterChange={mockOnFilterChange} />);

    expect(screen.getByText('Filters:')).toBeInTheDocument();
    expect(screen.getByText('NEW TOKENS')).toBeInTheDocument();
    expect(screen.getByText('Sort:')).toBeInTheDocument();
  });

  it('should toggle NEW TOKENS filter when clicked', () => {
    const mockOnFilterChange = vi.fn();
    render(<FilterControls onFilterChange={mockOnFilterChange} />);

    const newTokensButton = screen.getByText('NEW TOKENS');
    fireEvent.click(newTokensButton);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      showNewOnly: true,
      sortBy: 'icId',
      sortOrder: 'desc',
    });
  });

  it('should change sort option when selected', () => {
    const mockOnFilterChange = vi.fn();
    render(<FilterControls onFilterChange={mockOnFilterChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'price' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      showNewOnly: false,
      sortBy: 'price',
      sortOrder: 'desc',
    });
  });

  it('should toggle sort order when sort button is clicked', () => {
    const mockOnFilterChange = vi.fn();
    render(<FilterControls onFilterChange={mockOnFilterChange} />);

    const sortButton = screen.getByText('↓');
    fireEvent.click(sortButton);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      showNewOnly: false,
      sortBy: 'icId',
      sortOrder: 'asc',
    });
  });

  it('should show clear button when filters are active', () => {
    const mockOnFilterChange = vi.fn();
    const { rerender } = render(<FilterControls onFilterChange={mockOnFilterChange} />);

    expect(screen.queryByText('Clear')).not.toBeInTheDocument();

    // Activate new tokens filter
    fireEvent.click(screen.getByText('NEW TOKENS'));
    const newFilters = {
      showNewOnly: true,
      sortBy: 'icId',
      sortOrder: 'desc',
    };

    rerender(<FilterControls onFilterChange={mockOnFilterChange} />);

    // Now Clear button should be visible
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('should clear all filters when clear button is clicked', () => {
    const mockOnFilterChange = vi.fn();
    render(<FilterControls onFilterChange={mockOnFilterChange} />);

    // Activate new tokens filter
    fireEvent.click(screen.getByText('NEW TOKENS'));

    // Click clear button
    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      showNewOnly: false,
      sortBy: 'icId',
      sortOrder: 'desc',
    });
  });

  it('should show status text when new tokens filter is active', () => {
    const mockOnFilterChange = vi.fn();
    render(<FilterControls onFilterChange={mockOnFilterChange} />);

    expect(screen.queryByText('Showing new tokens only')).not.toBeInTheDocument();

    // Activate new tokens filter
    fireEvent.click(screen.getByText('NEW TOKENS'));

    expect(screen.getByText('Showing new tokens only')).toBeInTheDocument();
  });

  it('should show status text when sort is not default', () => {
    const mockOnFilterChange = vi.fn();
    render(<FilterControls onFilterChange={mockOnFilterChange} />);

    // Change sort option
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'price' } });

    expect(screen.getByText('Sorted by price')).toBeInTheDocument();
  });
});