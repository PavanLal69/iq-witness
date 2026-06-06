// src/app/api/cases/[id]/process/route.ts
// Reads uploaded evidence from Firebase Storage, extracts text,
// builds timeline events and entities, saves them to Firestore.

import { NextRequest, NextResponse } from "next/server";
import { getCase, getEvidence, saveTimelineEvents, saveEntities, addAuditLog } from "@/lib/firestore";
import { extractEntitiesAndRelationships, buildTimelineFromText } from "@/lib/entityExtractor";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const caseData = await getCase(id);
    if (!caseData) return NextResponse.json({ detail: "Case not found" }, { status: 404 });

    const evidenceList = await getEvidence(id);
    if (evidenceList.length === 0) {
      return NextResponse.json({ status: "success", message: "No evidence to process.", events_created: 0 });
    }

    let combinedText = `Case: ${caseData.title}\n${caseData.description || ""}\n\n`;
    const allEvents: any[] = [];

    // Process each evidence file — fetch its text content from URL
    for (const ev of evidenceList) {
      try {
        let extractedText = "";

        // For text-based files, fetch and read from Storage URL
        if (["txt", "chat", "pdf", "docx", "csv"].includes(ev.file_type)) {
          const res = await fetch(ev.file_url);
          if (res.ok) {
            extractedText = await res.text();
          }
        } else {
          // For binary files (video/audio/image), use filename + type as context
          extractedText = `[${ev.file_type.toUpperCase()} FILE] ${ev.filename} — Binary media content uploaded.`;
        }

        combinedText += `\n\n--- Evidence: ${ev.filename} ---\n${extractedText}`;

        // Build timeline events from this file's content
        const events = buildTimelineFromText(ev.filename, ev.file_type, extractedText);
        allEvents.push(...events);
      } catch (e) {
        console.error(`Failed to process evidence ${ev.filename}:`, e);
      }
    }

    // Sort events by timestamp
    allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Save timeline events to Firestore
    await saveTimelineEvents(id, allEvents);

    // Extract entities and relationships from combined text
    const { entities, relationships } = extractEntitiesAndRelationships(combinedText);

    // Save entities to Firestore
    await saveEntities(id, entities, relationships);

    // Audit log
    await addAuditLog(
      id,
      "Incident Reconstruction Completed",
      `Processed ${evidenceList.length} evidence files. Reconstructed ${allEvents.length} timeline events and extracted ${entities.length} entities.`,
      "WitnessIQ Engine"
    );

    return NextResponse.json({
      status: "success",
      message: "Timeline and entities reconstructed successfully.",
      events_created: allEvents.length,
      entities_created: entities.length,
      relationships_created: relationships.length
    });
  } catch (err: any) {
    console.error("Processing error:", err);
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
