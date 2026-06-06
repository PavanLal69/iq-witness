// src/app/api/cases/[id]/relationships/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCase, createRelationship } from "@/lib/firestore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const caseData = await getCase(id);
    if (!caseData) return NextResponse.json({ detail: "Case not found" }, { status: 404 });

    const body = await req.json();
    const { source_id, target_id, relation_type, details } = body;

    if (!source_id || !target_id || !relation_type) {
      return NextResponse.json({ detail: "source_id, target_id and relation_type are required" }, { status: 400 });
    }

    const rel = await createRelationship(id, String(source_id), String(target_id), relation_type, details);
    return NextResponse.json(rel, { status: 201 });
  } catch (err: any) {
    const status = err.message.includes("already exists") ? 400 : 500;
    return NextResponse.json({ detail: err.message }, { status });
  }
}
