// src/app/api/cases/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCase, getEvidence, getAuditLogs, deleteCase } from "@/lib/firestore";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const caseData = await getCase(id);
    if (!caseData) return NextResponse.json({ detail: "Case not found" }, { status: 404 });

    const evidence = await getEvidence(id);
    const audit_logs = await getAuditLogs(id);

    return NextResponse.json({ ...caseData, evidence, audit_logs });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const caseData = await getCase(id);
    if (!caseData) return NextResponse.json({ detail: "Case not found" }, { status: 404 });

    await deleteCase(id);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
