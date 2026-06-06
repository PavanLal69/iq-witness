// src/lib/firestore.ts
// Firestore CRUD helpers — mirrors the previous FastAPI/SQLite endpoints

import {
  collection, doc, addDoc, getDoc, getDocs, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp, writeBatch,
  where, setDoc, updateDoc
} from "firebase/firestore";
import {
  ref, uploadBytes, getDownloadURL, deleteObject, listAll
} from "firebase/storage";
import { db, storage } from "./firebase";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Case {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: string;
  case_id: string;
  filename: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  status: string;
  summary?: string;
  extracted_text?: string;
}

export interface TimelineEvent {
  id: string;
  case_id: string;
  timestamp: string;
  title: string;
  description: string;
  location?: string;
  event_type: string;
  confidence: number;
}

export interface Entity {
  id: string;
  case_id: string;
  name: string;
  type: string;
  details?: string;
}

export interface EntityRelationship {
  id: string;
  case_id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  details?: string;
}

export interface AuditLog {
  id: string;
  case_id: string;
  action: string;
  performed_by: string;
  timestamp: string;
  details?: string;
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function tsToISO(ts: any): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return String(ts);
}

// ─── Cases ─────────────────────────────────────────────────────────────────

export async function getCases(): Promise<Case[]> {
  const snap = await getDocs(query(collection(db, "cases"), orderBy("created_at", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data(), created_at: tsToISO((d.data() as any).created_at), updated_at: tsToISO((d.data() as any).updated_at) } as Case));
}

export async function getCase(caseId: string): Promise<Case | null> {
  const snap = await getDoc(doc(db, "cases", caseId));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return { id: snap.id, ...data, created_at: tsToISO(data.created_at), updated_at: tsToISO(data.updated_at) };
}

export async function createCase(title: string, description: string, status = "Active"): Promise<string> {
  const docRef = await addDoc(collection(db, "cases"), {
    title, description, status,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });
  await addAuditLog(docRef.id, "Case Created", `Case '${title}' created.`);
  return docRef.id;
}

export async function deleteCase(caseId: string): Promise<void> {
  // Delete all subcollections
  const subcollections = ["evidence", "timeline_events", "entities", "entity_relationships", "audit_logs"];
  const batch = writeBatch(db);
  for (const sub of subcollections) {
    const snap = await getDocs(collection(db, "cases", caseId, sub));
    snap.docs.forEach(d => batch.delete(d.ref));
  }
  batch.delete(doc(db, "cases", caseId));
  await batch.commit();

  // Delete storage files
  try {
    const storageRef = ref(storage, `cases/${caseId}`);
    const list = await listAll(storageRef);
    await Promise.all(list.items.map(item => deleteObject(item)));
  } catch (_) {}
}

// ─── Evidence ──────────────────────────────────────────────────────────────

export async function getEvidence(caseId: string): Promise<Evidence[]> {
  const snap = await getDocs(collection(db, "cases", caseId, "evidence"));
  return snap.docs.map(d => ({ id: d.id, ...d.data(), uploaded_at: tsToISO((d.data() as any).uploaded_at) } as Evidence));
}

export async function uploadEvidenceFile(caseId: string, file: File): Promise<Evidence> {
  const filename = file.name;
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  const videoExts = ["mp4", "mov", "avi", "mkv"];
  const audioExts = ["mp3", "wav", "ogg", "m4a"];
  const imageExts = ["jpg", "jpeg", "png", "bmp"];
  const chatKeywords = ["chat", "whatsapp"];

  let file_type = "unknown";
  if (videoExts.includes(ext)) file_type = "video";
  else if (audioExts.includes(ext)) file_type = "audio";
  else if (imageExts.includes(ext)) file_type = "image";
  else if (chatKeywords.some(k => filename.toLowerCase().includes(k)) || ext === "csv") file_type = "chat";
  else if (["pdf", "docx", "txt", "doc"].includes(ext)) file_type = ext;

  // Upload to Firebase Storage
  const storageRef = ref(storage, `cases/${caseId}/${filename}`);
  await uploadBytes(storageRef, file);
  const file_url = await getDownloadURL(storageRef);

  // Save record to Firestore
  const docRef = await addDoc(collection(db, "cases", caseId, "evidence"), {
    case_id: caseId, filename, file_url, file_type,
    file_size: file.size, status: "Pending",
    uploaded_at: serverTimestamp()
  });

  await addAuditLog(caseId, "Evidence Uploaded", `Uploaded '${filename}' (Type: ${file_type}, Size: ${file.size} bytes)`);

  return {
    id: docRef.id, case_id: caseId, filename, file_url, file_type,
    file_size: file.size, status: "Pending",
    uploaded_at: new Date().toISOString()
  };
}

// ─── Timeline ──────────────────────────────────────────────────────────────

