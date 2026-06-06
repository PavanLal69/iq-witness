// src/app/api/cases/[id]/entities/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCase, getEntities, getRelationships } from "@/lib/firestore";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const caseData = await getCase(id);
    if (!caseData) return NextResponse.json({ detail: "Case not found" }, { status: 404 });

    const entities = await getEntities(id);
    const relationships = await getRelationships(id);

    // Format into graph-compatible shape (matching previous FastAPI response)
    const nodes = entities.map(e => ({
      id: e.id,
      label: e.name,
      type: e.type,
      details: e.details
    }));

    const links = relationships.map(r => ({
      id: `rel_${r.id}`,
      source: r.source_id,
      target: r.target_id,
      label: r.relation_type,
      details: r.details
    }));

    return NextResponse.json({ nodes, links });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
