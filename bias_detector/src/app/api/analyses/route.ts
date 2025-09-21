import { NextResponse } from 'next/server';
import { admin, firestore } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Error verifying ID token:", error); // Log the error
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const analysesCollection = firestore.collection('users').doc(uid).collection('analyses');
    const snapshot = await analysesCollection.orderBy('createdAt', 'desc').get();
    const analyses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ success: true, data: analyses }); // Default status 200 is fine
  } catch (error) {
    console.error("API GET /api/analyses error:", error); // Log the error
    if (error instanceof Error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: 'An unknown error occurred' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log("POST /api/analyses entered"); // Added log
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authorization.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Error verifying ID token in POST:", error); // Log the error
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const body = await request.json();
    const { url, biasScore, justification, title } = body; // Destructure relevant fields

    const analysesCollection = firestore.collection('users').doc(uid).collection('analyses');

    // Check if an analysis with the same URL already exists for this user
    const existingAnalyses = await analysesCollection.where('url', '==', url).get();

    if (!existingAnalyses.empty) {
      // If an existing analysis is found, update it
      const docToUpdate = existingAnalyses.docs[0];
      const updateData: { [key: string]: any } = {
        biasScore,
        justification,
        createdAt: admin.firestore.FieldValue.serverTimestamp(), // Update timestamp
      };
      if (title !== undefined) {
        updateData.title = title;
      }
      await docToUpdate.ref.update(updateData);
      return NextResponse.json({ success: true, data: { id: docToUpdate.id, ...body } }, { status: 200 }); // Return 200 for update
    } else {
      // If no existing analysis, add a new one
      const addData: { [key: string]: any } = {
        url,
        biasScore,
        justification,
        userId: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (title !== undefined) {
        addData.title = title;
      }
      const docRef = await analysesCollection.add(addData);
      return NextResponse.json({ success: true, data: { id: docRef.id, ...body } }, { status: 201 });
    }
  } catch (error) {
    console.error("API POST /api/analyses error:", error); // Log the error directly
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}