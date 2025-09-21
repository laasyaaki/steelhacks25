import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Analysis from '@/models/Analysis';

export async function GET() {
  await dbConnect();
  try {
    const analyses = await Analysis.find({});
    return NextResponse.json({ success: true, data: analyses });
  } catch (error) {
    if (error instanceof Error) {
        return NextResponse.json({ success: false, error: error.message }, 500);
    }
    return NextResponse.json({ success: false, error: 'An unknown error occurred' }, 500);
  }
}

export async function POST(request: Request) {
  await dbConnect();
  try {
    const body = await request.json();
    const analysis = await Analysis.create(body);
    return NextResponse.json({ success: true, data: analysis }, 201);
  } catch (error) {
    if (error instanceof Error) {
        return NextResponse.json({ success: false, error: error.message }, 400);
    }
    return NextResponse.json({ success: false, error: 'An unknown error occurred' }, 400);
  }
}
