'use client';

import { useState, useEffect } from 'react';
import { formatCurrentTime, getGreeting } from '@/lib/attendance-utils';

interface CurrentTimeDisplayProps {
  userName?: string;
  className?: string;
}

export const CurrentTimeDisplay: React.FC<CurrentTimeDisplayProps> = ({
  userName,
  className = ""
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(formatCurrentTime());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`text-right ${className}`}>
      <div className="text-2xl font-bold text-blue-600">
        {currentTime}
      </div>
      <div className="text-sm text-gray-500">
        現在時刻
      </div>
      {userName && (
        <div className="text-sm text-gray-600 mt-1">
          {getGreeting()}, {userName}さん
        </div>
      )}
    </div>
  );
};
