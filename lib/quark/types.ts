export type QuarkPlaybackMode = 'preview' | 'full';

export interface QuarkQualityOption {
  id: string;
  label: string;
  url: string;
  width?: number;
  height?: number;
  isDefault?: boolean;
  mode?: QuarkPlaybackMode;
}

export interface QuarkPlayInfo {
  cookieConfigured: boolean;
  playbackMode: QuarkPlaybackMode;
  defaultUrl: string;
  qualities: QuarkQualityOption[];
  cacheKey?: string;
  savedFid?: string;
  note?: string;
}

export interface QuarkEpisode {
  name: string;
  url: string;
  index: number;
  fid: string;
}
