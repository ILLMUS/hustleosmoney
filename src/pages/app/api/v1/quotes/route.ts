// app/api/v1/quotes/route.ts
import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/integration/auth';
import { CanonicalSerializer } from '@/lib/integration/serializer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { CreateQuoteInput } from '@/types/integration';

export async function POST(req: Request) {
  try {
    // 1. Extract API Key from request headers
    const apiKey =
      req.headers.get('x-api-key') ||
      req.headers.get('authorization')?.replace('Bearer ', '');

    // 2. Validate API key and required scope ('quotes.create')
    const { error: authError, auth } = await authenticateApiKey(
      apiKey,
      'quotes.create',
      supabaseAdmin
    );

    if (authError || !auth) {
      return NextResponse.json(
        { error: authError || 'Unauthorized: Invalid or missing API Key.' },
        { status: 401 }
      );
    }

    // 3. Parse and validate body
    const body: CreateQuoteInput = await req.json();

    if (!body.customer?.name || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Validation Error: Customer name and line items are required.' },
        { status: 400 }
      );
    }

    // 4. Generate unique Quote Number
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const quoteNumber = `QUO-${year}-${randomSuffix}`;

    // 5. Transform external canonical payload into Quote Builder's internal document structure
    const internalDocPayload = CanonicalSerializer.toInternalDocument(
      body,
      auth.user_id,
      quoteNumber
    );

    // 6. Insert new quote record into 'documents' table
    const { data: newDoc, error: docError } = await supabaseAdmin
      .from('documents')
      .insert([internalDocPayload])
      .select('*')
      .single();

    if (docError || !newDoc) {
      return NextResponse.json(
        { error: 'Failed to create quote record in database.', details: docError },
        { status: 500 }
      );
    }

    // 7. Store external reference (e.g. Business OS Opportunity ID) if provided
    let extRefData = null;
    if (body.external_reference?.system && body.external_reference?.record_id) {
      const { data: ref } = await supabaseAdmin
        .from('quote_external_references')
        .insert([
          {
            document_id: newDoc.id,
            external_system: body.external_reference.system,
            external_record_type: body.external_reference.record_type,
            external_record_id: body.external_reference.record_id,
            metadata: body.external_reference.metadata || {},
          },
        ])
        .select('*')
        .single();

      extRefData = ref;
    }

    // 8. Convert internal doc back into standard canonical response
    const canonicalResponse = CanonicalSerializer.toCanonical(newDoc, extRefData);

    return NextResponse.json(
      { success: true, data: canonicalResponse },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}