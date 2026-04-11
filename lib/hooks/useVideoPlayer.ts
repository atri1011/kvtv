'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { settingsStore } from '@/lib/store/settings-store';
import { premiumModeSettingsStore } from '@/lib/store/premium-mode-settings';
import { QUARK_SHARE_SOURCE_ID } from '@/lib/quark/share-link';
import { syncQuarkProxyCookie } from '@/lib/quark/browser-cookie';
import type { QuarkPlaybackMode, QuarkQualityOption } from '@/lib/quark/types';

const QUARK_SAVED_FID_CACHE_KEY = 'kvideo-quark-saved-fids';

interface QuarkSavedFidCache {
  [cacheKey: string]: string;
}

interface VideoEpisode {
  name?: string;
  url: string;
  fid?: string;
}

interface VideoData {
  vod_id: string;
  vod_name: string;
  vod_pic?: string;
  vod_content?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_year?: string;
  vod_area?: string;
  type_name?: string;
  episodes?: VideoEpisode[];
}

interface UseVideoPlayerReturn {
  videoData: VideoData | null;
  loading: boolean;
  videoError: string;
  currentEpisode: number;
  playUrl: string;
  qualityOptions: QuarkQualityOption[];
  currentQualityId: string | null;
  playbackMode: QuarkPlaybackMode | null;
  quarkCookieConfigured: boolean;
  setCurrentEpisode: (index: number) => void;
  setPlayUrl: (url: string) => void;
  setVideoError: (error: string) => void;
  changeQuality: (qualityId: string) => void;
  fetchVideoDetails: () => Promise<void>;
}

function readSavedFidCache(): QuarkSavedFidCache {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(QUARK_SAVED_FID_CACHE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as QuarkSavedFidCache : {};
  } catch {
    return {};
  }
}

function readSavedFid(cacheKey: string): string | null {
  const cache = readSavedFidCache();
  const savedFid = cache[cacheKey];
  return typeof savedFid === 'string' && savedFid.trim() ? savedFid : null;
}

function writeSavedFid(cacheKey: string, savedFid: string): void {
  if (typeof window === 'undefined' || !cacheKey || !savedFid) {
    return;
  }

  const nextCache = {
    ...readSavedFidCache(),
    [cacheKey]: savedFid,
  };
  localStorage.setItem(QUARK_SAVED_FID_CACHE_KEY, JSON.stringify(nextCache));
}

function removeSavedFid(cacheKey: string): void {
  if (typeof window === 'undefined' || !cacheKey) {
    return;
  }

  const nextCache = readSavedFidCache();
  delete nextCache[cacheKey];
  localStorage.setItem(QUARK_SAVED_FID_CACHE_KEY, JSON.stringify(nextCache));
}

