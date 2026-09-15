'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Panel } from '@/components/ui/Panel';

const data = [
  { time: '11:00', incoming: 45, waiting: 12, resolved: 38 },
  { time: '12:00', incoming: 52, waiting: 18, resolved: 42 },
  { time: '13:00', incoming: 61, waiting: 15, resolved: 53 },
  { time: '14:00', incoming: 58, waiting: 22, resolved: 48 },
  { time: '15:00', incoming: 70, waiting: 28, resolved: 55 },
  { time: '16:00', incoming: 65, waiting: 20, resolved: 58 },
  { time: '17:00', incoming: 72, waiting: 25, resolved: 62 },
  { time: '18:00', incoming: 68, waiting: 19, resolved: 60 },
  { time: '19:00', incoming: 55, waiting: 14, resolved: 52 },
  { time: '20:00', incoming: 48, waiting: 11, resolved: 45 },
  { time: '21:00', incoming: 42, waiting: 8, resolved: 40 },
  { time: '22:00', incoming: 35, waiting: 6, resolved: 32 },
  { time: '23:00', incoming: 28, waiting: 4, resolved: 26 },
  { time: '00:00', incoming: 18, waiting: 2, resolved: 17 },
];

export function PerformanceChart() {
  return (
    <Panel className="p-6">
      <h2 className="text-lg font-semibold text-white mb-6">
        24-Hour Performance
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#0d9488" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorWaiting" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3f56" />
          <XAxis 
            dataKey="time" 
            stroke="#9fb3c8"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#9fb3c8"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a2332',
              border: '1px solid #2d3f56',
              borderRadius: '8px',
              color: '#d9e2ec',
            }}
          />
          <Legend 
            wrapperStyle={{ color: '#9fb3c8', fontSize: '12px' }}
          />
          <Area
            type="monotone"
            dataKey="incoming"
            stroke="#0d9488"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorIncoming)"
            name="Incoming"
          />
          <Area
            type="monotone"
            dataKey="waiting"
            stroke="#14b8a6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorWaiting)"
            name="Waiting"
          />
          <Area
            type="monotone"
            dataKey="resolved"
            stroke="#06b6d4"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorResolved)"
            name="Resolved"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Panel>
  );
}
