/**
 * Token Relationship Panel
 * Elegant side panel that displays token relationships with animated visualizations
 * Features: SVG connection graphics, controller details, connection strength indicators
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiLink, FiCopy, FiExternalLink, FiTrendingUp } from 'react-icons/fi';
import { useInfiniteTokenRelationships } from '@/hooks/useInfiniteTokenRelationships';
import Portal from './Portal';

export default function TokenRelationshipPanel({
  token,
  isVisible,
  onClose,
  position = 'right', // 'right' or 'left'
  selectedController = null,
}) {
  const [copiedController, setCopiedController] = useState(null);
  const [filterController, setFilterController] = useState(null);
  const [showAllModal, setShowAllModal] = useState(false);
  const loadMoreRef = useRef(null);

  // Auto-filter to selected controller when panel opens
  useEffect(() => {
    if (isVisible && selectedController) {
      setFilterController(selectedController);
    }
  }, [isVisible, selectedController]);

  // Use infinite scroll for relationships
  const {
    relationships,
    isLoading,
    hasMore,
    loadMore,
    loadedCount,
    summary,
  } = useInfiniteTokenRelationships(
    token?.token_ledger_id || token?.id,
    {
      enabled: isVisible && !!token,
      batchSize: 50,
      skip: !isVisible, // Don't fetch until panel opens
    }
  );

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!isVisible || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible, hasMore, isLoading, loadMore]);

  const handleCopyController = async (controllerId) => {
    try {
      await navigator.clipboard.writeText(controllerId);
      setCopiedController(controllerId);
      setTimeout(() => setCopiedController(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const filteredRelationships = filterController
    ? relationships?.filter(rel =>
        rel.sharedControllers.includes(filterController)
      ) || []
    : relationships || [];

  const panelVariants = {
    hidden: {
      x: position === 'right' ? '100%' : '-100%',
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: 'easeInOut',
      },
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
      },
    },
  };

  const connectionLineVariants = {
    hidden: {
      pathLength: 0,
      opacity: 0,
    },
    visible: {
      pathLength: 1,
      opacity: 0.6,
      transition: {
        pathLength: {
          duration: 0.8,
          ease: 'easeInOut',
        },
        opacity: {
          duration: 0.3,
        },
      },
    },
  };

  const nodeVariants = {
    hidden: {
      scale: 0,
      opacity: 0,
    },
    visible: (index) => ({
      scale: 1,
      opacity: 1,
      transition: {
        delay: index * 0.05,
        duration: 0.3,
        ease: 'backOut',
      },
    }),
  };

  if (!token) return null;

  return (
    <Portal>
      <AnimatePresence>
        {isVisible && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-[#161614]/20 backdrop-blur-sm z-modal-backdrop"
              onClick={onClose}
            />

            {/* Panel */}
            <motion.div
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className={`fixed top-0 ${position === 'right' ? 'right-0' : 'left-0'} h-full w-96 bg-[#f6fdff] bg-[#2a2a27] shadow-2xl z-modal flex flex-col`}
            >
            {/* Header - Compact */}
            <div className="p-3 border-b border-[#2a2a27] dark:border-[#2a2a27]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-[#f6fdff] dark:text-[#f6fdff] flex items-center gap-2">
                  <FiLink className="w-4 h-4" />
                  Related Tokens
                </h3>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-[#2a2a27] dark:hover:bg-[#2a2a27] rounded-full transition-colors"
                >
                  <FiX className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Token Info - Compact */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#f6fdff] flex items-center justify-center text-[#161614] text-sm font-bold">
                  {token.symbol?.charAt(0) || 'T'}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[#f6fdff] dark:text-[#f6fdff]">{token.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{token.symbol}</p>
                </div>
              </div>

              {/* Selected Controller Info - Compact */}
              {selectedController && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-[#1c1c19] border border-[#2a2a27] rounded-lg p-2"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-gray-400 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-400">
                      Connections:
                    </p>
                  </div>
                  <p className="text-xs font-mono text-gray-400 dark:text-gray-400 mt-1 break-all">
                    {selectedController.slice(0, 12)}...{selectedController.slice(-8)}
                  </p>
                </motion.div>
              )}
            </div>

            {/* Summary Stats - Compact */}
            {isLoading && !relationships.length ? (
              <div className="p-2 bg-[#2a2a27] bg-[#2a2a27] border-b border-[#2a2a27] dark:border-[#2a2a27] animate-pulse">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="h-6 bg-[#2a2a27] bg-[#2a2a27] rounded mb-1" />
                    <div className="h-3 bg-[#2a2a27] bg-[#2a2a27] rounded" />
                  </div>
                  <div className="text-center">
                    <div className="h-6 bg-[#2a2a27] bg-[#2a2a27] rounded mb-1" />
                    <div className="h-3 bg-[#2a2a27] bg-[#2a2a27] rounded" />
                  </div>
                  <div className="text-center">
                    <div className="h-6 bg-[#2a2a27] bg-[#2a2a27] rounded mb-1" />
                    <div className="h-3 bg-[#2a2a27] bg-[#2a2a27] rounded" />
                  </div>
                </div>
              </div>
            ) : summary && (
              <div className="p-2 bg-[#2a2a27] bg-[#2a2a27] border-b border-[#2a2a27] dark:border-[#2a2a27]">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-400 dark:text-gray-400">
                      {summary.totalConnections}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Connections</div>
                    {summary.totalConnections > 10 && (
                      <button
                        onClick={() => setShowAllModal(true)}
                        className="text-xs text-gray-400 dark:text-gray-400 hover:underline mt-1"
                      >
                        Show all
                      </button>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-400 dark:text-gray-400">
                      {summary.uniqueControllers}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Controllers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-500 dark:text-green-500">
                      {summary.topController?.connectionCount || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Top Link</div>
                  </div>
                </div>
              </div>
            )}

            {/* Controller Filter - Compact */}
            {summary?.topController && (
              <div className="p-2 border-b border-[#2a2a27] dark:border-[#2a2a27]">
                <button
                  onClick={() => setFilterController(
                    filterController ? null : summary.topController.id
                  )}
                  className={`w-full p-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterController
                      ? 'bg-[#f6fdff] dark:bg-[#f6fdff] text-gray-400 dark:text-gray-400'
                      : 'bg-[#2a2a27] bg-[#2a2a27] text-gray-700 dark:text-[#f6fdff] hover:bg-[#2a2a27] dark:hover:bg-[#2a2a27]'
                  }`}
                >
                  {filterController ? 'Show All' : 'Filter'}
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#f6fdff]"></div>
                  <p className="mt-2 text-sm text-gray-500">Finding relationships...</p>
                </div>
              )}

              {error && (
                <div className="p-4 text-center text-red-500 dark:text-red-500">
                  <p className="font-medium">Failed to load relationships</p>
                  <p className="text-sm mt-1">{error.message}</p>
                </div>
              )}

              {relationshipData && filteredRelationships.length > 0 && (
                <div className="p-3">
                  {/* Mini Visualization - Preview of first 50 tokens */}
                  <div className="mb-4 h-40 bg-[#2a2a27] rounded-xl overflow-hidden border border-[#2a2a27] relative">
                    {/* Preview indicator */}
                    {filteredRelationships.length > 50 && (
                      <div className="absolute top-2 right-2 bg-[#161614]/60 text-[#f6fdff] text-xs px-2 py-1 rounded-full">
                        Showing 50 of {filteredRelationships.length}
                      </div>
                    )}

                    {/* Loading overlay for initial load */}
                    {isLoading && relationships.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#1c1c19]/80 bg-[#1c1c19]/80 backdrop-blur-sm z-10">
                        <div className="text-center">
                          <div className="w-12 h-12 border-4 border-[#f6fdff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                          <p className="text-gray-400 dark:text-gray-400 text-sm">
                            Loading relationships...
                          </p>
                          <p className="text-gray-400 text-xs mt-1">
                            This may take a moment for tokens with many connections
                          </p>
                        </div>
                      </div>
                    )}

                    <svg width="100%" height="100%" viewBox="0 0 384 160">
                      {/* Central node (target token) */}
                      <motion.circle
                        cx="192"
                        cy="80"
                        r="8"
                        fill="#3B82F6"
                        stroke="#fff"
                        strokeWidth="2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                      <text
                        x="192"
                        y="120"
                        textAnchor="middle"
                        className="text-xs font-medium fill-gray-400 dark:fill-gray-400"
                      >
                        {token.symbol}
                      </text>

                      {/* Connection lines and nodes - Show first 50 tokens for performance */}
                      {filteredRelationships.slice(0, 50).map((rel, index) => {
                        // Calculate position in a spiral pattern for better distribution
                        const angle = (index / 20) * Math.PI * 2;
                        const radius = 50 + (index % 5) * 8; // Vary radius for depth
                        const x = 192 + Math.cos(angle) * radius;
                        const y = 80 + Math.sin(angle) * radius;

                        // Opacity based on controller count
                        const opacity = 0.3 + (rel.controllerCount * 0.15);

                        return (
                          <g key={rel.tokenId}>
                            {/* Connection line */}
                            <motion.line
                              x1="192"
                              y1="80"
                              x2={x}
                              y2={y}
                              stroke="#94A3B8"
                              strokeWidth={rel.controllerCount > 1 ? 2 : 1}
                              strokeOpacity={opacity}
                              variants={connectionLineVariants}
                              initial="hidden"
                              animate="visible"
                              custom={index}
                            />
                            {/* Connected node */}
                            <motion.circle
                              cx={x}
                              cy={y}
                              r={3 + rel.controllerCount * 0.5}
                              fill={rel.controllerCount > 1 ? "#8B5CF6" : "#6366F1"}
                              fillOpacity={opacity}
                              variants={nodeVariants}
                              initial="hidden"
                              animate="visible"
                              custom={index}
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Connected Tokens List - Elegant & Spacious */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-semibold text-gray-700 dark:text-[#f6fdff]">
                        Connected Tokens
                      </h5>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-[#2a2a27] bg-[#2a2a27] px-2 py-1 rounded-full">
                        {loadedCount} of {summary?.totalConnections || 0}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {filteredRelationships.map((rel, index) => (
                        <motion.div
                          key={rel.tokenId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="p-3.5 rounded-xl border border-[#2a2a27] dark:border-[#2a2a27] hover:border-[#f6fdff] dark:hover:border-[#f6fdff] hover:shadow-md transition-all duration-200 bg-[#f6fdff] bg-[#1c1c19]/60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Token Identity */}
                              <div className="flex items-center gap-2.5 mb-2">
                                <div className="w-10 h-10 rounded-full bg-[#f6fdff] flex items-center justify-center text-[#161614] font-bold text-sm shadow-lg">
                                  {rel.symbol?.charAt(0) || 'T'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <h6 className="text-sm font-semibold text-[#f6fdff] dark:text-[#f6fdff] truncate">
                                      {rel.symbol}
                                    </h6>
                                    {rel.controllerCount > 1 && (
                                      <span className="px-2 py-0.5 text-xs rounded-full  bg-[#f6fdff] text-gray-400 dark:text-gray-400 font-medium">
                                        {rel.controllerCount}x connection
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{rel.name}</p>
                                </div>
                              </div>

                              {/* Price Info */}
                              {rel.price && (
                                <div className="ml-12 mb-2">
                                  <span className="text-sm font-medium text-gray-700 dark:text-[#f6fdff]">
                                    ${parseFloat(rel.price).toFixed(6)}
                                  </span>
                                  {rel.volume24h && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                      Vol: ${(rel.volume24h / 1000000).toFixed(2)}M
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Connection Strength Badge */}
                            <div className="text-right">
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#232320]">
                                <FiLink className="w-3 h-3 text-gray-400 dark:text-gray-400" />
                                <span className="text-xs font-medium text-gray-400 dark:text-gray-400">
                                  {rel.sharedControllers.length} {rel.sharedControllers.length === 1 ? 'link' : 'links'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Shared Controllers - Elegant Display */}
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#2a2a27]/50">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-gray-400 dark:text-gray-400">
                                Shared Controllers:
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {rel.sharedControllers.map(controllerId => (
                                <button
                                  key={controllerId}
                                  onClick={() => handleCopyController(controllerId)}
                                  className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2a2a27] bg-[#1c1c19]/60 hover:bg-[#232320] rounded-lg text-xs text-gray-400 dark:text-gray-400 hover:text-[#f6fdff] transition-all duration-150 border border-transparent hover:border-[#3a3a34]"
                                >
                                  <span className="font-mono font-medium">
                                    {controllerId.slice(0, 8)}...{controllerId.slice(-6)}
                                  </span>
                                  {copiedController === controllerId ? (
                                    <span className="text-green-500 text-xs font-bold">✓</span>
                                  ) : (
                                    <FiCopy className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Infinite scroll trigger */}
                    {hasMore && (
                      <div ref={loadMoreRef} className="py-8">
                        {isLoading && (
                          <div className="flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-8 h-8 border-4 border-[#f6fdff] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                              <p className="text-gray-400 text-sm">Loading more relationships...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* End indicator */}
                    {!hasMore && loadedCount > 0 && (
                      <div className="py-8 text-center text-gray-500 text-sm">
                        ✓ Showing all {loadedCount} relationships
                      </div>
                    )}
                  </div>
                </div>
              )}

              {relationships && filteredRelationships.length === 0 && (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <FiLink className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No relationships found</p>
                  <p className="text-sm mt-1">
                    {filterController
                      ? 'No tokens share this controller'
                      : 'This token has unique controllers'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Show All Modal */}
      <AnimatePresence>
        {showAllModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#161614]/75 backdrop-blur-sm"
            onClick={() => setShowAllModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#f6fdff] bg-[#2a2a27] rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-[#2a2a27] dark:border-[#2a2a27]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#2a2a27] dark:border-[#2a2a27]">
                <div>
                  <h2 className="text-2xl font-bold text-[#f6fdff] dark:text-[#f6fdff]">
                    All Connections
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {loadedCount} of {summary?.totalConnections || 0} connections
                  </p>
                </div>
                <button
                  onClick={() => setShowAllModal(false)}
                  className="p-2 hover:bg-[#2a2a27] dark:hover:bg-[#2a2a27] rounded-full transition-colors"
                >
                  <FiX className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Modal Content - Use same data source */}
              <div className="flex-1 overflow-auto p-6">
                <div className="grid grid-cols-1 gap-3">
                  {relationships?.map((rel, index) => (
                    <div
                      key={rel.tokenId}
                      className="flex items-center justify-between p-4 bg-[#2a2a27] bg-[#1c1c19]/60 rounded-xl hover:bg-[#2a2a27] dark:hover:bg-[#2a2a27] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#f6fdff] flex items-center justify-center text-[#161614] font-bold">
                          {rel.symbol?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-[#f6fdff] dark:text-[#f6fdff]">
                            {rel.name || 'Unknown Token'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {rel.symbol} • {rel.tokenId.slice(0, 12)}...
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#f6fdff] dark:text-[#f6fdff]">
                          {rel.controllerCount} shared controllers
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {rel.tokenId.slice(0, 12)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
