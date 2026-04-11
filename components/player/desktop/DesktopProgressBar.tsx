import React, { RefObject } from 'react';

interface DesktopProgressBarProps {
    progressBarRef: RefObject<HTMLDivElement | null>;
    currentTime: number;
    duration: number;
    bufferedTime: number;
    onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    onProgressMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onProgressTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
    variant?: 'default' | 'mobile-primary';
    className?: string;
}

export function DesktopProgressBar({
    progressBarRef,
    currentTime,
    duration,
    bufferedTime,
    onProgressClick,
    onProgressMouseDown,
    onProgressTouchStart,
    variant = 'default',
    className = 'px-4 pb-1'
}: DesktopProgressBarProps) {
    return (
        <div className={className}>
            <div
                ref={progressBarRef}
                className={`slider-track cursor-pointer ${variant === 'mobile-primary' ? 'mobile-primary' : ''}`}
                onClick={onProgressClick}
                onMouseDown={onProgressMouseDown}
                onTouchStart={onProgressTouchStart}
                style={{ pointerEvents: 'auto' }}
            >
                <div
                    className="slider-buffer"
                    style={{ width: `${(bufferedTime / duration) * 100 || 0}%` }}
                />
                <div
                    className="slider-range"
                    style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                />
                <div
                    className="slider-thumb"
                    style={{ left: `${(currentTime / duration) * 100 || 0}%` }}
                />
            </div>
        </div>
    );
}
