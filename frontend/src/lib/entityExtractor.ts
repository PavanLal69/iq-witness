// src/lib/entityExtractor.ts
// TypeScript port of backend/services/entity.py
// Extracts entities and relationships from combined evidence text

export interface ExtractedEntity {
  name: string;
  type: "person" | "vehicle" | "location" | "organization" | "phone" | "email";
  details: string;
}

export interface ExtractedRelationship {
  source_name: string;
  target_name: string;
  relation_type: string;
  details: string;
}

const PHONE_REGEX = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const EMAIL_REGEX = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const VEHICLE_REGEX = /\b(?:[A-Z]{2}\d{2}[A-Z]{2}\d{4}|[A-Z]{3}-\d{4}|[A-Z]{2}\s\d{2}\s[A-Z]{2}\s\d{4})\b/g;

const LOCATION_KEYWORDS = [
  "warehouse", "parking lot", "main entrance", "premises", "office",
  "dock", "lobby", "courtyard", "hq", "headquarters", "tower",
  "shredding room", "conference room", "enron center"
];

const ORG_KEYWORDS = [
  "security systems", "global logistics", "police", "corporation",
  "co.", "ltd.", "inc.", "university", "enron", "andersen",
  "sec", "ljm", "raptor"
];

const KNOWN_NAMES = [
  "John", "Mark", "Sarah", "David", "Robert", "James", "Michael",
  "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth",
  "Officer Green", "Officer Smith",
  "Sherron", "Kenneth", "Jeffrey", "Andrew",
  "Skilling", "Lay", "Fastow", "Watkins", "Grubman"
];

export function extractEntitiesAndRelationships(text: string): {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
} {
  const entitiesMap = new Map<string, ExtractedEntity>();

  // 1. Emails
  const emails = text.match(EMAIL_REGEX) || [];
  for (const email of [...new Set(emails)]) {
    entitiesMap.set(email, { name: email, type: "email", details: "Email Address" });
  }

  // 2. Phones
  const phones = text.match(PHONE_REGEX) || [];
  for (const phone of [...new Set(phones)]) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10) {
      entitiesMap.set(phone, { name: phone, type: "phone", details: "Contact Number" });
    }
  }

  // 3. Vehicles
  const vehicles = text.match(VEHICLE_REGEX) || [];
  for (const vehicle of [...new Set(vehicles)]) {
    entitiesMap.set(vehicle, { name: vehicle, type: "vehicle", details: "License Plate" });
  }

  // 4. Locations (keyword heuristic)
  for (const keyword of LOCATION_KEYWORDS) {
    const regex = new RegExp(`([a-zA-Z0-9\\s]+${keyword})`, "gi");
    let m;
    while ((m = regex.exec(text)) !== null) {
      const name = m[1].trim().replace(/\b\w/g, l => l.toUpperCase());
      if (name.length < 30) {
        entitiesMap.set(name, { name, type: "location", details: "Physical Location" });
      }
    }
  }

  // 5. Organizations (keyword heuristic)
  for (const keyword of ORG_KEYWORDS) {
    const escaped = keyword.replace(".", "\\.");
    const regex = new RegExp(`([a-zA-Z0-9\\s]+${escaped})`, "gi");
    let m;
    while ((m = regex.exec(text)) !== null) {
      const name = m[1].trim().replace(/\b\w/g, l => l.toUpperCase());
      if (name.length < 35) {
        entitiesMap.set(name, { name, type: "organization", details: "Corporate Entity" });
      }
    }
  }

  // 6. Known people
  for (const name of KNOWN_NAMES) {
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) {
      entitiesMap.set(name, { name, type: "person", details: "Person of Interest" });
    }
  }

  // 7. Capital words preceding communication verbs
  const commVerbRegex = /\b([A-Z][a-z]+)\s+(?:said|told|says|argued|called|entered|exited|wrote|sent)\b/g;
  let m;
  const skipWords = new Set(["The", "A", "He", "She", "They", "We", "I", "It"]);
  while ((m = commVerbRegex.exec(text)) !== null) {
    const word = m[1];
    if (!skipWords.has(word) && !entitiesMap.has(word)) {
      entitiesMap.set(word, { name: word, type: "person", details: "Individual" });
    }
  }

  // 8. Build relationships between people and organizations
  const entities = [...entitiesMap.values()];
  const relationships: ExtractedRelationship[] = [];

  const people = entities.filter(e => e.type === "person");
  const orgs = entities.filter(e => e.type === "organization");
  const phones_ = entities.filter(e => e.type === "phone");
  const emails_ = entities.filter(e => e.type === "email");

  // Each person contacts each other person (if >1 person)
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      relationships.push({
        source_name: people[i].name,
        target_name: people[j].name,
        relation_type: "contacts",
        details: `${people[i].name} and ${people[j].name} appear together in the evidence.`
      });
    }
  }

  // Each person works for an org
  for (const person of people) {
    for (const org of orgs) {
      relationships.push({
        source_name: person.name,
        target_name: org.name,
        relation_type: "affiliated_with",
        details: `${person.name} is associated with ${org.name} based on evidence context.`
      });
    }
  }

  // Each person owns a phone or email
  for (const person of people) {
    for (const phone of phones_) {
      if (new RegExp(`\\b${person.name}\\b[\\s\\S]{0,150}${phone.name.replace(/[+().-]/g, "\\$&")}`, "i").test(text)) {
        relationships.push({
          source_name: person.name,
          target_name: phone.name,
          relation_type: "owns",
          details: `${person.name} is linked to phone number ${phone.name}.`
        });
      }
    }
    for (const email of emails_) {
      if (new RegExp(`\\b${person.name}\\b[\\s\\S]{0,150}${email.name.replace(/[.@+]/g, "\\$&")}`, "i").test(text)) {
        relationships.push({
          source_name: person.name,
          target_name: email.name,
          relation_type: "uses",
          details: `${person.name} is linked to email ${email.name}.`
        });
      }
    }
  }

  return { entities, relationships };
}

// ─── Timeline event builder from text documents ─────────────────────────────

export interface RawTimelineEvent {
  timestamp: string;
  title: string;
  description: string;
  event_type: string;
  location?: string;
  confidence: number;
}

export function buildTimelineFromText(
  filename: string,
  fileType: string,
  text: string,
  baseDateTime = "2026-06-06T16:00:00"
): RawTimelineEvent[] {
  const events: RawTimelineEvent[] = [];
  const base = new Date(baseDateTime);

  // Try to find date in text
  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  let eventDate = base;
  if (dateMatch) {
    try { eventDate = new Date(dateMatch[1]); } catch (_) {}
  }

  const snippet = text.length > 400 ? text.slice(0, 400) + "..." : text;

  events.push({
    timestamp: eventDate.toISOString(),
    title: `Document Evidence: ${filename}`,
    description: snippet,
    event_type: "document_record",
    location: undefined,
    confidence: 0.85
  });

  // Check for chat-style content: lines with timestamps/senders
  const chatLines = text.match(/^\[[\d:/ ]+\]\s+.+?:\s+.+/gm) || [];
  if (chatLines.length > 0 && fileType === "chat") {
    chatLines.forEach((line, idx) => {
      const offset = idx * 30000; // 30s apart
      const ts = new Date(base.getTime() + offset).toISOString();
      events.push({
        timestamp: ts,
        title: `Chat Message #${idx + 1}`,
        description: line.trim(),
        event_type: "chat_message",
        confidence: 1.0
      });
    });
  }

  return events;
}
