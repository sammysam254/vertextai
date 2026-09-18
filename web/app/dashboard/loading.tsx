'use client';

import React, { useState, useEffect } from 'react';
import { CallPulseLoader } from '@/components/ui/CallPulseLoader';

export default function DashboardLoading() {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    'Authenticating secure session...',
    'Connecting WebRTC voice gateway...',
    'Loading contact centre agents & workspace...',
    'Finalizing live communications channel...',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 900);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <CallPulseLoader
      variant="fullscreen"
      text="CallPulse AI"
      subtext={steps[stepIndex]}
    />
  );
}

