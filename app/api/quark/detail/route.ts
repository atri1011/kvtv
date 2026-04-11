import { NextRequest, NextResponse } from 'next/server';
import { resolveQuarkShare } from '@/lib/quark/api';

export const runtime = 'edge';

async function handleRequest(rawUrl: string | null) {
  if (!rawUrl) {
    return NextResponse.json(
      { success: false, error: 'Missing url parameter' },
      { status: 400 },
    );
  }

  try {
    const data = await resolveQuarkShare(rawUrl);
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
