import { buildQuarkShareUrl, parseQuarkShareUrl, QUARK_SHARE_SOURCE_ID } from '@/lib/quark/share-link';
import type { QuarkEpisode, QuarkPlayInfo, QuarkPlaybackMode, QuarkQualityOption } from '@/lib/quark/types';

const QUARK_SHARE_HOST = 'https://drive-h.quark.cn';
const QUARK_DRIVE_HOST = 'https://drive-pc.quark.cn';
const DEFAULT_PAGE_SIZE = 100;
const MAX_AUTO_DESCEND_DEPTH = 2;
const MAX_CHILDREN_TO_SCAN = 6;
const USER_AGENT = 'Mozilla/5.0';
const PLAY_RESOLUTIONS = 'normal,low,high,super,2k,4k';
const PLAY_SUPPORTS = 'fmp4,m3u8';
const QUARK_CACHE_DIR = '/KVideo-Quark-Cache';
const SAVE_TASK_POLL_INTERVAL_MS = 500;
const SAVE_TASK_MAX_RETRIES = 12;

const QUALITY_LABEL_MAP: Record<string, string> = {
  preview: '预览',
  normal: '流畅',
  low: '普清',
  high: '高清',
  super: '超清',
  '2k': '2K',
  '4k': '4K',
};

const QUALITY_ORDER_MAP: Record<string, number> = {
  preview: 0,
  normal: 1,
  low: 2,
  high: 3,
  super: 4,
  '2k': 5,
  '4k': 6,
};

interface QuarkTokenResponse {
  code: number;
  message?: string;
  data?: {
    stoken?: string;
    title?: string;
  };
}

export interface QuarkListItem {
  fid: string;
  file_name: string;
  dir?: boolean;
  file?: boolean;
  category?: number;
  format_type?: string;
  preview_url?: string;
  thumbnail?: string;
  big_thumbnail?: string;
  share_fid_token?: string;
}

interface QuarkDetailResponse {
  code: number;
  message?: string;
  data?: {
    list?: QuarkListItem[];
  };
}

interface QuarkPlayResponse {
  code: number;
  message?: string;
  data?: unknown;
}

interface QuarkPathInfoItem {
  fid: string;
  file_path: string;
}

interface QuarkPathInfoResponse {
  code: number;
  message?: string;
  data?: QuarkPathInfoItem[];
}

interface QuarkMkdirResponse {
  code: number;
  message?: string;
  data?: {
    fid?: string;
  };
}

interface QuarkSaveResponse {
  code: number;
  message?: string;
  data?: {
    task_id?: string;
  };
}

interface QuarkTaskResponse {
  code: number;
  message?: string;
  data?: {
    finished_at?: number;
    status?: number;
    save_as?: {
      save_as_top_fids?: string[];
    };
  };
}

interface ResolvedDirectory {
  dirId: string;
  titleTrail: string[];
  items: QuarkListItem[];
}

export interface QuarkResolvedShare {
  vod_id: string;
  vod_name: string;
  vod_pic?: string;
  vod_content?: string;
  vod_remarks?: string;
  type_name: string;
  episodes: QuarkEpisode[];
  source: typeof QUARK_SHARE_SOURCE_ID;
  source_code: string;
}

function getRequestHeaders(cookie?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
    'Referer': 'https://pan.quark.cn/',
  };

  if (cookie) {
    headers.Cookie = cookie;
  }

  return headers;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & { code?: number; message?: string };

  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }

  return data;
}

function toQualityLabel(rawId: string | undefined, width?: number, height?: number): string {
  const normalized = rawId?.trim().toLowerCase() || '';
  if (normalized && QUALITY_LABEL_MAP[normalized]) {
    return QUALITY_LABEL_MAP[normalized];
  }

  const maxSide = Math.max(width || 0, height || 0);
  const minSide = Math.min(width || 0, height || 0);
  const videoHeight = maxSide === width ? minSide : maxSide;

  if (videoHeight >= 2160) return '4K';
  if (videoHeight >= 1440) return '2K';
  if (videoHeight >= 1080) return '1080P';
  if (videoHeight >= 720) return '720P';
  if (videoHeight >= 480) return '480P';

  return rawId?.trim() || '默认';
}

