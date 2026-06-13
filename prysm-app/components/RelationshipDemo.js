/**
 * Relationship Visualization Demo Component
 * Demonstrates the token relationship system with sample data
 * Use this for testing and showcasing the feature
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiLink, FiDatabase, FiZap } from 'react-icons/fi';

// Sample tokens with shared controllers for demonstration
const SAMPLE_TOKENS = [
  {
    id: 'token-1',
    name: 'Alpha Token',
    symbol: 'ALPHA',
    controllers: ['ctrl-aaa', 'ctrl-bbb', 'ctrl-ccc'],
    price: 1.23,
    volume24h: 50000,
  },
  {
    id: 'token-2',
    name: 'Beta Token',
    symbol: 'BETA',
    controllers: ['ctrl-aaa', 'ctrl-ddd'],
    price: 0.87,
    volume24h: 35000,
  },
  {
    id: 'token-3',
    name: 'Gamma Token',
    symbol: 'GAMMA',
    controllers: ['ctrl-aaa', 'ctrl-bbb', 'ctrl-eee'],
    price: 2.45,
    volume24h: 75000,
  },
  {
    id: 'token-4',
    name: 'Delta Token',
    symbol: 'DELTA',
    controllers: ['ctrl-fff'],
    price: 0.56,
    volume24h: 12000,
  },
  {
    id: 'token-5',
    name: 'Epsilon Token',
    symbol: 'EPS',
    controllers: ['ctrl-bbb', 'ctrl-ccc'],
    price: 1.98,
    volume24h: 42000,
  },
];

export default function RelationshipDemo() {
  const [selectedToken, setSelectedToken] = useState(null);
  const [demoMode, setDemoMode] = useState('live'); // 'live' or 'static'

  const findConnections = (token) => {
    if (!token) return [];
    return SAMPLE_TOKENS.filter(
      (t) => t.id !== token.id && t.controllers.some((c) => token.controllers.includes(c))
    ).map((t) => ({
      ...t,
      sharedControllers: t.controllers.filter((c) => token.controllers.includes(c)),
      controllerCount: t.controllers.filter((c) => token.controllers.includes(c)).length,
    }));
  };

  const connections = selectedToken ? findConnections(selectedToken) : [];

  return (
    <div className="p-8 bg-gray-100 bg-[#2a2a27] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-[#f6fdff] dark:text-[#f6fdff] mb-2 flex items-center gap-3">
            <FiLink className="w-8 h-8 text-gray-400" />
            Token Relationship Visualization Demo
          </h1>
          <p className="text-gray-400 dark:text-gray-400">
            Hover over tokens to discover shared controller relationships
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-[#f6fdff] bg-[#2a2a27] p-6 rounded-lg shadow-lg"
          >
            <div className="flex items-center gap-3">
              <FiDatabase className="w-8 h-8 text-gray-400" />
              <div>
                <p className="text-2xl font-bold text-[#f6fdff] dark:text-[#f6fdff]">
                  {SAMPLE_TOKENS.length}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-400">Sample Tokens</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-[#f6fdff] bg-[#2a2a27] p-6 rounded-lg shadow-lg"
          >
            <div className="flex items-center gap-3">
              <FiLink className="w-8 h-8 text-gray-400" />
              <div>
                <p className="text-2xl font-bold text-[#f6fdff] dark:text-[#f6fdff]">
                  {connections.length}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-400">Current Connections</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-[#f6fdff] bg-[#2a2a27] p-6 rounded-lg shadow-lg"
          >
            <div className="flex items-center gap-3">
              <FiZap className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-[#f6fdff] dark:text-[#f6fdff]">
                  < 100ms
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-400">Avg Response Time</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Token List */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#f6fdff] bg-[#2a2a27] rounded-lg shadow-lg p-6"
          >
            <h2 className="text-xl font-semibold text-[#f6fdff] dark:text-[#f6fdff] mb-4">
              Available Tokens
            </h2>
            <div className="space-y-3">
              {SAMPLE_TOKENS.map((token, index) => (
                <motion.div
                  key={token.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  onMouseEnter={() => setSelectedToken(token)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedToken?.id === token.id
                      ? 'border-[#2a2a27] bg-[#1c1c19]'
                      : 'border-gray-200 dark:border-[#2a2a27] hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#f6fdff] flex items-center justify-center text-[#161614] font-bold">
                        {token.symbol.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-medium text-[#f6fdff] dark:text-[#f6fdff]">
                          {token.name}
                        </h3>
                        <p className="text-sm text-gray-500">{token.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#f6fdff] dark:text-[#f6fdff]">
                        ${token.price}
                      </p>
                      <p className="text-xs text-gray-500">
                        {token.controllers.length} controller{token.controllers.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {token.controllers.slice(0, 3).map((ctrl) => (
                      <span
                        key={ctrl}
                        className="px-2 py-1 text-xs font-mono bg-gray-100 bg-[#2a2a27] text-gray-400 dark:text-gray-400 rounded"
                      >
                        {ctrl}
                      </span>
                    ))}
                    {token.controllers.length > 3 && (
                      <span className="px-2 py-1 text-xs text-gray-500">
                        +{token.controllers.length - 3}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Relationship Visualization */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#f6fdff] bg-[#2a2a27] rounded-lg shadow-lg p-6"
          >
            <h2 className="text-xl font-semibold text-[#f6fdff] dark:text-[#f6fdff] mb-4">
              Relationship Graph
            </h2>

            {!selectedToken ? (
              <div className="h-96 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FiLink className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Hover over a token to see relationships</p>
                </div>
              </div>
            ) : (
              <div>
                {/* Mini Graph */}
                <div className="h-64 bg-gray-50 bg-[#2a2a27] rounded-lg mb-6 overflow-hidden">
                  <svg width="100%" height="100%" viewBox="0 0 400 256">
                    {/* Central node */}
                    <motion.circle
                      cx="200"
                      cy="128"
                      r="12"
                      fill="#3B82F6"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                    <text
                      x="200"
                      y="128"
                      textAnchor="middle"
                      dy="5"
                      className="fill-white text-xs font-bold"
                    >
                      {selectedToken.symbol}
                    </text>

                    {/* Connection nodes */}
                    {connections.slice(0, 6).map((conn, index) => {
                      const angle = (index / 6) * Math.PI * 2;
                      const radius = 80;
                      const x = 200 + Math.cos(angle) * radius;
                      const y = 128 + Math.sin(angle) * radius;

                      return (
                        <g key={conn.id}>
                          <motion.line
                            x1="200"
                            y1="128"
                            x2={x}
                            y2={y}
                            stroke="#94A3B8"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 0.6 }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                          />
                          <motion.circle
                            cx={x}
                            cy={y}
                            r="8"
                            fill="#8B5CF6"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: index * 0.1 + 0.3, duration: 0.3 }}
                          />
                          <text
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dy="4"
                            className="fill-white text-xs font-bold"
                          >
                            {conn.symbol.charAt(0)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Connection List */}
                <div className="space-y-3">
                  <h3 className="font-medium text-[#f6fdff] dark:text-[#f6fdff]">
                    Connected Tokens ({connections.length})
                  </h3>
                  {connections.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      No connections found
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {connections.map((conn, index) => (
                        <motion.div
                          key={conn.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-3 bg-gray-50 bg-[#2a2a27] rounded-lg"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#f6fdff] flex items-center justify-center text-[#161614] text-xs font-bold">
                                {conn.symbol.charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-medium text-[#f6fdff] dark:text-[#f6fdff] text-sm">
                                  {conn.name}
                                </h4>
                                <p className="text-xs text-gray-500">{conn.symbol}</p>
                              </div>
                            </div>
                            {conn.controllerCount > 1 && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-[#232320] text-[#f6fdff]">
                                {conn.controllerCount}x
                              </span>
                            )}
                          </div>
                          <div className="mt-2">
                            <p className="text-xs text-gray-400 dark:text-gray-400">
                              {conn.sharedControllers.length} shared controller
                              {conn.sharedControllers.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 bg-[#1c1c19] border border-[#2a2a27] rounded-lg p-6"
        >
          <h3 className="font-semibold text-[#f6fdff] mb-2">
            How It Works
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 font-bold">1.</span>
              <span>Tokens with shared controllers are detected through the relationship engine</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 font-bold">2.</span>
              <span>Hover over any token to see its connections visualized</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 font-bold">3.</span>
              <span>The system uses LRU caching for performance with large datasets</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 font-bold">4.</span>
              <span>Database indexes optimize queries for real-time responsiveness</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
