import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend';

// Lightweight probe the client uses to tell "signed in and allowed" (200) apart
// from "signed in but not on the allowlist" (403). It hits a trivial backend
// endpoint purely to exercise the same auth + allowlist path the real calls use.
export async function GET() {
  const response = await backendFetch('/api/measures');
  return new NextResponse(null, { status: response.ok ? 200 : response.status });
}
