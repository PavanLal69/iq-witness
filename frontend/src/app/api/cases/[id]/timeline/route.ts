// src/app/api/cases/[id]/timeline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCase, getTimeline } from "@/lib/firestore";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const caseData = await getCase(id);
    if (!caseData) return NextResponse.json({ detail: "Case not found" }, { status: 404 });

    const events = await getTimeline(id);
    return NextResponse.json(events);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
