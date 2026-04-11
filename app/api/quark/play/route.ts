import { NextRequest, NextResponse } from 'next/server';
import { resolveQuarkPlayInfo } from '@/lib/quark/api';

export const runtime = 'edge';

async function handleRequest(rawUrl: string | null, fid: string | null, cookie: string | null, savedFid: string | null) {
  if (!rawUrl || !fid) {
    return NextResponse.json(
      { success: false, error: 'Missing url or fid parameter' },
      { status: 400 },
    );
  }

  try {
    const data = await resolveQuarkPlayInfo(rawUrl, fid, cookie, savedFid);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取夸克播放地址失败';
    const status = message.includes('无效') || message.includes('Missing') ? 400 : 502;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  return handleRequest(
    searchParams.get('url'),
    searchParams.get('fid'),
    searchParams.get('cookie'),
    searchParams.get('savedFid'),
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return handleRequest(body?.url ?? null, body?.fid ?? null, body?.cookie ?? null, body?.savedFid ?? null);
}
