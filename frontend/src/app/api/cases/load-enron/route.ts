// src/app/api/cases/load-enron/route.ts
// Seeds the Enron case into Firebase Firestore from backend data

import { NextRequest, NextResponse } from "next/server";
import { createCase, saveTimelineEvents, saveEntities, addAuditLog } from "@/lib/firestore";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(_req: NextRequest) {
  try {
    // Create the case in Firebase
    const caseId = await createCase(
      "Case Beta: Enron Corporation Corporate Fraud",
      "Investigation into Enron Corporation's complex financial fraud, off-balance-sheet debt hiding via Raptor/LJM partnerships, whistleblower reports by Sherron Watkins, and document shredding by Arthur Andersen LLP in late 2001.",
      "Active"
    );

    // Enron timeline events based on actual historical events
    const events = [
      {
        timestamp: "2001-08-14T00:00:00.000Z",
        title: "Jeffrey Skilling Resigns as CEO",
        description: "Jeffrey Skilling suddenly resigns from his position as CEO of Enron Corporation, citing personal reasons. This marks a critical turning point in the company's collapse.",
        location: "Enron Headquarters, Houston",
        event_type: "surveillance",
        confidence: 0.99
      },
      {
        timestamp: "2001-08-15T10:15:00.000Z",
        title: "Sherron Watkins Email to Kenneth Lay",
        description: "Sherron Watkins: \"Kenneth, I am incredibly nervous that we will implode in a wave of accounting scandals. Jeffrey Skilling's resignation is just the start.\"",
        location: undefined,
        event_type: "chat_suspicious",
        confidence: 1.0
      },
      {
        timestamp: "2001-08-20T11:00:00.000Z",
        title: "Whistleblower Memo - Raptor Entities Concern",
        description: "Sherron Watkins submits detailed memo to Kenneth Lay outlining concerns about Raptor entities and LJM partnerships hiding hundreds of millions in debt off Enron's balance sheet.",
        location: "Enron Headquarters, Houston",
        event_type: "document",
        confidence: 0.98
      },
      {
        timestamp: "2001-10-22T09:00:00.000Z",
        title: "SEC Investigator Opens Inquiry",
        description: "SEC Investigator: \"We are launching an official inquiry into Enron's transactions with LJM partnerships and related-party dealings.\"",
        location: "SEC Regional Office",
        event_type: "audio_recording",
        confidence: 0.97
      },
      {
        timestamp: "2001-10-31T14:30:00.000Z",
        title: "Arthur Andersen Partners Meeting",
        description: "Arthur Andersen's Houston office holds emergency meeting. Discussion centers on potential liability and document retention policies. Shredding of Enron-related documents begins.",
        location: "Arthur Andersen LLP, Houston",
        event_type: "audio_recording",
        confidence: 0.92
      },
      {
        timestamp: "2001-11-08T16:00:00.000Z",
        title: "Enron Files for Bankruptcy",
        description: "Enron Corporation files for Chapter 11 bankruptcy protection, becoming the largest corporate bankruptcy in U.S. history at the time with over $63 billion in assets.",
        location: "U.S. Bankruptcy Court, Southern District of Texas",
        event_type: "document",
        confidence: 0.99
      },
      {
        timestamp: "2001-11-09T10:00:00.000Z",
        title: "CCTV - Document Shredding Activity",
        description: "CCTV footage captures significant shredding activity in Arthur Andersen's Houston office. Employees are observed moving boxes of Enron-related documents to a shredding station.",
        location: "Arthur Andersen LLP, Houston",
        event_type: "surveillance",
        confidence: 0.88
      },
      {
        timestamp: "2001-12-02T09:00:00.000Z",
        title: "Enron Stock Price Collapses",
        description: "Enron Corporation's stock price plummets from $83 per share in January to $0.26, wiping out billions in shareholder equity and employee retirement savings.",
        location: "New York Stock Exchange",
        event_type: "document",
        confidence: 0.99
      }
    ];
    await saveTimelineEvents(caseId, events);

    // Enron entities and relationships
    const entities = [
      { name: "Jeffrey Skilling", type: "person" as const, details: "CEO of Enron, resigned August 14, 2001. Key figure in the fraud scheme." },
      { name: "Kenneth Lay", type: "person" as const, details: "Founder and Chairman of Enron. Received whistleblower memo from Sherron Watkins." },
      { name: "Sherron Watkins", type: "person" as const, details: "VP of Corporate Development. Submitted whistleblower memo detailing accounting fraud concerns." },
      { name: "Andrew Fastow", type: "person" as const, details: "CFO of Enron. Architect of LJM partnerships and Raptor entities used to hide debt." },
      { name: "Arthur Andersen LLP", type: "organization" as const, details: "External auditor of Enron. Implicated in document shredding and accounting cover-up." },
      { name: "Enron Corporation", type: "organization" as const, details: "Houston-based energy company. Filed for bankruptcy on November 8, 2001." },
      { name: "Raptor Entities", type: "organization" as const, details: "Special purpose entities created to hide debt and losses off Enron's balance sheet." },
      { name: "LJM Partnerships", type: "organization" as const, details: "Related-party partnerships used to obscure Enron's financial liabilities." },
      { name: "SEC", type: "organization" as const, details: "Securities and Exchange Commission. Opened official inquiry into Enron's accounting practices." },
      { name: "Enron Headquarters, Houston", type: "location" as const, details: "Main office location where fraud planning and accounting manipulation occurred." },
      { name: "Enron Stock (ENE)", type: "asset" as const, details: "Collapsed from $83 per share in January 2001 to $0.26 by December 2001." },
    ];

    const relationships = [
      { source_name: "Jeffrey Skilling", target_name: "Enron Corporation", relation_type: "led", details: "Skilling served as CEO and was instrumental in the fraud scheme." },
      { source_name: "Kenneth Lay", target_name: "Enron Corporation", relation_type: "founded", details: "Lay founded Enron and served as Chairman. Received whistleblower memo." },
      { source_name: "Andrew Fastow", target_name: "Raptor Entities", relation_type: "created", details: "Fastow architected and created the Raptor entities to hide debt." },
      { source_name: "Andrew Fastow", target_name: "LJM Partnerships", relation_type: "managed", details: "Fastow created and managed LJM partnerships for related-party transactions." },
      { source_name: "Sherron Watkins", target_name: "Kenneth Lay", relation_type: "warned", details: "Watkins sent whistleblower memo alerting Lay to accounting fraud concerns." },
      { source_name: "Arthur Andersen LLP", target_name: "Enron Corporation", relation_type: "audited", details: "Arthur Andersen served as Enron's external auditor and signed off on fraudulent financial statements." },
      { source_name: "Raptor Entities", target_name: "Enron Stock (ENE)", relation_type: "affected", details: "Raptor entities backed by Enron stock; decline in stock price triggered defaults." },
      { source_name: "SEC", target_name: "Enron Corporation", relation_type: "investigated", details: "SEC opened official inquiry into Enron's accounting practices and related-party transactions." },
      { source_name: "Enron Corporation", target_name: "Enron Headquarters, Houston", relation_type: "operated_from", details: "Enron's main operations and fraud coordination occurred at headquarters." },
    ];

    await saveEntities(caseId, entities, relationships);

    await addAuditLog(caseId, "Enron Case Loaded", "Historical Enron corporate fraud case seeded with timeline events, entities, and relationships.", "System");

    const now = new Date().toISOString();
    return NextResponse.json({
      id: caseId,
      title: "Case Beta: Enron Corporation Corporate Fraud",
      description: "Investigation into Enron Corporation's complex financial fraud, off-balance-sheet debt hiding via Raptor/LJM partnerships, whistleblower reports by Sherron Watkins, and document shredding by Arthur Andersen LLP in late 2001.",
      status: "Active",
      created_at: now,
      updated_at: now
    }, { status: 201 });
  } catch (err: any) {
    console.error("Error loading Enron case:", err);
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
