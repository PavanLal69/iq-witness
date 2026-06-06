// src/app/api/cases/load-demo/route.ts
// Seeds a demo case into Firebase Firestore for evaluation purposes

import { NextRequest, NextResponse } from "next/server";
import { createCase, saveTimelineEvents, saveEntities, addAuditLog } from "@/lib/firestore";

export async function POST(_req: NextRequest) {
  try {
    const caseId = await createCase(
      "Case Alpha: Altercation at Warehouse 4",
      "Investigation into a physical altercation and vehicle theft reported at Warehouse 4 on the afternoon of June 6, 2026, involving John Doe and Mark Smith.",
      "Active"
    );

    // Demo timeline events
    const events = [
      {
        timestamp: "2026-06-06T16:00:00.000Z",
        title: "Initial Alarm Triggered — Perimeter Sensor 3",
        description: "Motion sensor along the east perimeter triggered by an unidentified individual entering via the rear access gate.",
        location: "Warehouse 4 – East Perimeter",
        event_type: "surveillance",
        confidence: 0.97
      },
      {
        timestamp: "2026-06-06T16:05:00.000Z",
        title: "Chat Message from Mark Smith",
        description: "Mark Smith: \"It's done. Come through the back.\" [SUSPICIOUS]",
        location: undefined,
        event_type: "chat_suspicious",
        confidence: 1.0
      },
      {
        timestamp: "2026-06-06T16:12:00.000Z",
        title: "Physical Confrontation — Loading Bay",
        description: "Security footage shows two individuals engaged in an altercation near the forklift bay. Subject 1 (John Doe) strikes Subject 2 before fleeing on foot.",
        location: "Warehouse 4 – Loading Bay",
        event_type: "surveillance",
        confidence: 0.91
      },
      {
        timestamp: "2026-06-06T16:20:00.000Z",
        title: "Vehicle Sighted — Toyota Prius (ABC-1234)",
        description: "A silver Toyota Prius with partial plates ABC-1234 exits the compound at high speed through the main gate.",
        location: "Warehouse 4 – Main Gate",
        event_type: "surveillance",
        confidence: 0.85
      },
      {
        timestamp: "2026-06-06T16:35:00.000Z",
        title: "Officer Green Audio Statement",
        description: "Officer Green: \"I arrived on scene at approximately 16:35. The victim was found near the loading bay.\"",
        location: "Warehouse 4",
        event_type: "audio_recording",
        confidence: 0.90
      }
    ];
    await saveTimelineEvents(caseId, events);

    // Demo entities and relationships
    const entities = [
      { name: "John Doe", type: "person" as const, details: "Primary suspect in altercation." },
      { name: "Mark Smith", type: "person" as const, details: "Second individual. Sent suspicious message." },
      { name: "Officer Green", type: "person" as const, details: "First responding officer." },
      { name: "Toyota Prius ABC-1234", type: "vehicle" as const, details: "Vehicle seen leaving the scene." },
      { name: "Warehouse 4", type: "location" as const, details: "Incident location." },
    ];

    const relationships = [
      { source_name: "John Doe", target_name: "Mark Smith", relation_type: "conspired_with", details: "Evidence suggests coordination between the two." },
      { source_name: "John Doe", target_name: "Toyota Prius ABC-1234", relation_type: "fled_in", details: "Suspected to have used this vehicle to flee." },
      { source_name: "John Doe", target_name: "Warehouse 4", relation_type: "located_at", details: "Observed at this location during the incident." },
      { source_name: "Mark Smith", target_name: "Warehouse 4", relation_type: "located_at", details: "Present at the incident location." },
    ];

    await saveEntities(caseId, entities, relationships);

    await addAuditLog(caseId, "Demo Case Loaded", "Seeded demo case with pre-built timeline and entities.", "System");

    const now = new Date().toISOString();
    return NextResponse.json({
      id: caseId,
      title: "Case Alpha: Altercation at Warehouse 4",
      description: "Investigation into a physical altercation and vehicle theft.",
      status: "Active",
      created_at: now,
      updated_at: now
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
