export async function chatWithOpenRouter(
  model: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.origin, // Optional, for including your app on openrouter.ai rankings.
          "X-Title": "MOSP Chat", // Optional. Shows in rankings on openrouter.ai.
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenRouter API error: ${response.status} ${response.statusText} - ${errorData.error?.message || ""}`,
      );
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    if (!reader) {
      throw new Error("No response body");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line === "data: [DONE]") continue;
        if (line.startsWith("data: ")) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.choices && json.choices.length > 0) {
              const content = json.choices[0].delta?.content || "";
              if (content) {
                fullResponse += content;
                onChunk?.(content);
              }
            }
          } catch (e) {
            console.error("Error parsing OpenRouter chunk", e);
          }
        }
      }
    }

    return fullResponse;
  } catch (error) {
    console.error("OpenRouter chat error:", error);
    throw error;
  }
}

export async function fetchOpenRouterModels(): Promise<string[]> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data.map((model: any) => model.id).sort();
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error);
    return [];
  }
}
