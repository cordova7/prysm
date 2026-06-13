'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import { useWallet } from '@/contexts/WalletContext';
import { useTokens } from '@/hooks/useTokens';
import { usePortfolio } from '@/hooks/usePortfolio';
import { getAnonymousActor } from '@/lib/wallet/anonymous';
import { PRYSM_ROUTER_IDL } from '@/lib/wallet/actors';
import { Principal } from '@dfinity/principal';
import {
  addImportedToken,
  addImportedTokens,
  loadImportedTokens,
  removeImportedToken,
} from '@/lib/portfolio-store';
import { ICRC2_IDL } from '@/lib/wallet/actors';

const formatAmount = (amount, decimals) => {
  const divisor = 10n ** BigInt(decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  if (fractionalPart === 0n) return wholePart.toString();
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${wholePart.toString()}.${fractionalStr}`;
};

const formatTimestamp = (value) => {
  if (!value || value === 0n) return '—';
  const ms = Number(value / 1_000_000n);
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', { hour12: false });
};

function PortfolioRow({
  entry,
  pryDecimals,
  showUser,
  showPending,
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
      <div>
        <div className="text-sm text-[var(--color-text)]">{entry.symbol}</div>
        <div className="text-xs text-[var(--color-text-muted)]">{entry.name}</div>
      </div>
      <div className="text-right">
        <div className="text-sm text-[var(--color-text)]">
          {formatAmount(entry.balance, entry.decimals)}
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)]">Balance</div>
      </div>
      <div className="text-right">
        <div className="text-sm text-[var(--color-text-secondary)] flex items-center justify-end gap-1">
          <img src="/favicon-32x32.png" alt="PRY" className="w-3.5 h-3.5" />
          {formatAmount(entry.totalStaked, pryDecimals)}
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)]">Total staked</div>
      </div>
      {showUser && (
        <div className="text-right">
          <div className="text-sm text-[var(--color-text-secondary)] flex items-center justify-end gap-1">
            <img src="/favicon-32x32.png" alt="PRY" className="w-3 h-3" />
            {formatAmount(entry.userStaked, pryDecimals)} ({entry.userStakePercent.toFixed(2)}%)
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Your stake share</div>
        </div>
      )}
      {showPending && (
        <div className="text-right">
          <div className="text-sm text-[var(--color-text-secondary)] flex items-center justify-end gap-1">
            <img src="/favicon-32x32.png" alt="PRY" className="w-3 h-3" />
            {formatAmount(entry.pendingRewards, pryDecimals)}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Unclaimed rewards</div>
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const { principal, isConnected, getActor } = useWallet();
  const { data: tokens = [], isLoading: tokensLoading } = useTokens();
  const [activeTab, setActiveTab] = useState('holdings');
  const [activity, setActivity] = useState(null);
  const [promoRewards, setPromoRewards] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [importedIds, setImportedIds] = useState([]);
  const [importInput, setImportInput] = useState('');
  const [importError, setImportError] = useState(null);

  const principalText = principal?.toText() || null;
  const pryLedgerId = process.env.NEXT_PUBLIC_PRY_LEDGER_CANISTER_ID || '';
  const ICP_LEDGER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
  const [autoImportKey, setAutoImportKey] = useState('');

  useEffect(() => {
    setImportedIds(loadImportedTokens(principalText));
  }, [principalText]);

  useEffect(() => {
    const alwaysImport = [ICP_LEDGER_ID, pryLedgerId].filter(Boolean);
    if (alwaysImport.length === 0) return;
    addImportedTokens(alwaysImport, principalText);
    setImportedIds(loadImportedTokens(principalText));
  }, [principalText, pryLedgerId]);

  useEffect(() => {
    if (!isConnected || !principal || tokensLoading || tokens.length === 0) return;

    const nextKey = `${principalText || 'anonymous'}:${tokens.length}`;
    if (autoImportKey === nextKey) return;
    setAutoImportKey(nextKey);

    let cancelled = false;

    const runWithConcurrency = async (items, limit, worker) => {
      let index = 0;
      const runners = new Array(limit).fill(0).map(async () => {
        while (index < items.length) {
          const current = items[index++];
          await worker(current);
        }
      });
      await Promise.all(runners);
    };

    const autoImportBalances = async () => {
      const existing = new Set(loadImportedTokens(principalText));
      const candidates = tokens
        .map((token) => token?.tokenLedgerId)
        .filter((tokenId) => tokenId && !existing.has(tokenId));

      if (!candidates.length) return;

      const found = new Set();
      await runWithConcurrency(candidates, 6, async (tokenId) => {
        if (cancelled) return;
        try {
          const tokenActor = getAnonymousActor(tokenId, ICRC2_IDL);
          const balance = await tokenActor.icrc1_balance_of({
            owner: principal,
            subaccount: [],
          });
          if (balance > 0n) {
            found.add(tokenId);
          }
        } catch {
          // Ignore tokens that don't respond to ICRC calls.
        }
      });

      if (cancelled || found.size === 0) return;
      addImportedTokens([...found], principalText);
      if (!cancelled) {
        setImportedIds(loadImportedTokens(principalText));
      }
    };

    autoImportBalances();

    return () => {
      cancelled = true;
    };
  }, [isConnected, principal, tokens, tokensLoading, principalText, autoImportKey]);

  const tokenMap = useMemo(() => {
    const map = new Map();
    tokens.forEach((token) => {
      if (token?.tokenLedgerId) map.set(token.tokenLedgerId, token);
    });
    return map;
  }, [tokens]);

  const importedTokens = useMemo(() => {
    return importedIds
      .map((id) => {
        const meta = tokenMap.get(id);
        return {
          tokenLedgerId: id,
          symbol: meta?.symbol,
          name: meta?.name,
        };
      })
      .filter((entry) => entry.tokenLedgerId);
  }, [importedIds, tokenMap]);

  const { holdings, staked, isLoading, processed, total, pryDecimals } = usePortfolio(
    importedTokens,
    principal,
    isConnected
  );

  const holdingsTotal = useMemo(() => holdings.length, [holdings]);
  const stakedTotal = useMemo(
    () => staked.reduce((sum, entry) => sum + entry.totalStaked, 0n),
    [staked]
  );
  const userStakedTotal = useMemo(
    () => staked.reduce((sum, entry) => sum + entry.userStaked, 0n),
    [staked]
  );

  const loadActivity = useCallback(async () => {
    if (!principal) {
      setActivity(null);
      setPromoRewards(null);
      return;
    }

    const routerCanisterId = process.env.NEXT_PUBLIC_PRYSM_ROUTER_CANISTER_ID;
    if (!routerCanisterId) {
      setActivity(null);
      setPromoRewards(null);
      return;
    }

    setActivityLoading(true);
    try {
      const routerActor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
      const traderActivity = await routerActor.get_trader_activity(principal);
      setActivity(traderActivity.length ? traderActivity[0] : null);
    } catch {
      setActivity(null);
    }

    if (isConnected) {
      try {
        const actor = getAnonymousActor<any>(routerCanisterId, PRYSM_ROUTER_IDL);
        const rewards = await actor.get_user_promo_rewards(principal);
        setPromoRewards(rewards);
      } catch {
        setPromoRewards(null);
      }
    }

    setActivityLoading(false);
  }, [principal, isConnected, getActor]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const handleImport = useCallback(() => {
    if (!importInput.trim()) return;
    const candidate = importInput.trim();
    try {
      Principal.fromText(candidate);
    } catch {
      setImportError('Invalid canister ID');
      return;
    }

    addImportedToken(candidate, principalText);
    setImportedIds(loadImportedTokens(principalText));
    setImportInput('');
    setImportError(null);
  }, [importInput, principalText]);

  const handleRemove = useCallback(
    (tokenId) => {
      removeImportedToken(tokenId, principalText);
      setImportedIds(loadImportedTokens(principalText));
    },
    [principalText]
  );

  return (
    <div className="max-w-7xl mx-auto px-6">
      <Header />

      <div className="mt-6 mb-8 flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-thin text-[var(--color-text)]">Portfolio</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Holdings, staking share, and on-chain activity from the PRYSM Router canister.
          </p>
        </div>

        {!isConnected && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            Connect your wallet to see your balances and stake share.
          </div>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-4">
        <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
          Import tokens
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={importInput}
            onChange={(event) => setImportInput(event.target.value)}
            placeholder="Token canister ID"
            className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-text)]"
          />
          <button
            onClick={handleImport}
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
          >
            Add token
          </button>
        </div>
        {importError && (
          <div className="mt-2 text-xs text-red-400">{importError}</div>
        )}
        {importedIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[var(--color-text-secondary)]">
            {importedIds.map((tokenId) => (
              <button
                key={tokenId}
                onClick={() => handleRemove(tokenId)}
                className="flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-1 hover:border-[var(--color-text)] hover:text-[var(--color-text)]"
              >
                {tokenId}
                <span className="text-xs">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
          <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Tokens held</div>
          <div className="mt-2 text-xl text-[var(--color-text)]">{holdingsTotal}</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
          <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Total PRY staked</div>
          <div className="mt-2 text-xl text-[var(--color-text)] flex items-center gap-2">
            <img src="/favicon-32x32.png" alt="PRY" className="w-4 h-4" />
            {formatAmount(stakedTotal, pryDecimals)}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
          <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Your PRY staked</div>
          <div className="mt-2 text-xl text-[var(--color-text)] flex items-center gap-2">
            <img src="/favicon-32x32.png" alt="PRY" className="w-4 h-4" />
            {formatAmount(userStakedTotal, pryDecimals)}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {['holdings', 'staked', 'activity'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full border px-4 py-1 text-xs uppercase tracking-wider ${
              activeTab === tab
                ? 'border-[var(--color-text)] text-[var(--color-text)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'holdings' && (
        <div className="mt-6 space-y-3">
          {(tokensLoading || isLoading) && (
            <div className="text-xs text-[var(--color-text-muted)]">
              Scanning tokens {processed}/{total}
            </div>
          )}
          {holdings.length === 0 && !tokensLoading && !isLoading && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-6 text-[var(--color-text-muted)]">
              No holdings detected yet. Import tokens to start tracking balances.
            </div>
          )}
          {holdings.map((entry) => (
            <PortfolioRow
              key={entry.tokenId}
              entry={entry}
              pryDecimals={pryDecimals}
              showUser={isConnected}
            />
          ))}
        </div>
      )}

      {activeTab === 'staked' && (
        <div className="mt-6 space-y-3">
          <div className="text-xs text-[var(--color-text-muted)]">
            Rewards accrue from the 1% swap fee and are distributed pro-rata by the PRYSM Router canister.
          </div>
          {staked.length === 0 && !tokensLoading && !isLoading && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-6 text-[var(--color-text-muted)]">
              No staked PRY detected yet.
            </div>
          )}
          {staked.map((entry) => (
            <PortfolioRow
              key={entry.tokenId}
              entry={entry}
              pryDecimals={pryDecimals}
              showUser={isConnected && entry.userStaked > 0n}
              showPending={isConnected && entry.pendingRewards > 0n}
            />
          ))}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-4">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Router activity
            </div>
            {activityLoading ? (
              <div className="text-sm text-[var(--color-text-secondary)]">Loading activity...</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <div className="text-sm text-[var(--color-text)]">
                    {activity?.trade_count ?? 0n}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">Trades</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text)]">
                    {activity?.total_volume ? formatAmount(activity.total_volume, pryDecimals) : '0'}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">Volume (router units)</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text)]">
                    {activity?.last_trade ? formatTimestamp(activity.last_trade) : '—'}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">Last trade</div>
                </div>
              </div>
            )}
            <p className="mt-3 text-[10px] text-[var(--color-text-muted)]">
              Swap activity is reported directly by the PRYSM Router canister. Per-token swap history will appear once indexed.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-4">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Promo rewards
            </div>
            <div className="text-sm text-[var(--color-text)] flex items-center gap-2">
              <img src="/favicon-32x32.png" alt="PRY" className="w-4 h-4" />
              {promoRewards !== null ? formatAmount(promoRewards, pryDecimals) : '—'}
            </div>
            <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
              Rewards are distributed from the trader reward pool.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
