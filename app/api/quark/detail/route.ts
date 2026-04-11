import { NextRequest, NextResponse } from 'next/server';
import { parseQuarkShareUrl, QUARK_SHARE_SOURCE_ID } from '@/lib/quark/share-link';

export const runtime = 'edge';

const QUARK_SHARE_HOST = 'https://drive-h.quark.cn';
const DEFAULT_PAGE_SIZE = 100;
const MAX_AUTO_DESCEND_DEPTH = 2;
const MAX_CHILDREN_TO_SCAN = 6;
const USER_AGENT = 'Mozilla/5.0';

interface QuarkTokenResponse {
  code: number;
  message?: string;
  data?: {
    stoken?: string;
    title?: string;
  };
}

interface QuarkListItem {
  fid: string;
  file_name: string;
  dir?: boolean;
  file?: boolean;
  category?: number;
  format_type?: string;
  preview_url?: string;
  thumbnail?: string;
  big_thumbnail?: string;
}

interface QuarkDetailResponse {
  code: number;
  message?: string;
  data?: {
    list?: QuarkListItem[];
  };
}

interface ResolvedDirectory {
  dirId: string;
  titleTrail: string[];
  items: QuarkListItem[];
}

function getRequestHeaders() {
  return {
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
    'Referer': 'https://pan.quark.cn/',
  };
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json() as T & { code?: number; message?: string };

  if (!response.ok) {
    throw new Error((data as { message?: string }).message || `HTTP ${response.status}`);
  }

  return data;
}

async function fetchShareToken(shareId: string): Promise<{ stoken: string; title: string }> {
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

async function fetchShareDetail(shareId: string, stoken: string, dirId: string): Promise<QuarkListItem[]> {
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
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://pan.quark.cn/',
      },
    },
  );

  if (response.code !== 0) {
    throw new Error(response.message || '获取夸克分享目录失败');
  }

  return response.data?.list || [];
}

function getPlayableVideos(items: QuarkListItem[]): QuarkListItem[] {
  return items.filter((item) =>
    Boolean(item.preview_url) &&
    item.dir !== true &&
    (item.category === 1 || item.format_type?.startsWith('video/')),
  );
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

  if (directories.length === 0) {
    return null;
  }

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

async function resolveQuarkVideos(rawUrl: string) {
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

  return {
    vod_id: parsed.normalizedUrl,
    vod_name: resolvedTitle,
    vod_pic: cover,
    vod_content: content,
    vod_remarks: `夸克网盘 · ${videos.length} 个视频`,
    type_name: '夸克网盘',
    episodes: videos.map((video, index) => ({
      name: video.file_name,
      url: video.preview_url!,
      index,
    })),
    source: QUARK_SHARE_SOURCE_ID,
    source_code: resolved.dirId,
  };
}

async function handleRequest(rawUrl: string | null) {
  if (!rawUrl) {
    return NextResponse.json(
      { success: false, error: 'Missing url parameter' },
      { status: 400 },
    );
  }

  try {
    const data = await resolveQuarkVideos(rawUrl);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '解析夸克分享失败';
    const status = message.includes('无效') || message.includes('Missing') ? 400 : 502;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request.nextUrl.searchParams.get('url'));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return handleRequest(body?.url ?? null);
}