function qualityScore(option: QuarkQualityOption): number {
  const normalized = option.id.trim().toLowerCase();
  if (QUALITY_ORDER_MAP[normalized] !== undefined) {
    return QUALITY_ORDER_MAP[normalized];
  }

  const pixels = (option.width || 0) * (option.height || 0);
  return pixels > 0 ? pixels : -1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function isPlayableUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function firstPlayableUrl(record: Record<string, unknown>): string | null {
  const candidates = [
    record.url,
    record.play_url,
    record.video_url,
    record.m3u8_url,
    record.master_url,
    record.stream_url,
    record.download_url,
  ];

  for (const candidate of candidates) {
    if (isPlayableUrl(candidate)) {
      return candidate;
    }
  }

  return null;
}

function toQualityOption(item: Record<string, unknown>, index: number): QuarkQualityOption | null {
  const nestedRecords = ['video_info', 'play_info', 'stream_info']
    .map((key) => item[key])
    .filter(isRecord);

  const merged = nestedRecords.reduce<Record<string, unknown>>(
    (accumulator, current) => ({ ...accumulator, ...current }),
    { ...item },
  );

  const url = firstPlayableUrl(merged);
  if (!url) {
    return null;
  }

  const rawId = [
    merged.resolution,
    merged.definition,
    merged.quality,
    merged.template_id,
    merged.template_name,
    merged.name,
    merged.label,
  ]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    ?.trim()
    .toLowerCase();

  const width = toNumber(
    merged.width ??
    merged.video_width ??
    merged.resolution_width ??
    merged.template_width,
  );
  const height = toNumber(
    merged.height ??
    merged.video_height ??
    merged.resolution_height ??
    merged.template_height,
  );

  return {
    id: rawId || `quality-${index + 1}`,
    label: toQualityLabel(rawId, width, height),
    url,
    width,
    height,
  };
}

function normalizeQualityOptions(options: QuarkQualityOption[]): QuarkQualityOption[] {
  const deduped = new Map<string, QuarkQualityOption>();

  for (const option of options) {
    const existing = deduped.get(option.url);
    if (!existing || qualityScore(option) > qualityScore(existing)) {
      deduped.set(option.url, option);
    }
  }

  const sorted = [...deduped.values()].sort((left, right) => qualityScore(right) - qualityScore(left));

  return sorted.map((option, index) => ({
    ...option,
    isDefault: index === 0,
  }));
}

function collectQualityOptions(value: unknown, output: QuarkQualityOption[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectQualityOptions(entry, output));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const directOption = toQualityOption(value, output.length);
  if (directOption) {
    output.push(directOption);
  }

  Object.values(value).forEach((entry) => {
    if (Array.isArray(entry) || isRecord(entry)) {
      collectQualityOptions(entry, output);
    }
  });
}

function extractQualityOptions(data: unknown): QuarkQualityOption[] {
  if (!isRecord(data)) {
    return [];
  }

  const explicitArrays = ['video_list', 'play_url_list', 'stream_list', 'qualities']
    .map((key) => data[key])
    .filter(Array.isArray) as Array<Array<Record<string, unknown>>>;

  const explicitOptions = explicitArrays.flatMap((items) =>
    items
      .map((item, index) => toQualityOption(item, index))
      .filter((option): option is QuarkQualityOption => Boolean(option)),
  );

  if (explicitOptions.length > 0) {
    return normalizeQualityOptions(explicitOptions);
  }

  const collected: QuarkQualityOption[] = [];
  collectQualityOptions(data, collected);
  return normalizeQualityOptions(collected);
}

function getPlayableVideos(items: QuarkListItem[]): QuarkListItem[] {
  return items.filter((item) =>
    Boolean(item.preview_url) &&
    item.dir !== true &&
    (item.category === 1 || item.format_type?.startsWith('video/')),
  );
}

function getEnvCookie(): string | null {
  const candidates = [
    process.env.QUARK_COOKIE,
    process.env.QUARK_PAN_COOKIE,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function resolveCookieOverride(cookie?: string | null): string | null {
  if (typeof cookie === 'string' && cookie.trim()) {
    return cookie.trim();
  }

  return getEnvCookie();
}

function createQuarkCacheKey(rawUrl: string, fid: string): string {
  return `${rawUrl}::${fid}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchShareToken(shareId: string): Promise<{ stoken: string; title: string }> {
  const response = await fetchJson<QuarkTokenResponse>(
    `${QUARK_SHARE_HOST}/1/clouddrive/share/sharepage/token`,
    {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        pwd_id: shareId,
        passcode: '',
        support_visit_limit_private_share: true,
      }),
    },
  );

  if (response.code !== 0 || !response.data?.stoken) {
    throw new Error(response.message || '获取夸克分享令牌失败');
  }

  return {
    stoken: response.data.stoken,
    title: response.data.title || '夸克网盘分享',
  };
}

export async function fetchShareDetail(shareId: string, stoken: string, dirId: string): Promise<QuarkListItem[]> {
  const params = new URLSearchParams({
    pr: 'ucpro',
    fr: 'pc',
    uc_param_str: '',
    ver: '2',
    pwd_id: shareId,
    stoken,
    pdir_fid: dirId,
    force: '0',
    _page: '1',
    _size: String(DEFAULT_PAGE_SIZE),
    _fetch_banner: '0',
    _fetch_share: '0',
    fetch_relate_conversation: '0',
    _fetch_total: '1',
    _sort: 'file_type:asc,file_name:asc',
  });

  const response = await fetchJson<QuarkDetailResponse>(
    `${QUARK_SHARE_HOST}/1/clouddrive/share/sharepage/detail?${params.toString()}`,
    {
      method: 'GET',
      headers: getRequestHeaders(),
    },
  );

  if (response.code !== 0) {
    throw new Error(response.message || '获取夸克分享目录失败');
  }

  return response.data?.list || [];
}

async function resolvePlayableDirectory(
  shareId: string,
  stoken: string,
  dirId: string,
  titleTrail: string[] = [],
  depth = 0,
  visited = new Set<string>(),
): Promise<ResolvedDirectory | null> {
  if (visited.has(dirId)) {
    return null;
  }
  visited.add(dirId);

  const items = await fetchShareDetail(shareId, stoken, dirId);
  const videos = getPlayableVideos(items);
  if (videos.length > 0) {
    return {
      dirId,
      titleTrail,
      items,
    };
  }

  if (depth >= MAX_AUTO_DESCEND_DEPTH) {
    return null;
  }

  const directories = items
    .filter((item) => item.dir && item.fid)
    .slice(0, MAX_CHILDREN_TO_SCAN);

  let bestMatch: ResolvedDirectory | null = null;
  let bestVideoCount = 0;

  for (const directory of directories) {
    const resolved = await resolvePlayableDirectory(
      shareId,
      stoken,
      directory.fid,
      [...titleTrail, directory.file_name],
      depth + 1,
      visited,
    );

    if (!resolved) {
      continue;
    }

    const currentVideoCount = getPlayableVideos(resolved.items).length;
    if (currentVideoCount > bestVideoCount) {
      bestMatch = resolved;
      bestVideoCount = currentVideoCount;
    }
  }

  return bestMatch;
}

async function findVideoByFid(
  shareId: string,
  stoken: string,
  dirId: string,
  targetFid: string,
  depth = 0,
  visited = new Set<string>(),
): Promise<QuarkListItem | null> {
  if (visited.has(dirId)) {
    return null;
  }
  visited.add(dirId);

  const items = await fetchShareDetail(shareId, stoken, dirId);
  const matchedItem = items.find((item) => item.fid === targetFid && item.dir !== true);
  if (matchedItem) {
    return matchedItem;
  }

  if (depth >= MAX_AUTO_DESCEND_DEPTH) {
    return null;
  }

  const directories = items
    .filter((item) => item.dir && item.fid)
    .slice(0, MAX_CHILDREN_TO_SCAN);

  for (const directory of directories) {
    const matchedChild = await findVideoByFid(
      shareId,
      stoken,
      directory.fid,
      targetFid,
      depth + 1,
      visited,
    );

    if (matchedChild) {
      return matchedChild;
    }
  }

  return null;
}

async function fetchPathInfo(paths: string[], cookie: string): Promise<QuarkPathInfoItem[]> {
  const response = await fetchJson<QuarkPathInfoResponse>(
    `${QUARK_DRIVE_HOST}/1/clouddrive/file/info/path_list?pr=ucpro&fr=pc`,
    {
      method: 'POST',
      headers: getRequestHeaders(cookie),
      body: JSON.stringify({
        file_path: paths,
        namespace: '0',
      }),
    },
  );

  if (response.code !== 0) {
    throw new Error(response.message || '获取夸克缓存目录失败');
  }

  return response.data || [];
}

async function createDirectory(dirPath: string, cookie: string): Promise<string> {
  const response = await fetchJson<QuarkMkdirResponse>(
    `${QUARK_DRIVE_HOST}/1/clouddrive/file?pr=ucpro&fr=pc&uc_param_str=`,
    {
      method: 'POST',
      headers: getRequestHeaders(cookie),
      body: JSON.stringify({
        pdir_fid: '0',
        file_name: '',
        dir_path: dirPath,
        dir_init_lock: false,
      }),
    },
  );

  if (response.code !== 0 || !response.data?.fid) {
    throw new Error(response.message || '创建夸克缓存目录失败');
  }

  return response.data.fid;
}

async function ensureCacheDirectory(cookie: string): Promise<string> {
  const existing = await fetchPathInfo([QUARK_CACHE_DIR], cookie);
  const matched = existing.find((item) => item.file_path === QUARK_CACHE_DIR && item.fid);
  if (matched?.fid) {
    return matched.fid;
  }

  return createDirectory(QUARK_CACHE_DIR, cookie);
}

async function saveShareFile(
  shareId: string,
  stoken: string,
  item: QuarkListItem,
  targetDirFid: string,
  cookie: string,
): Promise<string> {
  const response = await fetchJson<QuarkSaveResponse>(
    `${QUARK_DRIVE_HOST}/1/clouddrive/share/sharepage/save?pr=ucpro&fr=pc&uc_param_str=&app=clouddrive`,
    {
      method: 'POST',
      headers: getRequestHeaders(cookie),
      body: JSON.stringify({
        fid_list: [item.fid],
        fid_token_list: [item.share_fid_token],
        to_pdir_fid: targetDirFid,
        pwd_id: shareId,
        stoken,
        pdir_fid: '0',
        scene: 'link',
      }),
    },
  );

  if (response.code !== 0 || !response.data?.task_id) {
    throw new Error(response.message || '转存夸克分享文件失败');
  }

  return response.data.task_id;
}

async function queryTask(taskId: string, cookie: string, retryIndex = 0): Promise<QuarkTaskResponse> {
  return fetchJson<QuarkTaskResponse>(
    `${QUARK_DRIVE_HOST}/1/clouddrive/task?pr=ucpro&fr=pc&uc_param_str=&task_id=${encodeURIComponent(taskId)}&retry_index=${retryIndex}`,
    {
      method: 'GET',
      headers: getRequestHeaders(cookie),
    },
  );
}

async function waitForSaveTask(taskId: string, cookie: string): Promise<string> {
  for (let retryIndex = 0; retryIndex < SAVE_TASK_MAX_RETRIES; retryIndex += 1) {
    const response = await queryTask(taskId, cookie, retryIndex);
    if (response.code !== 0) {
      throw new Error(response.message || '查询夸克转存任务失败');
    }

    const savedFid = response.data?.save_as?.save_as_top_fids?.[0];
    if (savedFid) {
      return savedFid;
    }

    await sleep(SAVE_TASK_POLL_INTERVAL_MS);
  }

  throw new Error('夸克转存任务超时');
}

async function fetchFullPlayInfo(fid: string, cookie: string): Promise<QuarkQualityOption[]> {
  const response = await fetchJson<QuarkPlayResponse>(
    `${QUARK_DRIVE_HOST}/1/clouddrive/file/v2/play?pr=ucpro&fr=pc`,
    {
      method: 'POST',
      headers: getRequestHeaders(cookie),
      body: JSON.stringify({
        fid,
        resolutions: PLAY_RESOLUTIONS,
        supports: PLAY_SUPPORTS,
      }),
    },
  );

  if (response.code !== 0) {
    throw new Error(response.message || '获取夸克完整播放地址失败');
  }

  return extractQualityOptions(response.data);
}

function createPreviewPlayInfo(previewUrl: string, cacheKey?: string, note?: string): QuarkPlayInfo {
  return {
    cookieConfigured: false,
    playbackMode: 'preview',
    defaultUrl: previewUrl,
    qualities: [
      {
        id: 'preview',
        label: QUALITY_LABEL_MAP.preview,
        url: previewUrl,
        isDefault: true,
        mode: 'preview',
      },
    ],
    cacheKey,
    note,
  };
}

function withMode(options: QuarkQualityOption[], mode: QuarkPlaybackMode): QuarkQualityOption[] {
  return options.map((option) => ({ ...option, mode }));
}

function createFullPlayInfo(
  qualities: QuarkQualityOption[],
  cacheKey: string,
  savedFid: string,
): QuarkPlayInfo {
  return {
    cookieConfigured: true,
    playbackMode: 'full',
    defaultUrl: qualities[0].url,
    qualities,
    cacheKey,
    savedFid,
  };
}

export async function resolveQuarkShare(rawUrl: string): Promise<QuarkResolvedShare> {
  const parsed = parseQuarkShareUrl(rawUrl);
  if (!parsed) {
    throw new Error('无效的夸克分享链接');
  }

  const { stoken, title } = await fetchShareToken(parsed.shareId);
  const resolved = await resolvePlayableDirectory(parsed.shareId, stoken, parsed.dirId);

  if (!resolved) {
    throw new Error('当前夸克分享目录下没有可播放视频，请粘贴包含视频文件的目录链接');
  }

  const videos = getPlayableVideos(resolved.items).sort((left, right) =>
    left.file_name.localeCompare(right.file_name, 'zh-CN', { numeric: true }),
  );

  if (videos.length === 0) {
    throw new Error('当前夸克分享目录下没有可播放视频');
  }

  const cover = videos[0].big_thumbnail || videos[0].thumbnail;
  const resolvedTitle = resolved.titleTrail.at(-1) || title;
  const content = resolved.titleTrail.length > 0
    ? `来源：${title}\n目录：${resolved.titleTrail.join(' / ')}`
    : `来源：${title}`;
  const resolvedShareUrl = buildQuarkShareUrl(parsed.shareId, resolved.dirId);

  return {
    vod_id: resolvedShareUrl,
    vod_name: resolvedTitle,
    vod_pic: cover,
    vod_content: content,
    vod_remarks: `夸克网盘 · ${videos.length} 个视频`,
    type_name: '夸克网盘',
    episodes: videos.map((video, index) => ({
      name: video.file_name,
      url: video.preview_url!,
      index,
      fid: video.fid,
    })),
    source: QUARK_SHARE_SOURCE_ID,
    source_code: resolved.dirId,
  };
}

export async function resolveQuarkPlayInfo(
  rawUrl: string,
  fid: string,
  cookieOverride?: string | null,
  savedFidOverride?: string | null,
): Promise<QuarkPlayInfo> {
  const parsed = parseQuarkShareUrl(rawUrl);
  if (!parsed) {
    throw new Error('无效的夸克分享链接');
  }

  const { stoken } = await fetchShareToken(parsed.shareId);
  const targetVideo = await findVideoByFid(parsed.shareId, stoken, parsed.dirId, fid);
  const cacheKey = createQuarkCacheKey(parsed.normalizedUrl, fid);

  if (!targetVideo || !targetVideo.preview_url) {
    throw new Error('未找到对应的夸克视频文件');
  }

  const cookie = resolveCookieOverride(cookieOverride);
  if (!cookie) {
    return createPreviewPlayInfo(targetVideo.preview_url, cacheKey, '未配置 QUARK_COOKIE，已回退到预览视频');
  }

  try {
    if (savedFidOverride) {
      const cachedQualities = withMode(await fetchFullPlayInfo(savedFidOverride, cookie), 'full');
      if (cachedQualities.length > 0) {
        return createFullPlayInfo(cachedQualities, cacheKey, savedFidOverride);
      }
    }

    if (!targetVideo.share_fid_token) {
      throw new Error('缺少 share_fid_token');
    }

    const targetDirFid = await ensureCacheDirectory(cookie);
    const taskId = await saveShareFile(parsed.shareId, stoken, targetVideo, targetDirFid, cookie);
    const savedFid = await waitForSaveTask(taskId, cookie);
    const qualities = withMode(await fetchFullPlayInfo(savedFid, cookie), 'full');

    if (qualities.length === 0) {
      return {
        ...createPreviewPlayInfo(targetVideo.preview_url, cacheKey, '完整播放地址解析为空，已回退到预览视频'),
        cookieConfigured: true,
      };
    }

    return createFullPlayInfo(qualities, cacheKey, savedFid);
  } catch (error) {
    const note = error instanceof Error
      ? `夸克完整播放解析失败，已回退到预览视频：${error.message}`
      : '夸克完整播放解析失败，已回退到预览视频';

    return {
      ...createPreviewPlayInfo(targetVideo.preview_url, cacheKey, note),
      cookieConfigured: true,
    };
  }
}
