import React from 'react';
import { DesktopProgressBar } from './DesktopProgressBar';
import { DesktopLeftControls } from './DesktopLeftControls';
import { DesktopRightControls } from './DesktopRightControls';
import { MobilePrimaryControls } from '../mobile/MobilePrimaryControls';

interface DesktopControlsProps {
    isMobilePrimaryLayout: boolean;
    showControls: boolean;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    bufferedTime: number;
    volume: number;
    isMuted: boolean;
    isFullscreen: boolean;
    isNativeFullscreen: boolean;
    isWebFullscreen: boolean;


    showVolumeBar: boolean;
    isPiPSupported: boolean;
    isAirPlaySupported: boolean;
    isCastAvailable: boolean;
    isProxied?: boolean;
    progressBarRef: React.RefObject<HTMLDivElement | null>;
    volumeBarRef: React.RefObject<HTMLDivElement | null>;
    onTogglePlay: () => void;
    onToggleMute: () => void;
    onVolumeChange: (e: React.MouseEvent<HTMLDivElement>) => void;
    onVolumeMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onToggleFullscreen: () => void;
    onToggleNativeFullscreen: () => void;
    onToggleWebFullscreen: () => void;
    onTogglePictureInPicture: () => void;
    onShowAirPlayMenu: () => void;
    onShowCastMenu: () => void;
    onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    onProgressMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onProgressTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
    formatTime: (seconds: number) => string;
}

export function DesktopControls(props: DesktopControlsProps) {
    const {
        showControls,
        currentTime,
        duration,
        bufferedTime,
        progressBarRef,
        onProgressClick,
        onProgressMouseDown,
        onProgressTouchStart,
        formatTime,
    } = props;
    const progressBar = (
        <DesktopProgressBar
            progressBarRef={progressBarRef}
            currentTime={currentTime}
            duration={duration}
            bufferedTime={bufferedTime}
            onProgressClick={onProgressClick}
            onProgressMouseDown={onProgressMouseDown}
            onProgressTouchStart={onProgressTouchStart}
            variant={props.isMobilePrimaryLayout ? 'mobile-primary' : 'default'}
            className={props.isMobilePrimaryLayout ? 'px-0 pb-0 flex-1' : 'px-4 pb-1'}
        />
    );

    return (
        <div
            className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                }`}
            style={{
                pointerEvents: showControls ? 'auto' : 'none',
                visibility: showControls ? 'visible' : 'hidden',
            }}
        >
            {props.isMobilePrimaryLayout ? (
                <div className="bg-gradient-to-t from-black/90 via-black/72 to-transparent px-4 pb-4 pt-3">
                    <MobilePrimaryControls
                        isPlaying={props.isPlaying}
                        isNativeFullscreen={props.isNativeFullscreen}
                        currentTime={currentTime}
                        duration={duration}
                        formatTime={formatTime}
                        onTogglePlay={props.onTogglePlay}
                        onToggleFullscreen={props.onToggleNativeFullscreen}
                        progressBar={progressBar}
                    />
                </div>
            ) : (
                <>
                    {progressBar}
                    <div className="bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pb-4 pt-2">
                        <div className="flex items-center justify-between gap-4">
                            <DesktopLeftControls {...props} formatTime={formatTime} />
                            <DesktopRightControls {...props} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
