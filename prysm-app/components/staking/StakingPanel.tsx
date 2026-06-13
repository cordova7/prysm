/**
 * Staking panel component
 * Allows users to stake/unstake PRY on tokens to earn fees
 */
'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useStaking } from '@/hooks/useStaking';
import { RewardDisplay } from './RewardDisplay';

interface Token {
  ledger_id: string;
  name: string;
  symbol: string;
}

interface StakingPanelProps {
  token: Token;
  className?: string;
}

export function StakingPanel({ token, className = '' }: StakingPanelProps) {
  const { isConnected } = useWallet();
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    userStake,
    userStats,
    tokenBucket,
    isLoadingStake,
    isLoadingStats,
    isLoadingBucket,
    stake,
    unstake,
    claimRewards,
    isStaking,
    isUnstaking,
    isClaiming,
    error,
  } = useStaking({
    tokenId: token.ledger_id,
    enabled: isConnected,
  });

  const formatAmount = (amount: bigint, decimals: number = 8): string => {
    const divisor = BigInt(10 ** decimals);
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmed = fractionalStr.replace(/0+$/, '');
    if (trimmed === '') {
      return wholePart.toString();
    }
    return `${wholePart}.${trimmed}`;
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleStake = async () => {
    if (!stakeAmount || isNaN(parseFloat(stakeAmount))) return;
    try {
      const amount = BigInt(Math.floor(parseFloat(stakeAmount) * 100000000));
      await stake(amount);
      setStakeAmount('');
      setSuccessMessage(`Successfully staked ${stakeAmount} PRY!`);
    } catch (err) {
      console.error('Stake failed:', err);
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || isNaN(parseFloat(unstakeAmount))) return;
    try {
      const amount = BigInt(Math.floor(parseFloat(unstakeAmount) * 100000000));
      await unstake(amount);
      setUnstakeAmount('');
      setSuccessMessage(`Successfully unstaked ${unstakeAmount} PRY!`);
    } catch (err) {
      console.error('Unstake failed:', err);
    }
  };

  const handleClaim = async () => {
    try {
      const claimed = await claimRewards();
      const formattedAmount = formatAmount(claimed);
      setSuccessMessage(`Claimed ${formattedAmount} PRY!`);
    } catch (err) {
      console.error('Claim failed:', err);
    }
  };

  const calculateAPY = (): string => {
    if (!tokenBucket || tokenBucket.total_staked === 0n) {
      return 'N/A';
    }
    return tokenBucket.total_fees_collected > 0n ? '~5-20%' : 'TBD';
  };

  if (!isConnected) {
    return (
      <div className={`bg-[var(--color-bg-secondary)] rounded-xl p-4 ${className}`}>
        <p className="text-sm text-[var(--color-text-secondary)] text-center">
          Connect your wallet to stake PRY and earn fees
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-[var(--color-bg-secondary)] rounded-xl p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-bold text-[var(--color-text)]">Stake & Earn</h4>
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-secondary)]">Estimated APY</p>
          <p className="text-sm font-medium text-green-400">{calculateAPY()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-3">
          <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
            Your Stake
          </p>
          {isLoadingStake ? (
            <div className="h-6 bg-[var(--color-bg-card)] rounded animate-pulse"></div>
          ) : (
            <p className="text-lg font-bold text-[var(--color-text)]">
              {userStake ? formatAmount(userStake.amount) : '0'} PRY
            </p>
          )}
        </div>

        <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-3">
          <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
            Total Staked
          </p>
          {isLoadingBucket ? (
            <div className="h-6 bg-[var(--color-bg-card)] rounded animate-pulse"></div>
          ) : (
            <p className="text-lg font-bold text-[var(--color-text)]">
              {tokenBucket ? formatAmount(tokenBucket.total_staked) : '0'} PRY
            </p>
          )}
        </div>
      </div>

      <RewardDisplay
        stats={userStats}
        isLoading={isLoadingStats}
        onClaim={handleClaim}
        isClaiming={isClaiming}
      />

      <div className="flex gap-2 bg-[var(--color-bg-tertiary)] p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('stake')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            activeTab === 'stake'
              ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          Stake
        </button>
        <button
          onClick={() => setActiveTab('unstake')}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
            activeTab === 'unstake'
              ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          Unstake
        </button>
      </div>

      {activeTab === 'stake' && (
        <div className="space-y-3">
          <div>
            <label className="text-sm text-[var(--color-text-secondary)] mb-2 block">
              Amount to Stake
            </label>
            <input
              type="text"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text)] text-lg px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <button
            onClick={handleStake}
            disabled={!stakeAmount || isStaking}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-bg-card)] disabled:text-[var(--color-text-muted)] text-[var(--color-on-primary)] font-bold py-3 rounded-lg transition-colors"
          >
            {isStaking ? 'Staking...' : 'Stake PRY'}
          </button>
        </div>
      )}

      {activeTab === 'unstake' && (
        <div className="space-y-3">
          <div>
            <label className="text-sm text-[var(--color-text-secondary)] mb-2 block">
              Amount to Unstake
            </label>
            <input
              type="text"
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text)] text-lg px-4 py-3 rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <button
            onClick={handleUnstake}
            disabled={!unstakeAmount || isUnstaking || !userStake || userStake.amount === 0n}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-bg-card)] disabled:text-[var(--color-text-muted)] text-[var(--color-on-primary)] font-bold py-3 rounded-lg transition-colors"
          >
            {isUnstaking ? 'Unstaking...' : 'Unstake PRY'}
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
          <p className="text-sm text-green-400 text-center">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
          <p className="text-sm text-red-400">{error.message}</p>
        </div>
      )}

      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-3">
        <p className="text-xs text-[var(--color-text-secondary)]">
          Stake PRY on this token to earn a share of the 1% trading fees. Rewards are
          distributed proportionally based on your stake.
        </p>
      </div>
    </div>
  );
}
