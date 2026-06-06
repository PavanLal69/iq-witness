// src/app/api/cases/[id]/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCase, uploadEvidenceFile } from "@/lib/firestore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const caseData = await getCase(id);
    if (!caseData) return NextResponse.json({ detail: "Case not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ detail: "No file provided" }, { status: 400 });

    const evidence = await uploadEvidenceFile(id, file);
    return NextResponse.json(evidence, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
