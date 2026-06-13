'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#3B82F6', '#06b6d4', '#10b981', '#3B82F6', '#ef4444'];

export default function AdvancedRecharts({ token }) {
  const [chartType, setChartType] = useState('area');
  const [timeRange, setTimeRange] = useState('24h');

  // Simulated historical data - in real app, fetch from API
  const generateData = (range) => {
    const points = range === '24h' ? 24 : range === '7d' ? 7 : 30;
    const data = [];
    let basePrice = token.price;

    for (let i = 0; i < points; i++) {
      const volatility = 0.05;
      const change = (Math.random() - 0.5) * volatility;
      basePrice = basePrice * (1 + change);

      data.push({
        time: range === '24h' ? `${i}:00` : `Day ${i + 1}`,
        price: Number(basePrice.toFixed(6)),
        volume: Math.floor(Math.random() * 1000000) + 500000,
        liquidity: Math.floor(Math.random() * 500000) + 200000,
      });
    }
    return data;
  };

  const data = generateData(timeRange);

  const pieData = [
    { name: 'Liquidity', value: token.liquidity },
    { name: 'Volume', value: token.volume24h },
    { name: 'Other', value: token.totalVolume || 0 },
  ];

  return (
    <motion.div
      className="glass-effect-dark rounded-3xl p-6 shadow-2xl border border-white/20"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-2xl font-poppins font-bold gradient-text mb-2">
            📈 {token.symbol} Price Analysis
          </h3>
          <p className="text-gray-400">Real-time token performance visualization</p>
        </div>

        <div className="flex gap-3">
          {/* Chart Type Selector */}
          <div className="glass-effect rounded-xl p-1 flex gap-1">
            {['area', 'line', 'bar'].map((type) => (
              <motion.button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  chartType === type
                    ? 'bg-[#f6fdff] text-[#161614] shadow-glow'
                    : 'text-gray-400 hover:text-[#f6fdff]'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </motion.button>
            ))}
          </div>

          {/* Time Range Selector */}
          <div className="glass-effect rounded-xl p-1 flex gap-1">
            {['24h', '7d', '30d'].map((range) => (
              <motion.button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  timeRange === range
                    ? 'bg-[#f6fdff] text-[#161614] shadow-glow'
                    : 'text-gray-400 hover:text-[#f6fdff]'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {range}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <motion.div
          className="lg:col-span-2 glass-effect rounded-2xl p-4"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h4 className="text-lg font-semibold text-[#f6fdff] mb-4">Price History</h4>
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'area' ? (
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f6fdff" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f6fdff" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(147, 51, 234, 0.5)',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#f6fdff"
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                  strokeWidth={2}
                  name="Price"
                />
              </AreaChart>
            ) : chartType === 'line' ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(147, 51, 234, 0.5)',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#f6fdff"
                  strokeWidth={3}
                  dot={{ fill: '#f6fdff', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Price"
                />
              </LineChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(147, 51, 234, 0.5)',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Legend />
                <Bar dataKey="volume" fill="#10b981" name="Volume" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </motion.div>

        {/* Pie Chart */}
        <motion.div
          className="glass-effect rounded-2xl p-4"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h4 className="text-lg font-semibold text-[#f6fdff] mb-4">Distribution</h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(147, 51, 234, 0.5)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          {/* Stats */}
          <div className="mt-6 space-y-3">
            <div className="glass-effect rounded-xl p-3">
              <p className="text-gray-400 text-sm">Current Price</p>
              <p className="text-[#f6fdff] font-poppins font-bold text-xl">${token.price.toFixed(6)}</p>
            </div>
            <div className="glass-effect rounded-xl p-3">
              <p className="text-gray-400 text-sm">24h Change</p>
              <p className={`font-bold text-lg ${
                token.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {token.priceChange24h >= 0 ? '↑' : '↓'} {Math.abs(token.priceChange24h).toFixed(2)}%
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
