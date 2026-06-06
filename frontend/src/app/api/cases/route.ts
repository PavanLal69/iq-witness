// src/app/api/cases/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCases, createCase } from "@/lib/firestore";

export async function GET() {
  try {
    const cases = await getCases();
    return NextResponse.json(cases);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description = "", status = "Active" } = body;
    if (!title) return NextResponse.json({ detail: "Title is required" }, { status: 400 });

    const id = await createCase(title, description, status);
    const now = new Date().toISOString();
    return NextResponse.json({ id, title, description, status, created_at: now, updated_at: now }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
