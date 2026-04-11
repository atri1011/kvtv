import React from 'react';
import { Icons } from '@/components/ui/Icon';

interface MobilePrimaryControlsProps {
    isPlaying: boolean;
    isNativeFullscreen: boolean;
    currentTime: number;
    duration: number;
    formatTime: (seconds: number) => string;
    onTogglePlay: () => void;
    onToggleFullscreen: () => void;
    progressBar: React.ReactNode;
}

export function MobilePrimaryControls({
    isPlaying,
    isNativeFullscreen,
    currentTime,
    duration,
    formatTime,
    onTogglePlay,
    onToggleFullscreen,
    progressBar
}: MobilePrimaryControlsProps) {
    return (
        <div className="space-y-2">
            <div className="mobile-primary-time px-1">
                <span>{formatTime(currentTime)}</span>
                <span className="opacity-50">/</span>
                <span>{formatTime(duration)}</span>
            </div>
            <div className="flex items-center gap-3">
                <button
                    onClick={onTogglePlay}
                    className="btn-icon mobile-primary-btn shrink-0"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? <Icons.Pause size={20} /> : <Icons.Play size={20} />}
                </button>
                <div className="min-w-0 flex-1">
                    {progressBar}
                </div>
                <button
                    onClick={onToggleFullscreen}
                    className="btn-icon mobile-primary-btn shrink-0"
                    aria-label={isNativeFullscreen ? '退出系统全屏' : '系统全屏'}
                    title={isNativeFullscreen ? '退出系统全屏' : '系统全屏'}
                >
                    {isNativeFullscreen ? <Icons.Minimize size={20} /> : <Icons.Maximize size={20} />}
                </button>
            </div>
        </div>
    );
}
