const SOP_API_BASE_URL =
  'https://qeuotsyweqbkkeygkdii.supabase.co/functions/v1/quote-builder-api';

const SOP_API_KEY = import.meta.env.VITE_SOP_QUOTE_API_KEY;

export interface SopJob {
  id: string;
  job_number?: string;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  client_location?: string;
  service_type?: string;
  status?: string;
  current_stage?: string;
}

export interface SopStage {
  form_data?: Record<string, unknown>;
  status?: string;
}

export interface SopJobResponse {
  job: SopJob;
  stages: Record<string, SopStage | null>;
}

async function sopRequest<T>(
  jobId: string,
  options: RequestInit = {},
): Promise<T> {
  if (!SOP_API_KEY) {
    throw new Error('SOP API key is not configured.');
  }

  const response = await fetch(
    `${SOP_API_BASE_URL}?job_id=${encodeURIComponent(jobId)}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SOP_API_KEY,
        ...(options.headers || {}),
      },
    },
  );

  const text = await response.text();

  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data
        ? String((data as { error: unknown }).error)
        : `SOP API request failed (${response.status})`;

    throw new Error(message);
  }

  return data as T;
}

export async function getSopJob(
  jobId: string,
): Promise<SopJobResponse> {
  return sopRequest<SopJobResponse>(jobId, {
    method: 'GET',
  });
}

export interface SopQuoteLineItem {
  id: string;
  type: 'material';
  description: string;
  qty: number;
  unit_price: number;
  markup_pct: number;
}

export interface SopQuotePayload {
  type: 'quote';
  quote_ref: string;
  quote_amount: number;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  currency: string;
  validity: string;
  terms: string;
  line_items: SopQuoteLineItem[];
}

export async function sendQuoteToSop(
  jobId: string,
  payload: SopQuotePayload,
) {
  return sopRequest<{
    success: boolean;
    type: 'quote';
    stage_id: string;
  }>(jobId, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}