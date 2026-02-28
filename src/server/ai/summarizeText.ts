interface SummarizeTextInput {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  text: string;
}

interface ChatCompletionMessage {
  content?: unknown;
}

interface ChatCompletionChoice {
  message?: ChatCompletionMessage;
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getSummaryContent(payload: unknown): string {
  const content = (
    payload as Partial<ChatCompletionResponse> | null
  )?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Invalid summarize response: missing content');
  }
  return content.trim();
}

export async function summarizeText(input: SummarizeTextInput): Promise<string> {
  const baseUrl = normalizeBaseUrl(input.apiBaseUrl);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            '你是中文摘要助手。请输出简洁中文摘要，格式：先给一行 TL;DR，再给 3-5 条要点。',
        },
        {
          role: 'user',
          content: input.text,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Summarize API failed: ${response.status} ${detail}`.trim());
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return getSummaryContent(payload);
}

