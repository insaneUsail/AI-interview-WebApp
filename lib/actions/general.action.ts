"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

import Groq from "groq-sdk";


const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("No valid JSON found in response");
    }

    return JSON.parse(match[0]);
  }
}

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    console.log("FORMATTED TRANSCRIPT:", formattedTranscript);

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",

      messages: [
        {
          role: "system",
          content:
            "You are a professional AI interviewer. Return ONLY valid JSON. No markdown. No explanation.",
        },

        {
          role: "user",
          content: `
Analyze this mock interview transcript carefully.

Transcript:
${formattedTranscript}

Return ONLY valid JSON in this exact format:

{
  "totalScore": 75,
  "categoryScores": [
    {
      "name": "Communication Skills",
      "score": 80,
      "comment": "Candidate communicated clearly with structured responses."
    },
    {
      "name": "Technical Knowledge",
      "score": 70,
      "comment": "Candidate showed moderate technical understanding."
    },
    {
      "name": "Problem-Solving",
      "score": 72,
      "comment": "Candidate approached problems logically."
    },
    {
      "name": "Cultural & Role Fit",
      "score": 78,
      "comment": "Candidate aligns reasonably well with the role."
    },
    {
      "name": "Confidence & Clarity",
      "score": 74,
      "comment": "Candidate sounded fairly confident."
    }
  ],
  "strengths": [
    "Clear communication",
    "Good understanding of concepts"
  ],
  "areasForImprovement": [
    "Need deeper technical explanations",
    "Use more real-world examples"
  ],
  "finalAssessment": "The candidate performed reasonably well overall but should improve technical depth and practical examples."
}

Do not include markdown.
Do not include explanation.
Return ONLY JSON.
`,
        },
      ],

      temperature: 0.4,
    });

    const text = completion.choices[0]?.message?.content || "";

    console.log("GROQ FEEDBACK RESPONSE:", text);

    const object = extractJson(text);

    const feedback = {
      interviewId,
      userId,

      totalScore: object.totalScore,

      categoryScores: object.categoryScores,

      strengths: object.strengths,

      areasForImprovement: object.areasForImprovement,

      finalAssessment: object.finalAssessment,

      createdAt: new Date().toISOString(),
    };

    let feedbackRef;

    if (feedbackId) {
      feedbackRef = db.collection("feedback").doc(feedbackId);
    } else {
      feedbackRef = db.collection("feedback").doc();
    }

    await feedbackRef.set(feedback);

    console.log("FEEDBACK SAVED SUCCESSFULLY");

    return {
      success: true,
      feedbackId: feedbackRef.id,
    };
  } catch (error) {
    console.error("ERROR SAVING FEEDBACK:", error);

    return {
      success: false,
    };
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const interview = await db.collection("interviews").doc(id).get();

  return interview.data() as Interview | null;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  const querySnapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;

  const feedbackDoc = querySnapshot.docs[0];
  return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  const interviews = await db
    .collection("interviews")
    .orderBy("createdAt", "desc")
    .where("finalized", "==", true)
    .where("userId", "!=", userId)
    .limit(limit)
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  const interviews = await db
    .collection("interviews")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}
