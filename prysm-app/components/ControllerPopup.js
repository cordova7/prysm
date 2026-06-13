/**
 * Controller Popup - Steve Jobs Design Philosophy
 * Elegant, simple, and powerful controller information display
 * Features: Hover on desktop, tap on mobile, future-proof for new data
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';
import TokenDetailModal from './TokenDetailModal';
import { useTokenLogo } from '@/hooks/useTokenLogo';

const RelatedTokenRow = ({ token, onSelect }) => {
  const { logo, isLoading } = useTokenLogo(token?.tokenId);
  const fallback = token?.symbol?.charAt(0) || 'T';

  return (
    <motion.div
      whileHover={{ x: 2, backgroundColor: 'rgba(31, 41, 55, 0.8)' }}
      className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all group"
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {logo && !isLoading ? (
            <img
              src={logo}
              alt={token?.symbol || 'Token'}
              className="w-6 h-6 rounded-full object-cover border border-[#2a2a27]"
            />
          ) : (
            <div className="w-6 h-6 bg-[#232320] rounded-full flex items-center justify-center text-[#f6fdff] text-xs font-bold border border-[#2a2a27]">
              {fallback}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-[#f6fdff] truncate">{token?.symbol}</p>
            <p className="text-xs text-gray-400 truncate">{token?.name}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <p className="text-xs text-gray-300">${token?.price?.toFixed(6) || '0.000000'}</p>
        <FiArrowRight className="w-3 h-3 text-gray-500 group-hover:text-gray-300" />
      </div>
    </motion.div>
  );
};

export default function ControllerPopup({
  controller,
  token,
  hasRelationships,
  position = 'top',
  children,
}) {
  const normalizedController = String(controller || '').trim();
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [controllerName, setControllerName] = useState(null);
  const [controllerNameLoaded, setControllerNameLoaded] = useState(false);
  const [relationshipsLoaded, setRelationshipsLoaded] = useState(false);
  const [relatedTokens, setRelatedTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const popupRef = useRef(null);
  const timeoutRef = useRef(null);
  const triggerRef = useRef(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setControllerName(null);
    setControllerNameLoaded(false);
    setRelatedTokens([]);
    setRelationshipsLoaded(false);
  }, [normalizedController, token?.tokenLedgerId]);

  // Fetch canister name and relationships from IC API
  useEffect(() => {
    let isMounted = true;

    async function fetchControllerData() {
      setLoading(true);
      try {
        const relationshipsPromise = (!relationshipsLoaded && token?.tokenLedgerId)
          ? fetch(`/api/relationships/${token.tokenLedgerId}?limit=all`)
              .then(async (relResponse) => {
                if (!relResponse.ok) return;
                const relData = await relResponse.json();
                if (isMounted && relData.relationships) {
                  const filtered = relData.relationships.filter((rel) =>
                    Array.isArray(rel.sharedControllers) &&
                    rel.sharedControllers.some((id) => String(id).trim() === normalizedController)
                  );
                  const effective =
                    filtered.length === 0 && token?.controllers?.length === 1
                      ? relData.relationships
                      : filtered;
                  const sorted = [...effective].sort((a, b) => {
                    const aIcId = a?.icId ?? a?.ic_id ?? -1;
                    const bIcId = b?.icId ?? b?.ic_id ?? -1;
                    if (aIcId !== bIcId) return bIcId - aIcId;
                    const aKey = a?.tokenId ?? a?.tokenLedgerId ?? '';
                    const bKey = b?.tokenId ?? b?.tokenLedgerId ?? '';
                    return String(aKey).localeCompare(String(bKey));
                  });
                  setRelatedTokens(sorted);
                }
              })
              .catch((error) => {
                if (error?.name !== 'AbortError') {
                  console.warn('Relationships lookup failed, continuing:', error);
                }
              })
              .finally(() => {
                if (isMounted) setRelationshipsLoaded(true);
              })
          : Promise.resolve().then(() => {
              if (isMounted) setRelationshipsLoaded(true);
            });

        const controllerNamePromise = (!controllerNameLoaded && normalizedController)
          ? (async () => {
              const abortController = new AbortController();
              const timeoutId = setTimeout(() => abortController.abort(), 3000);
              try {
                const response = await fetch(`/api/ic-api?path=canisters/${normalizedController}`, {
                  signal: abortController.signal,
                });
                if (response.ok) {
                  const data = await response.json();
                  if (isMounted) {
                    setControllerName(data.name || null);
                  }
                }
              } catch (error) {
                if (error?.name !== 'AbortError') {
                  console.warn('Controller name lookup failed, continuing:', error);
                }
              } finally {
                clearTimeout(timeoutId);
                if (isMounted) setControllerNameLoaded(true);
              }
            })()
          : Promise.resolve().then(() => {
              if (isMounted) setControllerNameLoaded(true);
            });

        await Promise.allSettled([relationshipsPromise, controllerNamePromise]);
      } catch (error) {
        console.error('Failed to fetch controller info:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (isVisible && (!controllerNameLoaded || !relationshipsLoaded)) {
      fetchControllerData();
    }

    return () => {
      isMounted = false;
    };
  }, [isVisible, controllerNameLoaded, relationshipsLoaded, normalizedController, token?.tokenLedgerId]);

  const scheduleClose = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 250);
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(true);
    updatePopupPosition();
  };

  const handleMouseLeave = (e) => {
    const nextTarget = e?.relatedTarget;
    if (popupRef.current && nextTarget && popupRef.current.contains(nextTarget)) {
      return;
    }
    scheduleClose();
  };

  const handleModalMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleModalMouseLeave = (e) => {
    const nextTarget = e?.relatedTarget;
    if (triggerRef.current && nextTarget && triggerRef.current.contains(nextTarget)) {
      return;
    }
    scheduleClose();
  };

  const updatePopupPosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16;
    const gap = 8;

    const popupRect = popupRef.current?.getBoundingClientRect?.();
    const popupWidth = popupRect?.width ?? 480;
    const popupHeight = popupRect?.height ?? Math.min(400, viewportHeight * 0.8);

    let adjustedX = triggerRect.left;
    let adjustedY = triggerRect.bottom + gap;

    // If it would go off-screen, try above the trigger instead.
    if (adjustedY + popupHeight > viewportHeight - margin) {
      adjustedY = triggerRect.top - popupHeight - gap;
    }

    const maxX = Math.max(margin, viewportWidth - popupWidth - margin);
    const maxY = Math.max(margin, viewportHeight - popupHeight - margin);
    adjustedX = Math.min(Math.max(adjustedX, margin), maxX);
    adjustedY = Math.min(Math.max(adjustedY, margin), maxY);

    setPopupPosition({ x: adjustedX, y: adjustedY });
  };

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsVisible(!isVisible);
    if (!isVisible) {
      updatePopupPosition();
    }
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(controller);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Update position on window resize or scroll
  useEffect(() => {
    if (!isVisible) return;

    const frame = requestAnimationFrame(() => updatePopupPosition());

    const handleResize = () => {
      updatePopupPosition();
    };

    const handleScroll = () => {
      updatePopupPosition();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isVisible]);

  const isDenseList = relatedTokens.length > 12;

  return (
    <div
      ref={triggerRef}
      className="relative inline-block w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        display: 'inline-block',
        width: '100%',
      }}
    >
      {children}

      <AnimatePresence>
        {isVisible && (
          <>
            {/* Backdrop for mobile tap */}
            <div className="fixed inset-0 z-40 md:hidden" onClick={() => setIsVisible(false)} />

            <motion.div
              ref={popupRef}
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="fixed z-[99999] pointer-events-none"
              style={{
                left: `${popupPosition.x}px`,
                top: `${popupPosition.y}px`,
              }}
            >
              <div
                className="bg-[#1c1c19] border border-[#2a2a27] rounded-xl shadow-2xl w-[480px] max-w-[calc(100vw-2rem)] max-h-[80vh] flex flex-col pointer-events-auto"
                onMouseEnter={handleModalMouseEnter}
                onMouseLeave={handleModalMouseLeave}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-[#2a2a27] flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-light text-[#f6fdff]">{controllerName || 'Controller'}</h3>
                    <p
                      className="text-sm text-gray-400 mt-1 font-mono cursor-pointer select-all hover:text-gray-300 transition-colors"
                      onClick={handleCopy}
                    >
                      {controller}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsVisible(false);
                    }}
                    className="text-gray-400 hover:text-[#f6fdff] transition-colors p-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {relatedTokens.length > 0 && (
                  <div className="p-4 border-b border-[#2a2a27]">
                    <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center justify-between">
                      <span>Connected Tokens ({relatedTokens.length})</span>
                      <span className="text-xs text-gray-500">Scroll for more</span>
                    </h4>
                    <div
                      className={`max-h-[400px] overflow-y-auto pr-2 custom-scrollbar ${
                        isDenseList ? 'grid grid-cols-1 sm:grid-cols-2 gap-1' : 'space-y-1'
                      }`}
                    >
                      {relatedTokens.map((t) => (
                        <RelatedTokenRow
                          key={t.tokenId}
                          token={t}
                          onSelect={(e) => {
                            e.stopPropagation();
                            setIsVisible(false);
                            setSelectedToken(t);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {relatedTokens.length === 0 && !loading && (
                  <div className="p-4 border-b border-[#2a2a27]">
                    <p className="text-sm text-gray-400">No relationships found</p>
                  </div>
                )}

                {loading && (
                  <div className="p-4 border-b border-[#2a2a27]">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
                      <p className="text-sm text-gray-400">Loading...</p>
                    </div>
                  </div>
                )}

                <div className="px-4 pb-3">
                  {copied && (
                    <p className="text-xs text-green-400 text-center animate-fade-in">✓ Copied to clipboard</p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {selectedToken && <TokenDetailModal token={selectedToken} onClose={() => setSelectedToken(null)} />}
    </div>
  );
}
