// import { generateText } from "ai";
// import { google } from "@ai-sdk/google";

// import { db } from "@/firebase/admin";
// import { getRandomInterviewCover } from "@/lib/utils";

// export async function POST(request: Request) {
//   const { type, role, level, techstack, amount, userid } = await request.json();

//   try {
//     const { text: questions } = await generateText({
//       model: google("gemini-2.0-flash-lite"),
//       prompt: `Prepare questions for a job interview.
//         The job role is ${role}.
//         The job experience level is ${level}.
//         The tech stack used in the job is: ${techstack}.
//         The focus between behavioural and technical questions should lean towards: ${type}.
//         The amount of questions required is: ${amount}.
//         Please return only the questions, without any additional text.
//         The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
//         Return the questions formatted like this:
//         ["Question 1", "Question 2", "Question 3"]

//         Thank you! <3
//     `,
//     });

//     const interview = {
//       role: role,
//       type: type,
//       level: level,
//       techstack: techstack.split(","),
//       questions: JSON.parse(questions),
//       userId: userid,
//       finalized: true,
//       coverImage: getRandomInterviewCover(),
//       createdAt: new Date().toISOString(),
//     };

//     await db.collection("interviews").add(interview);

//     return Response.json({ success: true }, { status: 200 });
//   } catch (error) {
//     console.error("Error:", error);
//     return Response.json({ success: false, error: error }, { status: 500 });
//   }
// }

// export async function GET() {
//   return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
// }


import Groq from "groq-sdk";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

function safeJsonParse(value: any) {
  if (!value) return {};

  if (typeof value === "object") {
    return value;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  return {};
}

function normalizeTechstack(techstack: any): string[] {
  if (Array.isArray(techstack)) {
    return techstack.map((t) => String(t).trim()).filter(Boolean);
  }

  if (typeof techstack === "string") {
    return techstack
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return [];
}

function extractJsonArray(text: string): string[] {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);

    if (!match) {
      throw new Error("Groq did not return a valid JSON array");
    }

    return JSON.parse(match[0]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log("VAPI BODY:", JSON.stringify(body, null, 2));

    const toolCalls =
      body?.message?.toolCallList ||
      body?.message?.toolCalls ||
      [];

    const toolCallId = toolCalls?.[0]?.id;

    const rawArgs =
      toolCalls?.[0]?.function?.arguments ||
      body;

    const data = safeJsonParse(rawArgs);

    const role = data.role || "Software Developer";
    const level = data.level || "entry";
    const techstackRaw = data.techstack || "JavaScript, Node.js";
    const amount = Number(data.amount) || 5;
    const type = data.type || "technical";
    const userid = data.userid || data.userId || "anonymous-user";

    const techstackArray = normalizeTechstack(techstackRaw);
    const techstackText = techstackArray.join(", ");

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: `Prepare ${amount} interview questions.

Role: ${role}
Level: ${level}
Tech stack: ${techstackText}
Focus: ${type}

Return ONLY a valid JSON array like:
["Question 1", "Question 2", "Question 3"]

No markdown. No explanation. No extra text.`,
        },
      ],
      temperature: 0.5,
    });

    const text = completion.choices[0]?.message?.content || "";

    console.log("GROQ RESPONSE:", text);

    const questions = extractJsonArray(text);

    const interview = {
      role,
      type,
      level,
      techstack: techstackArray,
      questions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    const docRef = await db.collection("interviews").add(interview);

    /**
     * This part is important for Vapi.
     * If this request came from a Vapi tool call,
     * return results with toolCallId.
     */
    if (toolCallId) {
      return Response.json(
        {
          results: [
            {
              toolCallId,
              result: `Interview questions generated successfully.

Interview ID: ${docRef.id}

Here are the questions:

${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}

Now start the interview. Ask question 1 only.`,
            },
          ],
        },
        { status: 200 }
      );
    }

    /**
     * This fallback is for Postman/browser/local testing.
     */
    return Response.json(
      {
        success: true,
        interviewId: docRef.id,
        questions,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Full Error:", error);

    return Response.json(
      {
        success: false,
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json(
    {
      success: true,
      data: "Groq API working",
    },
    { status: 200 }
  );
}