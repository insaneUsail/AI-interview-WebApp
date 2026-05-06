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

export async function POST(request: Request) {
  const body = await request.json();

  console.log("VAPI BODY:", body);

  const data =
    body?.message?.toolCallList?.[0]?.function?.arguments || body;

  const {
    role,
    level,
    techstack,
    amount,
    type,
    userid,
  } = data;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: `Prepare ${amount} interview questions.

Role: ${role}
Level: ${level}
Tech stack: ${techstack}
Focus: ${type}

Return ONLY a valid JSON array like:
["Question 1", "Question 2", "Question 3"]

No explanation. No extra text.`,
        },
      ],
      temperature: 0.5,
    });

    const text = completion.choices[0]?.message?.content || "";

    console.log("GROQ RESPONSE:", text);

    const questions = JSON.parse(text);

    const interview = {
      role,
      type,
      level,
      techstack: techstack
        .split(",")
        .map((t: string) => t.trim()),
      questions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    return Response.json(
      {
        success: true,
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