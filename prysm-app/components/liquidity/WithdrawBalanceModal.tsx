/**
 * Withdraw Balance Modal Component
 * Allows users to withdraw unused deposits from a pool
 */
'use client';

import { useState, useEffect } from 'react';
import { usePositions } from '@/hooks/usePositions';
import { useWithdraw } from '@/hooks/useWithdraw';

interface WithdrawBalanceModalProps {
  poolId: string;
  token0Address: string;
  token1Address: string;
  token0Symbol?: string;
  token1Symbol?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function WithdrawBalanceModal({
  poolId,
  token0Address,
  token1Address,
  token0Symbol = 'Token 0',
  token1Symbol = 'Token 1',
  onClose,
  onSuccess,
}: WithdrawBalanceModalProps) {
  const { getUserUnusedBalance, isLoading: isLoadingBalance } = usePositions();
  const { withdraw, isWithdrawing, error: withdrawError } = useWithdraw();

  const [balances, setBalances] = useState<{ balance0: bigint; balance1: bigint } | null>(null);
  const [selectedToken, setSelectedToken] = useState<'token0' | 'token1'>('token0');
  const [amount, setAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Load unused balances
  useEffect(() => {
    const loadBalances = async () => {
      try {
        const result = await getUserUnusedBalance(poolId);
        setBalances(result);
      } catch (err) {
        console.error('Failed to load balances:', err);
      }
    };

    loadBalances();
  }, [poolId, getUserUnusedBalance]);

  const formatAmount = (amount: bigint, decimals: number = 8): string => {
    const base = 10n ** BigInt(decimals);
    const whole = amount / base;
    const frac = amount % base;

    if (frac === 0n) {
      return whole.toString();
    }

    const fracStr = frac.toString().padStart(decimals, '0');
    const trimmed = fracStr.replace(/0+$/, '');

    return `${whole.toString()}.${trimmed}`;
  };

  const parseAmount = (value: string, decimals: number = 8): bigint | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

    const [whole, frac = ''] = trimmed.split('.');
    const paddedFrac = (frac + '0'.repeat(decimals)).slice(0, decimals);
    const base = 10n ** BigInt(decimals);

    return BigInt(whole) * base + BigInt(paddedFrac || '0');
  };

  const handleWithdraw = async () => {
    if (!balances || !amount) return;

    const amountBigInt = parseAmount(amount, 8);
    if (!amountBigInt) {
      alert('Invalid amount');
      return;
    }

    const tokenAddress = selectedToken === 'token0' ? token0Address : token1Address;
    const availableBalance = selectedToken === 'token0' ? balances.balance0 : balances.balance1;

    if (amountBigInt > availableBalance) {
      alert('Amount exceeds available balance');
      return;
    }

    try {
      const fee = 10000n; // Default fee (adjust as needed)

      // Call router withdraw (routes through PRYSM router for fee collection)
      await withdraw(poolId, tokenAddress, amountBigInt, fee);

      setShowSuccess(true);
      setAmount('');

      // Reload balances
      const newBalances = await getUserUnusedBalance(poolId);
      setBalances(newBalances);

      onSuccess?.();

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Withdrawal failed:', err);
    }
  };

  const handleMaxClick = () => {
    if (!balances) return;

    const balance = selectedToken === 'token0' ? balances.balance0 : balances.balance1;
    setAmount(formatAmount(balance, 8));
  };

  const hasBalance = balances && (balances.balance0 > 0n || balances.balance1 > 0n);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Withdraw Balance</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Loading State */}
        {isLoadingBalance && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-600">Loading balances...</p>
          </div>
        )}

        {/* No Balance */}
        {!isLoadingBalance && balances && !hasBalance && (
          <div className="text-center py-8">
            <p className="text-gray-600">No unused balance to withdraw</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Withdraw Form */}
        {!isLoadingBalance && hasBalance && (
          <div className="space-y-4">
            {/* Available Balances */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Available Balances:</p>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-gray-600">{token0Symbol}:</span>{' '}
                  <span className="font-medium">{formatAmount(balances.balance0)}</span>
                </p>
                <p>
                  <span className="text-gray-600">{token1Symbol}:</span>{' '}
                  <span className="font-medium">{formatAmount(balances.balance1)}</span>
                </p>
              </div>
            </div>

            {/* Token Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Token</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedToken('token0')}
                  disabled={balances.balance0 === 0n}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedToken === 'token0'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {token0Symbol}
                </button>
                <button
                  onClick={() => setSelectedToken('token1')}
                  disabled={balances.balance1 === 0n}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedToken === 'token1'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {token1Symbol}
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleMaxClick}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Withdraw Button */}
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !amount}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isWithdrawing ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Withdrawing...</span>
                </>
              ) : (
                'Withdraw'
              )}
            </button>

            {/* Success Message */}
            {showSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">Withdrawal successful!</p>
              </div>
            )}

            {/* Error Message */}
            {withdrawError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800">Withdrawal failed</p>
                <p className="text-xs text-red-700 mt-1">{withdrawError.message}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
