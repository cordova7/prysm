'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import TransactionListModal from '@/components/TransactionListModal';
import { useTokenTransactions } from '@/hooks/useTokenTransactions';

export default function TransactionDemo() {
  // MCS token has known transactions
  const mcsToken = {
    tokenLedgerId: '67mu5-maaaa-aaaar-qadca-cai',
    symbol: 'MCS',
    name: 'Magic Conch Shell',
  };

  const { activity, isLoading, error } = useTokenTransactions(mcsToken.tokenLedgerId, {
    limit: 10,
    refreshInterval: 60000,
  });

  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#161614] text-[#f6fdff]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-thin mb-4">
            ICPSwap Transaction Demo
          </h1>
          <p className="text-gray-400 text-lg">
            Real transaction data fetched directly from ICPSwap canisters
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1c1c19] rounded-2xl border border-[#2a2a27] p-8 mb-8"
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-[#f6fdff] rounded-lg flex items-center justify-center text-2xl font-light">
                  {mcsToken.symbol.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-light">{mcsToken.name}</h2>
                  <p className="text-gray-400">{mcsToken.symbol}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-2">
                {mcsToken.tokenLedgerId}
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              disabled={!activity || !activity.hasActivity}
              className={`px-6 py-3 rounded-xl font-light transition-all ${
                activity && activity.hasActivity
                  ? 'bg-[#f6fdff] hover:bg-[#f6fdff] text-[#161614]'
                  : 'bg-[#232320] text-gray-500 cursor-not-allowed'
              }`}
            >
              View Transactions
            </button>
          </div>

          {/* Activity Summary */}
          <div className="bg-[#232320] rounded-xl p-6 border border-[#2a2a27]">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              Activity Summary
            </h3>

            {isLoading ? (
              <div className="space-y-3">
                <div className="h-4 bg-[#2a2a27] rounded animate-pulse" />
                <div className="h-4 bg-[#2a2a27] rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-[#2a2a27] rounded w-1/2 animate-pulse" />
              </div>
            ) : error ? (
              <div className="text-red-400 text-sm">
                Error: {error}
              </div>
            ) : activity && activity.hasActivity ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-400">Transactions</p>
                    <p className="text-2xl font-light mt-1">{activity.transactionCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Total Volume</p>
                    <p className="text-2xl font-light mt-1">{activity.formattedVolume}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Types</p>
                    <p className="text-2xl font-light mt-1">
                      {Object.keys(activity.transactionTypes || {}).length}
                    </p>
                  </div>
                </div>

                {activity.transactionTypes && Object.keys(activity.transactionTypes).length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Transaction Types:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(activity.transactionTypes).map(([type, count]) => (
                        <span
                          key={type}
                          className="text-xs px-3 py-1 bg-[#2a2a27] rounded-full text-gray-300"
                        >
                          {type}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activity.latestTimestamp && (
                  <p className="text-xs text-gray-500 mt-4">
                    Latest: {new Date(Number(activity.latestTimestamp) * 1000).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-500 text-sm">No recent activity found</p>
            )}
          </div>

          {/* Transaction Preview */}
          {activity && activity.transactions && activity.transactions.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                Recent Transactions
              </h3>
              <div className="space-y-2">
                {activity.transactions.slice(0, 3).map((tx, idx) => (
                  <div
                    key={idx}
                    className="bg-[#232320] rounded-lg p-4 border border-[#2a2a27] flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-medium px-2 py-1 bg-[#232320] text-gray-300 rounded">
                        {tx.action}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(Number(tx.timestamp) * 1000).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[#f6fdff]">${Number(tx.amountUSD || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">
                        {tx.token0Symbol} ↔ {tx.token1Symbol}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Technical Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#1c1c19] rounded-2xl border border-[#2a2a27] p-8"
        >
          <h3 className="text-xl font-light mb-4">How It Works</h3>
          <div className="space-y-4 text-gray-400">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#f6fdff] flex items-center justify-center text-[#161614] text-sm font-medium flex-shrink-0 mt-0.5">
                1
              </div>
              <div>
                <p className="text-[#f6fdff] font-medium">Query BaseIndex</p>
                <p className="text-sm">Fetch list of BaseStorage canisters (64 found)</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#f6fdff] flex items-center justify-center text-[#161614] text-sm font-medium flex-shrink-0 mt-0.5">
                2
              </div>
              <div>
                <p className="text-[#f6fdff] font-medium">Query NodeIndex</p>
                <p className="text-sm">Get TokenStorage canister for token ID</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#f6fdff] flex items-center justify-center text-[#161614] text-sm font-medium flex-shrink-0 mt-0.5">
                3
              </div>
              <div>
                <p className="text-[#f6fdff] font-medium">Fetch Transactions</p>
                <p className="text-sm">Call getTokenTransactions on TokenStorage</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-[#f6fdff] text-sm font-medium flex-shrink-0 mt-0.5">
                4
              </div>
              <div>
                <p className="text-[#f6fdff] font-medium">Display & Cache</p>
                <p className="text-sm">Format data and display in UI with 5min cache</p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-[#1c1c19] border border-[#2a2a27] rounded-lg">
            <p className="text-sm text-gray-400">
              <strong>Note:</strong> Not all tokens have transactions on ICPSwap. This demo uses the MCS token
              which has 10 recorded transactions (4 Swaps, 1 Add Liquidity).
            </p>
          </div>
        </motion.div>

        {/* Transaction Modal */}
        <TransactionListModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          token={mcsToken}
          transactions={activity?.transactions || []}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
