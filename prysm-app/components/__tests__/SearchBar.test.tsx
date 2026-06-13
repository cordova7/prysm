import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from '../SearchBar';

describe('SearchBar', () => {
  it('should render search input with placeholder', () => {
    const mockOnSearch = vi.fn();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search tokens...');
    expect(input).toBeInTheDocument();
  });

  it('should call onSearch with correct query when typing', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search tokens...');
    await user.type(input, 'ICP');

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(mockOnSearch).toHaveBeenCalledWith('ICP');
  });

  it('should show clear button when query is entered', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search tokens...');
    await user.type(input, 'ICP');

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 300));

    const clearButton = screen.getByRole('button');
    expect(clearButton).toBeInTheDocument();
  });

  it('should clear search when clear button is clicked', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search tokens...');
    await user.type(input, 'ICP');

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 300));

    const clearButton = screen.getByRole('button');
    await user.click(clearButton);

    // Wait for debounce after clearing
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(mockOnSearch).toHaveBeenLastCalledWith('');
  });

  it('should show search indicator when query is entered', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search tokens...');
    await user.type(input, 'ICP');

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(screen.getByText('Searching for:')).toBeInTheDocument();
    expect(screen.getByText('ICP')).toBeInTheDocument();
  });

  it('should update search indicator when query changes', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search tokens...');
    await user.type(input, 'IC');

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(screen.getByText('IC')).toBeInTheDocument();

    // Clear and type new query
    await user.clear(input);
    await user.type(input, 'ICP');

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(screen.getByText('Searching for:')).toBeInTheDocument();
    expect(screen.getByText('ICP')).toBeInTheDocument();
  });

  it('should focus input on click', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchBar onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search tokens...');
    await user.click(input);

    expect(document.activeElement).toBe(input);
  });

  it('should use custom placeholder', () => {
    const mockOnSearch = vi.fn();
    render(<SearchBar onSearch={mockOnSearch} placeholder="Custom placeholder..." />);

    expect(screen.getByPlaceholderText('Custom placeholder...')).toBeInTheDocument();
  });
});