export function useVideoPlayer(
  videoId: string | null,
  source: string | null,
  episodeParam: string | null,
  isPremium: boolean = false,
  isReversed: boolean = false,
  onSourceUnavailable?: () => void
): UseVideoPlayerReturn {
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(!!(videoId && source));
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [playUrl, setPlayUrl] = useState('');
  const [videoError, setVideoError] = useState<string>('');
  const [qualityOptions, setQualityOptions] = useState<QuarkQualityOption[]>([]);
  const [currentQualityId, setCurrentQualityId] = useState<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState<QuarkPlaybackMode | null>(null);
  const [quarkCookieConfigured, setQuarkCookieConfigured] = useState(false);

  const episodeParamRef = useRef(episodeParam);
  const isReversedRef = useRef(isReversed);
  const onSourceUnavailableRef = useRef(onSourceUnavailable);
  const playInfoRequestIdRef = useRef(0);
  const qualityPreferenceRef = useRef<string | null>(null);

  const getCurrentQuarkCookie = useCallback(() => {
    const trimmed = isPremium
      ? premiumModeSettingsStore.getSettings().quarkCookie?.trim()
      : settingsStore.getSettings().quarkCookie?.trim();

    return trimmed || '';
  }, [isPremium]);

  useEffect(() => {
    syncQuarkProxyCookie(source === QUARK_SHARE_SOURCE_ID ? getCurrentQuarkCookie() : '');
  }, [source, getCurrentQuarkCookie, videoId, currentEpisode]);

  useEffect(() => {
    episodeParamRef.current = episodeParam;
  }, [episodeParam]);

  useEffect(() => {
    isReversedRef.current = isReversed;
  }, [isReversed]);

  useEffect(() => {
    onSourceUnavailableRef.current = onSourceUnavailable;
  }, [onSourceUnavailable]);

  const resetQuarkPlaybackState = useCallback(() => {
    playInfoRequestIdRef.current += 1;
    setQualityOptions([]);
    setCurrentQualityId(null);
    setPlaybackMode(null);
    setQuarkCookieConfigured(false);
  }, []);

  const changeQuality = useCallback((qualityId: string) => {
    const selectedQuality = qualityOptions.find((option) => option.id === qualityId);
    if (!selectedQuality) {
      return;
    }

    qualityPreferenceRef.current = qualityId;
    setCurrentQualityId(qualityId);
    setPlayUrl(selectedQuality.url);
    setVideoError('');
  }, [qualityOptions]);

  const resolveQuarkPlayInfo = useCallback(async (data: VideoData, episodeIndex: number) => {
    if (source !== QUARK_SHARE_SOURCE_ID) {
      return;
    }

    const episode = data.episodes?.[episodeIndex];
    if (!videoId || !episode) {
      return;
    }

    if (!episode.fid) {
      resetQuarkPlaybackState();
      setPlayUrl(episode.url);
      return;
    }

    const requestId = playInfoRequestIdRef.current + 1;
    playInfoRequestIdRef.current = requestId;

    try {
      const response = await fetch('/api/quark/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: data.vod_id || videoId,
          fid: episode.fid,
          cookie: getCurrentQuarkCookie(),
          savedFid: readSavedFid(`${data.vod_id || videoId}::${episode.fid}`),
        }),
      });

      const payload = await response.json();
      if (playInfoRequestIdRef.current !== requestId) {
        return;
      }

      if (!response.ok || !payload?.success || !payload?.data) {
        throw new Error(payload?.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const nextOptions = Array.isArray(payload.data.qualities)
        ? (payload.data.qualities as QuarkQualityOption[])
        : [];
      const cacheKey = typeof payload.data.cacheKey === 'string' ? payload.data.cacheKey : `${data.vod_id || videoId}::${episode.fid}`;
      if (payload.data.savedFid) {
        writeSavedFid(cacheKey, payload.data.savedFid);
      } else if (payload.data.playbackMode !== 'full') {
        removeSavedFid(cacheKey);
      }
      const preferredId = qualityPreferenceRef.current;
      const selectedOption =
        (preferredId ? nextOptions.find((option) => option.id === preferredId) : undefined) ||
        nextOptions.find((option) => option.isDefault) ||
        nextOptions[0];

      setQualityOptions(nextOptions);
      setCurrentQualityId(selectedOption?.id ?? null);
      setPlaybackMode((payload.data.playbackMode as QuarkPlaybackMode | null) ?? null);
      setQuarkCookieConfigured(Boolean(payload.data.cookieConfigured));
      setPlayUrl(selectedOption?.url || payload.data.defaultUrl || episode.url);
    } catch (error) {
      console.warn('Failed to resolve Quark play info:', error);
      if (playInfoRequestIdRef.current !== requestId) {
        return;
      }

      resetQuarkPlaybackState();
      setPlaybackMode('preview');
      setPlayUrl(episode.url);
    }
  }, [videoId, source, resetQuarkPlaybackState, getCurrentQuarkCookie]);

  const fetchVideoDetails = useCallback(async () => {
    if (!videoId || !source) return;

    try {
      setVideoError('');
      setLoading(true);

      let response: Response;

      if (source === QUARK_SHARE_SOURCE_ID) {
        response = await fetch('/api/quark/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: videoId }),
        });
      } else {
        const settings = settingsStore.getSettings();
        const allSources = [
          ...settings.sources,
          ...settings.premiumSources,
          ...settings.subscriptions,
        ];

        const sourceConfig = allSources.find(s => s.id === source);

        if (sourceConfig) {
          response = await fetch('/api/detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: videoId, source: sourceConfig })
          });
        } else {
          response = await fetch(`/api/detail?id=${videoId}&source=${source}`);
        }
      }

      const data = await response.json();
      const sourceUnavailable =
        response.status === 404 ||
        (response.status === 400 && typeof data?.error === 'string' && data.error.toLowerCase().includes('source')) ||
        (typeof data?.error === 'string' && data.error.includes('视频源不可用'));

      if (!response.ok) {
        if (sourceUnavailable) {
          setVideoError(data.error || '该视频源不可用。请返回并尝试其他来源。');
          setLoading(false);
          onSourceUnavailableRef.current?.();
          return;
        }
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (data.success && data.data) {
        setVideoData(data.data);
        setLoading(false);

        if (data.data.episodes && data.data.episodes.length > 0) {
          const latestIsReversed = isReversedRef.current;
          const latestEpisodeParam = episodeParamRef.current;

          const defaultIndex = latestIsReversed ? data.data.episodes.length - 1 : 0;
          const episodeIndex = latestEpisodeParam ? parseInt(latestEpisodeParam, 10) : defaultIndex;
          const validIndex = (episodeIndex >= 0 && episodeIndex < data.data.episodes.length) ? episodeIndex : defaultIndex;

          const episodeUrl = data.data.episodes[validIndex].url;
          setCurrentEpisode(validIndex);
          setPlayUrl(episodeUrl);
        } else {
          setVideoError('该来源没有可播放的剧集');
          setLoading(false);
        }
      } else {
        throw new Error(data.error || '来自 API 的响应无效');
      }
    } catch (error) {
      console.error('Failed to fetch video details:', error);
      setVideoError(error instanceof Error ? error.message : '加载视频详情失败。');
      setLoading(false);
    }
  }, [videoId, source]);

  useEffect(() => {
    if (!videoId || !source || !videoError || source === QUARK_SHARE_SOURCE_ID) return;

    const unsubscribe = settingsStore.subscribe(() => {
      const settings = settingsStore.getSettings();
      const allSources = [
        ...settings.sources,
        ...settings.premiumSources,
        ...settings.subscriptions,
      ];

      if (allSources.length > 0) {
        console.log('Settings updated, retrying video fetch...');
        fetchVideoDetails();
      }
    });

    return () => unsubscribe();
  }, [videoId, source, videoError, fetchVideoDetails]);

  useEffect(() => {
    if (videoData?.episodes && episodeParam !== null) {
      const index = parseInt(episodeParam, 10);
      if (!isNaN(index) && index >= 0 && index < videoData.episodes.length) {
        if (index !== currentEpisode) {
          setCurrentEpisode(index);
          setPlayUrl(videoData.episodes[index].url);
        }
      }
    }
  }, [episodeParam, videoData, currentEpisode]);

  useEffect(() => {
    qualityPreferenceRef.current = null;
    resetQuarkPlaybackState();

    if (videoId && source) {
      setVideoData(null);
      setCurrentEpisode(0);
      setPlayUrl('');
      fetchVideoDetails();
    }
  }, [videoId, source, fetchVideoDetails, resetQuarkPlaybackState]);

  useEffect(() => {
    if (source !== QUARK_SHARE_SOURCE_ID || !videoData?.episodes?.length) {
      return;
    }

    void resolveQuarkPlayInfo(videoData, currentEpisode);
  }, [source, videoData, currentEpisode, resolveQuarkPlayInfo]);

  return {
    videoData,
    loading,
    videoError,
    currentEpisode,
    playUrl,
    qualityOptions,
    currentQualityId,
    playbackMode,
    quarkCookieConfigured,
    setCurrentEpisode,
    setPlayUrl,
    setVideoError,
    changeQuality,
    fetchVideoDetails,
  };
}
