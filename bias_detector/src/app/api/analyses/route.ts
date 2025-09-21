import { NextResponse } from "next/server";
import { admin, firestore } from "@/lib/firebase-admin";

type EvidenceItem = { quote: string; section: string };
type JustificationSection = { summary: string; evidence: EvidenceItem[] };
type Justification = {
  sampleRepresentation: JustificationSection;
  inclusionInAnalysis: JustificationSection;
  studyOutcomes: JustificationSection;
  methodologicalFairness: JustificationSection;
};

function toFirestoreTimestampJSON(ts: any) {
  if (
    ts &&
    typeof ts.seconds === "number" &&
    typeof ts.nanoseconds === "number"
  ) {
    return { _seconds: ts.seconds, _nanoseconds: ts.nanoseconds };
  }
  if (
    ts &&
    typeof ts._seconds === "number" &&
    typeof ts._nanoseconds === "number"
  ) {
    return { _seconds: ts._seconds, _nanoseconds: ts._nanoseconds };
  }
  return null;
}

function assertAuth(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }
  const idToken = authorization.split("Bearer ")[1];
  return { idToken };
}

export async function GET(request: Request) {
  try {
    const auth = assertAuth(request);
    if ("error" in auth) return auth.error;

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(auth.idToken!);
    } catch (error) {
      console.error("Error verifying ID token:", error);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const uid = decodedToken.uid;
    const analysesCollection = firestore
      .collection("users")
      .doc(uid)
      .collection("analyses");
    const snapshot = await analysesCollection
      .orderBy("createdAt", "desc")
      .get();

    const analyses = snapshot.docs.map((doc: { data: () => any; id: any }) => {
      const data = doc.data() as any;
      const createdAt = toFirestoreTimestampJSON(data.createdAt);
      return {
        id: doc.id,
        url: data.url,
        title: data.title ?? null,
        biasScore: String(data.biasScore),
        biasMeaning: data.biasMeaning ?? null,
        justification: data.justification ?? null,
        createdAt,
      };
    });

    return NextResponse.json({ success: true, data: analyses });
  } catch (error) {
    console.error("API GET /api/analyses error:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { success: false, error: "An unknown error occurred" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  console.log("POST /api/analyses entered");
  try {
    const auth = assertAuth(request);
    if ("error" in auth) return auth.error;

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(auth.idToken!);
    } catch (error) {
      console.error("Error verifying ID token in POST:", error);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const uid = decodedToken.uid;
    const body = await request.json();

    const {
      url,
      title,
      biasScore,
      biasMeaning,
      justification,
    }: {
      url: string;
      title?: string;
      biasScore: string;
      biasMeaning: string;
      justification: Justification;
    } = body;

    // Basic validation to avoid bad writes
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "url is required" },
        { status: 400 },
      );
    }
    if (typeof biasScore !== "string") {
      return NextResponse.json(
        { success: false, error: "biasScore must be a string" },
        { status: 400 },
      );
    }
    if (!biasMeaning || typeof biasMeaning !== "string") {
      return NextResponse.json(
        { success: false, error: "biasMeaning is required" },
        { status: 400 },
      );
    }
    if (!justification || typeof justification !== "object") {
      return NextResponse.json(
        { success: false, error: "justification object is required" },
        { status: 400 },
      );
    }

    const analysesCollection = firestore
      .collection("users")
      .doc(uid)
      .collection("analyses");

    // Check if an analysis with the same URL already exists for this user
    const existing = await analysesCollection
      .where("url", "==", url)
      .limit(1)
      .get();

    if (!existing.empty) {
      // If an existing analysis is found, update it
      const docToUpdate = existing.docs[0];
      const updateData: Record<string, any> = {
        biasScore,
        biasMeaning,
        justification,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (typeof title === "string") updateData.title = title;

      await docToUpdate?.ref.update(updateData);

      return NextResponse.json(
        { success: true, data: { id: docToUpdate?.id } },
        { status: 200 },
      );
    } else {
      const addData: Record<string, any> = {
        url,
        userId: uid,
        biasScore,
        biasMeaning,
        justification,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (typeof title === "string") addData.title = title;

      const docRef = await analysesCollection.add(addData);
      return NextResponse.json(
        { success: true, data: { id: docRef.id } },
        { status: 201 },
      );
    }
  } catch (error) {
    console.error("API POST /api/analyses error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
