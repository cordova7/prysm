import { useTokenHolders } from '@/hooks/useTokenHolders';
import React from 'react';
import { PrincipalTransactionsTooltip } from './PrincipalTransactionsTooltip';

const formatNumber = (num) => {
  if (num === undefined || num === null || num === '') return '0';

  // Handle string representations of numbers
  let value;
  if (typeof num === 'string') {
    if (num === '') return '0';
    value = parseFloat(num);
  } else if (typeof num === 'number') {
    value = num;
  } else if (typeof num === 'bigint') {
    value = Number(num);
  } else {
    value = Number(num);
  }

  if (isNaN(value) || !isFinite(value)) return '0';
  if (value === 0) return '0';

  // Handle very large numbers
  if (Math.abs(value) >= 1e12) return (value / 1e12).toFixed(2) + 'T';
  if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(2) + 'K';

  // Format with commas and appropriate decimal places for smaller numbers
  if (Math.abs(value) >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } else {
    // For very small numbers, show more precision
    return value.toFixed(6);
  }
};

const formatPercentage = (bps) => {
  if (bps === undefined || bps === null) return '0.00%';
  const percentage = (Number(bps) / 10000).toFixed(4);
  return `${percentage}%`;
};

const formatAddress = (address, maxLength = 12) => {
  if (!address) return 'N/A';
  if (address.length <= maxLength) return address;
  return `${address.substring(0, Math.floor(maxLength / 2))}...${address.substring(address.length - Math.floor(maxLength / 2))}`;
};

export function TokenHoldersTable({ tokenId, tokenSymbol }) {
  const { holders, loading, error } = useTokenHolders(tokenId);
  const symbolLabel = (tokenSymbol && tokenSymbol.trim()) ? tokenSymbol.trim() : 'TOKEN';

  if (loading) {
    return (
      <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg p-4">
        <div className="animate-pulse flex flex-col space-y-3">
          <div className="h-4 bg-[#2a2a27] rounded w-1/4"></div>
          <div className="h-3 bg-[#2a2a27] rounded w-full"></div>
          <div className="h-3 bg-[#2a2a27] rounded w-5/6"></div>
          <div className="h-3 bg-[#2a2a27] rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    // Check if it's a permission error and provide a more user-friendly message
    if (error.includes('permission denied') || error.includes('403')) {
      return (
        <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg p-4">
          <p className="text-yellow-400 text-sm">Token holder data not available</p>
          <p className="text-gray-500 text-xs mt-1">Data may not be indexed yet or access restricted</p>
        </div>
      );
    }

    return (
      <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg p-4">
        <p className="text-red-400 text-sm">Error loading holders data: {error}</p>
      </div>
    );
  }

  if (!holders || holders.length === 0) {
    return (
      <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg p-4">
        <p className="text-gray-400 text-sm">No holder data available</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a2a27] bg-[#161614]">
        <h3 className="text-xs font-mono text-[#f6fdff] uppercase">Top Holders</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#2a2a27]">
          <thead className="bg-[#161614]">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-[8px] font-mono text-gray-500 uppercase tracking-wider">#</th>
              <th scope="col" className="px-3 py-2 text-left text-[8px] font-mono text-gray-500 uppercase tracking-wider">Address</th>
              <th scope="col" className="px-3 py-2 text-right text-[8px] font-mono text-gray-500 uppercase tracking-wider">{symbolLabel} Balance</th>
              <th scope="col" className="px-3 py-2 text-right text-[8px] font-mono text-gray-500 uppercase tracking-wider">% Holding</th>
              <th scope="col" className="px-3 py-2 text-right text-[8px] font-mono text-gray-500 uppercase tracking-wider">ICP Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2a27]">
            {holders.map((holder, index) => (
              <tr key={holder.ownerPrincipal} className="hover:bg-[#232320] transition-colors">
                <td className="px-3 py-2 whitespace-nowrap text-[10px] font-mono text-gray-300">
                  {index + 1}
                </td>
                <td className="px-3 py-2 text-[10px] font-mono text-gray-300 max-w-[120px]">
                  <PrincipalTransactionsTooltip principalId={holder.ownerPrincipal}>
                    <div className="truncate hover:text-[#f6fdff] transition-colors" title={holder.ownerPrincipal}>
                      {formatAddress(holder.ownerPrincipal, 16)}
                    </div>
                  </PrincipalTransactionsTooltip>
                  {holder.clusterLabel && (
                    <span className="text-[8px] text-gray-500 ml-1">({holder.clusterLabel})</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[10px] font-mono text-right text-[#f6fdff]">
                  {holder.balanceFormatted ? formatNumber(holder.balanceFormatted) : '0'}
                </td>
                <td className="px-3 py-2 text-[10px] font-mono text-right text-[#f6fdff]">
                  {holder.percentage ? `${holder.percentage}%` : '0.00%'}
                </td>
                <td className="px-3 py-2 text-[10px] font-mono text-right text-[#f6fdff]">
                  {holder.icpBalance !== undefined && holder.icpBalance !== null
                    ? formatNumber(holder.icpBalance) + ' ICP'
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
