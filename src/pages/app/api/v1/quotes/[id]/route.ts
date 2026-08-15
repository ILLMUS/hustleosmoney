// app/api/v1/quotes/[id]/route.ts
import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/integration/auth';
import { CanonicalSerializer } from '@/lib/integration/serializer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Safely resolve route params across Next.js versions
    const resolvedParams = await params;
    const quoteId = resolvedParams.id;

    // 1. Extract API Key from request headers
    const apiKey =
      req.headers.get('x-api-key') ||
      req.headers.get('authorization')?.replace('Bearer ', '');

    // 2. Validate API Key and check for 'quotes.read' scope
    const { error: authError, auth } = await authenticateApiKey(
      apiKey,
      'quotes.read',
      supabaseAdmin
    );

    if (authError || !auth) {
      return NextResponse.json(
        { error: authError || 'Unauthorized: Invalid or missing API Key.' },
        { status: 401 }
      );
    }

    // 3. Fetch quote document from 'documents' table matching quote ID & user ID
    const { data: doc, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', quoteId)
      .eq('user_id', auth.user_id)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Quote not found or access denied.' },
        { status: 404 }
      );
    }

    // 4. Fetch linked external metadata (e.g. Business OS Opportunity ID)
    const { data: extRef } = await supabaseAdmin
      .from('quote_external_references')
      .select('*')
      .eq('document_id', doc.id)
      .maybeSingle();

    // 5. Transform database record into standard canonical JSON
    const canonicalQuote = CanonicalSerializer.toCanonical(doc, extRef);

    return NextResponse.json({
      success: true,
      data: canonicalQuote,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}