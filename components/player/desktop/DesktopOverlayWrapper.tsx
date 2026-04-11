import React from 'react';
import { DesktopOverlay } from './DesktopOverlay';
import { useDesktopPlayerState } from '../hooks/useDesktopPlayerState';
import type { QuarkPlaybackMode, QuarkQualityOption } from '@/lib/quark/types';

interface DesktopOverlayWrapperProps {
    data: ReturnType<typeof useDesktopPlayerState>['data'];
    showControls: boolean;
    isFullscreen: boolean;
    fullscreenClock: string;
    isRotated?: boolean;
    onTogglePlay: () => void;
    onSkipForward: () => void;
    onSkipBackward: () => void;
    isTransitioningToNextEpisode?: boolean;
    showMoreMenu: boolean;
    isPremium?: boolean;
    isProxied: boolean;
    onToggleMoreMenu: () => void;
    onMoreMenuMouseEnter: () => void;
    onMoreMenuMouseLeave: () => void;
    onCopyLink: (type?: 'original' | 'proxy') => void;
    seekStepSeconds: number;
    qualityOptions: QuarkQualityOption[];
    currentQualityId: string | null;
    playbackMode: QuarkPlaybackMode | null;
    quarkCookieConfigured: boolean;
    onQualityChange?: (qualityId: string) => void;
    // Speed Menu Props
    playbackRate: number;
    showSpeedMenu: boolean;
    speeds: number[];
    onToggleSpeedMenu: () => void;
    onSpeedChange: (speed: number) => void;
    onSpeedMenuMouseEnter: () => void;
    onSpeedMenuMouseLeave: () => void;
    webFullscreenSize: 'full' | 'large' | 'focused';
    onCycleWebFullscreenSize: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export function DesktopOverlayWrapper({
    data,
    showControls,
    isFullscreen,
    fullscreenClock,
    isRotated = false,
    onTogglePlay,
    onSkipForward,
    onSkipBackward,
    isTransitioningToNextEpisode = false,
    showMoreMenu,
    isPremium = false,
    isProxied,
    onToggleMoreMenu,
    onMoreMenuMouseEnter,
    onMoreMenuMouseLeave,
    onCopyLink,
    seekStepSeconds,
    qualityOptions,
    currentQualityId,
    playbackMode,
    quarkCookieConfigured,
    onQualityChange,
    playbackRate,
    showSpeedMenu,
    speeds,
    onToggleSpeedMenu,
    onSpeedChange,
    onSpeedMenuMouseEnter,
    onSpeedMenuMouseLeave,
    webFullscreenSize,
    onCycleWebFullscreenSize,
    containerRef,
}: DesktopOverlayWrapperProps) {
    const {
        isLoading,
        isPlaying,
        showSkipForwardIndicator,
        showSkipBackwardIndicator,
        skipForwardAmount,
        skipBackwardAmount,
        isSkipForwardAnimatingOut,
        isSkipBackwardAnimatingOut,
        showToast,
        toastMessage,
    } = data;

    return (
        <DesktopOverlay
            isLoading={isLoading}
            isTransitioningToNextEpisode={isTransitioningToNextEpisode}
            isPlaying={isPlaying}
            showSkipForwardIndicator={showSkipForwardIndicator}
            showSkipBackwardIndicator={showSkipBackwardIndicator}
            skipForwardAmount={skipForwardAmount}
            skipBackwardAmount={skipBackwardAmount}
            isSkipForwardAnimatingOut={isSkipForwardAnimatingOut}
            isSkipBackwardAnimatingOut={isSkipBackwardAnimatingOut}
            showToast={showToast}
            toastMessage={toastMessage}
            showControls={showControls}
            isFullscreen={isFullscreen}
            fullscreenClock={fullscreenClock}
            onTogglePlay={onTogglePlay}
            onSkipForward={onSkipForward}
            onSkipBackward={onSkipBackward}
            showMoreMenu={showMoreMenu}
            isPremium={isPremium}
            isProxied={isProxied}
            onToggleMoreMenu={onToggleMoreMenu}
            onMoreMenuMouseEnter={onMoreMenuMouseEnter}
            onMoreMenuMouseLeave={onMoreMenuMouseLeave}
            onCopyLink={onCopyLink}
            seekStepSeconds={seekStepSeconds}
            qualityOptions={qualityOptions}
            currentQualityId={currentQualityId}
            playbackMode={playbackMode}
            quarkCookieConfigured={quarkCookieConfigured}
            onQualityChange={onQualityChange}
            playbackRate={playbackRate}
            showSpeedMenu={showSpeedMenu}
            speeds={speeds}
            onToggleSpeedMenu={onToggleSpeedMenu}
            onSpeedChange={onSpeedChange}
            onSpeedMenuMouseEnter={onSpeedMenuMouseEnter}
            onSpeedMenuMouseLeave={onSpeedMenuMouseLeave}
            webFullscreenSize={webFullscreenSize}
            onCycleWebFullscreenSize={onCycleWebFullscreenSize}
            containerRef={containerRef}
            isRotated={isRotated}
        />
    );
}