export async function getTimeline(caseId: string): Promise<TimelineEvent[]> {
  const snap = await getDocs(query(
    collection(db, "cases", caseId, "timeline_events"),
    orderBy("timestamp", "asc")
  ));
  return snap.docs.map(d => {
    const data = d.data() as any;
    return { id: d.id, ...data, timestamp: tsToISO(data.timestamp) } as TimelineEvent;
  });
}

export async function saveTimelineEvents(caseId: string, events: Omit<TimelineEvent, "id" | "case_id">[]): Promise<void> {
  // Clear existing events
  const snap = await getDocs(collection(db, "cases", caseId, "timeline_events"));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));

  events.forEach(ev => {
    const newRef = doc(collection(db, "cases", caseId, "timeline_events"));
    batch.set(newRef, { ...ev, case_id: caseId, timestamp: new Date(ev.timestamp) });
  });
  await batch.commit();
}

// ─── Entities & Relationships ───────────────────────────────────────────────

export async function getEntities(caseId: string): Promise<Entity[]> {
  const snap = await getDocs(collection(db, "cases", caseId, "entities"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Entity));
}

export async function getRelationships(caseId: string): Promise<EntityRelationship[]> {
  const snap = await getDocs(collection(db, "cases", caseId, "entity_relationships"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EntityRelationship));
}

export async function saveEntities(
  caseId: string,
  entities: Omit<Entity, "id" | "case_id">[],
  relationships: Array<Partial<Omit<EntityRelationship, "id" | "case_id">> & { source_name?: string; target_name?: string }>
): Promise<string[]> {
  // Clear existing
  const entSnap = await getDocs(collection(db, "cases", caseId, "entities"));
  const relSnap = await getDocs(collection(db, "cases", caseId, "entity_relationships"));
  const batch = writeBatch(db);
  entSnap.docs.forEach(d => batch.delete(d.ref));
  relSnap.docs.forEach(d => batch.delete(d.ref));

  // Add entities
  const entityIds: string[] = [];
  entities.forEach(ent => {
    const newRef = doc(collection(db, "cases", caseId, "entities"));
    batch.set(newRef, { ...ent, case_id: caseId });
    entityIds.push(newRef.id);
  });

  // Add relationships (after commit so IDs exist — we'll do a second batch)
  await batch.commit();

  // Get the newly created entities to build name→id map
  const savedEnts = await getEntities(caseId);
  const nameToId: Record<string, string> = {};
  savedEnts.forEach(e => { nameToId[e.name] = e.id; });

  const relBatch = writeBatch(db);
  relationships.forEach(rel => {
    const src = nameToId[(rel as any).source_name] || (rel as any).source_id;
    const tgt = nameToId[(rel as any).target_name] || (rel as any).target_id;
    if (src && tgt) {
      const newRef = doc(collection(db, "cases", caseId, "entity_relationships"));
      relBatch.set(newRef, {
        case_id: caseId, source_id: src, target_id: tgt,
        relation_type: rel.relation_type, details: rel.details || null
      });
    }
  });
  await relBatch.commit();

  return entityIds;
}

export async function createRelationship(
  caseId: string,
  sourceId: string,
  targetId: string,
  relationType: string,
  details?: string
): Promise<EntityRelationship> {
  // Check for duplicate
  const existing = await getDocs(
    query(collection(db, "cases", caseId, "entity_relationships"),
      where("source_id", "==", sourceId),
      where("target_id", "==", targetId))
  );
  if (!existing.empty) throw new Error("Relationship already exists");

  const docRef = await addDoc(collection(db, "cases", caseId, "entity_relationships"), {
    case_id: caseId, source_id: sourceId, target_id: targetId,
    relation_type: relationType, details: details || null
  });

  await addAuditLog(caseId, "Relationship Created",
    `Manually created '${relationType}' between entity ${sourceId} and ${targetId}.`);

  return { id: docRef.id, case_id: caseId, source_id: sourceId, target_id: targetId, relation_type: relationType, details };
}

// ─── Audit Logs ────────────────────────────────────────────────────────────

export async function getAuditLogs(caseId: string): Promise<AuditLog[]> {
  const snap = await getDocs(query(
    collection(db, "cases", caseId, "audit_logs"),
    orderBy("timestamp", "desc")
  ));
  return snap.docs.map(d => {
    const data = d.data() as any;
    return { id: d.id, ...data, timestamp: tsToISO(data.timestamp) } as AuditLog;
  });
}

export async function addAuditLog(caseId: string, action: string, details?: string, performedBy = "System"): Promise<void> {
  await addDoc(collection(db, "cases", caseId, "audit_logs"), {
    case_id: caseId, action, details: details || null,
    performed_by: performedBy, timestamp: serverTimestamp()
  });
}
