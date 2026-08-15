const SOP_API_BASE_URL =
  'https://qeuotsyweqbkkeygkdii.supabase.co/functions/v1/quote-builder-api';

const SOP_API_KEY =
  import.meta.env.VITE_SOP_QUOTE_API_KEY;

export interface SopJobResponse {
  job?: {
    id: string;
    job_number?: string;
    client?: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
    };
    client_name?: string;
    client_email?: string;
    client_phone?: string;
    client_address?: string;
  };

  [key: string]: unknown;
}

async function sopRequest<T>(
  jobId: string,
  options: RequestInit = {}
): Promise<T> {
  if (!SOP_API_KEY) {
    throw new Error(
      'SOP Quote Builder API key is not configured.'
    );
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
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      errorText || `SOP API request failed (${response.status})`
    );
  }

  return response.json();
}

export async function getSopJob(
  jobId: string
): Promise<SopJobResponse> {
  return sopRequest<SopJobResponse>(jobId, {
    method: 'GET',
  });
}

export async function sendQuoteToSop(
  jobId: string,
  quote: unknown
) {
  return sopRequest(jobId, {
    method: 'POST',
    body: JSON.stringify(quote),
  });
}