// Calls OpenRouter using a free-tier model only (":free" suffix) so this
// feature never costs anything. Requires OPENROUTER_API_KEY as an env var —
// get one free at https://openrouter.ai/keys.

const FREE_MODEL = "meta-llama/llama-3.1-8b-instruct:free";

async function callOpenRouter(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set — add a free key from openrouter.ai/keys");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: FREE_MODEL,
      messages,
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenRouter response had no message content");
  }
  return content;
}

export async function generateIntention(topicNames: string[]): Promise<string> {
  const content = await callOpenRouter([
    {
      role: "system",
      content:
        "You write a single short, warm, human daily study intention for a med student studying for USMLE Step 1. " +
        "One or two sentences. Name the topics naturally. Encouraging like a smart friend, never cheesy, never corporate, no emoji, no hashtags.",
    },
    {
      role: "user",
      content: `Today's topics: ${topicNames.join(", ")}. Write today's intention.`,
    },
  ]);
  return content.trim();
}

export interface QuizQuestion {
  topic: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export async function generateQuiz(topicNames: string[]): Promise<QuizQuestion[]> {
  const content = await callOpenRouter([
    {
      role: "system",
      content:
        "You write USMLE Step 1 style multiple-choice self-check questions. " +
        "Respond with ONLY valid JSON: an array of objects with fields " +
        '"topic" (must exactly match one of the given topic names), "question", ' +
        '"choices" (array of 4 strings), "correctIndex" (0-3), "explanation" (1-2 sentences). ' +
        "No markdown, no prose outside the JSON array.",
    },
    {
      role: "user",
      content: `Write 2 questions for EACH of these topics, covering only these topics: ${topicNames.join(
        ", "
      )}`,
    },
  ]);

  const jsonStart = content.indexOf("[");
  const jsonEnd = content.lastIndexOf("]");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Could not find a JSON array in the quiz response");
  }
  const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
  if (!Array.isArray(parsed)) {
    throw new Error("Quiz response was not an array");
  }
  return parsed as QuizQuestion[];
}
