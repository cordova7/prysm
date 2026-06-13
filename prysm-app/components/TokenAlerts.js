'use client';

import { useState, useEffect } from 'react'

export default function TokenAlerts({ newTokens }) {
  const [alerts, setAlerts] = useState([])
  const [settings, setSettings] = useState({
    desktopNotifications: true,
    emailAlerts: false,
    soundAlerts: true
  })

  // Simulate new token alerts
  useEffect(() => {
    if (newTokens.length > 0) {
      const newAlerts = newTokens.map(token => ({
        id: `alert-${token.tokenLedgerId}-${Date.now()}`,
        title: `New Token: ${token.symbol}`,
        message: `${token.name} has been added to ICPSWAP`,
        time: new Date().toLocaleTimeString(),
        read: false
      }))
      setAlerts(prev => [...newAlerts, ...prev])
    }
  }, [newTokens])

  const markAsRead = (id) => {
    setAlerts(alerts.map(alert =>
      alert.id === id ? {...alert, read: true} : alert
    ))
  }

  const clearAll = () => {
    setAlerts([])
  }

  const toggleSetting = (settingName) => {
    setSettings(prev => ({
      ...prev,
      [settingName]: !prev[settingName]
    }))
  }

  return (
    <div className="bg-[#f6fdff] rounded-lg border border-gray-200 h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#f6fdff]">Token Alerts</h2>
          {alerts.filter(a => !a.read).length > 0 && (
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded">
              {alerts.filter(a => !a.read).length} new
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Settings */}
        <div>
          <h3 className="text-sm font-semibold text-[#f6fdff] mb-3">Settings</h3>

          <div className="space-y-2">
            <div
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSetting('desktopNotifications')}
            >
              <span className="text-sm text-gray-700">Desktop Notifications</span>
              <div className={`relative w-10 h-6 rounded-full transition-colors ${settings.desktopNotifications ? 'bg-[#2a2a27]' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-[#f6fdff] rounded-full transition-transform ${settings.desktopNotifications ? 'left-5' : 'left-0.5'}`}></div>
              </div>
            </div>

            <div
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSetting('emailAlerts')}
            >
              <span className="text-sm text-gray-700">Email Alerts</span>
              <div className={`relative w-10 h-6 rounded-full transition-colors ${settings.emailAlerts ? 'bg-[#2a2a27]' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-[#f6fdff] rounded-full transition-transform ${settings.emailAlerts ? 'left-5' : 'left-0.5'}`}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#f6fdff]">Recent Alerts</h3>
            {alerts.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No alerts yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.read
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-gray-300 bg-[#f6fdff]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-sm font-medium text-[#f6fdff]">{alert.title}</h4>
                    <button
                      onClick={() => markAsRead(alert.id)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {alert.read ? 'Read' : 'Mark as read'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">{alert.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{alert.time}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}