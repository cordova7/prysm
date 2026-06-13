/**
 * Slippage tolerance selector
 */
'use client';

import { useState } from 'react';

interface SlippageSettingsProps {
  value: number; // in basis points (e.g., 50 = 0.5%)
  onChange: (value: number) => void;
  className?: string;
}

const PRESET_VALUES = [10, 50, 100]; // 0.1%, 0.5%, 1.0%

export function SlippageSettings({ value, onChange, className = '' }: SlippageSettingsProps) {
  const [isCustom, setIsCustom] = useState(!PRESET_VALUES.includes(value));
  const [customValue, setCustomValue] = useState(
    isCustom ? (value / 100).toFixed(2) : ''
  );

  const handlePresetClick = (preset: number) => {
    setIsCustom(false);
    onChange(preset);
  };

  const handleCustomChange = (input: string) => {
    setCustomValue(input);
    const parsed = parseFloat(input);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onChange(Math.floor(parsed * 100)); // Convert to basis points
    }
  };

  const formatBps = (bps: number) => {
    return (bps / 100).toFixed(1) + '%';
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">
          Slippage Tolerance
        </label>
        {value > 500 && (
          <span className="text-xs text-yellow-400">⚠ High slippage</span>
        )}
      </div>

      <div className="flex gap-2">
        {PRESET_VALUES.map((preset) => (
          <button
            key={preset}
            onClick={() => handlePresetClick(preset)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              !isCustom && value === preset
                ? 'bg-[#f6fdff] text-[#161614]'
                : 'bg-[#2a2a27] text-gray-300 hover:bg-[#3a3a34]'
            }`}
          >
            {formatBps(preset)}
          </button>
        ))}

        <div className="relative flex-1">
          <input
            type="text"
            value={isCustom ? customValue : ''}
            onChange={(e) => {
              setIsCustom(true);
              handleCustomChange(e.target.value);
            }}
            onFocus={() => setIsCustom(true)}
            placeholder="Custom"
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isCustom
                ? 'bg-[#f6fdff] text-[#161614] placeholder-gray-400'
                : 'bg-[#2a2a27] text-gray-300 placeholder-gray-500'
            } focus:outline-none focus:outline-none focus:border-[#f6fdff]`}
          />
          {isCustom && customValue && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              %
            </span>
          )}
        </div>
      </div>

      {isCustom && customValue && parseFloat(customValue) > 5 && (
        <p className="text-xs text-yellow-400">
          ⚠ Your transaction may be frontrun due to high slippage tolerance
        </p>
      )}
    </div>
  );
}
