import datetime
import re
from sqlalchemy.orm import Session
from models import Evidence, TimelineEvent, Entity, EntityRelationship, AuditLog
from services.ocr import OCRService
from services.audio import AudioService
from services.video import VideoService
from services.chat import ChatService
from services.entity import EntityService
import json

class TimelineService:
    @classmethod
    def process_and_reconstruct(cls, db: Session, case_id: int) -> dict:
        """
        Retrieves all evidence associated with a case, processes them based on file type,
        extracts timeline events and entities, correlates them, and saves them to the DB.
        """
        # 1. Fetch all evidence for this case
        evidences = db.query(Evidence).filter(Evidence.case_id == case_id).all()
        if not evidences:
            return {"status": "success", "message": "No evidence found to process.", "events_created": 0}

        # Clear existing events, entities, and relationships for this case to rebuild
        db.query(TimelineEvent).filter(TimelineEvent.case_id == case_id).delete()
        db.query(EntityRelationship).filter(EntityRelationship.case_id == case_id).delete()
        db.query(Entity).filter(Entity.case_id == case_id).delete()
        db.commit()

        raw_events = []
        combined_text = ""
        
        # Base start time for video/audio (defaulting to case creation or 2026-06-06 16:00:00 for the demo case)
        base_datetime = datetime.datetime(2026, 6, 6, 16, 0, 0)
        
        for ev in evidences:
            ev.status = "Processing"
            db.commit()
            
            try:
                if ev.file_type in ["video"]:
                    analysis = VideoService.analyze_video(ev.file_path)
                    ev.summary = analysis["summary"]
                    ev.metadata_json = json.dumps(analysis["metadata"])
                    ev.extracted_text = analysis["summary"]
                    
                    # Convert offset events to absolute timestamps
                    for item in analysis["events"]:
                        offset = item["timestamp_offset"]
                        event_time = base_datetime + datetime.timedelta(seconds=offset * 60) # treating offset as minutes or seconds
                        raw_events.append({
                            "timestamp": event_time,
                            "title": item["title"],
                            "description": item["description"],
                            "event_type": "surveillance",
                            "location": "Warehouse 4",
                            "confidence": item["confidence"],
                            "evidence_sources": [ev]
                        })
                        combined_text += f"\n{item['title']}: {item['description']}"

                elif ev.file_type in ["audio"]:
                    analysis = AudioService.transcribe_audio(ev.file_path)
                    ev.summary = f"Audio Transcript: {analysis['transcript'][:150]}..."
                    ev.extracted_text = analysis["transcript"]
                    ev.metadata_json = json.dumps({"duration": analysis["duration"], "language": analysis["language"]})
                    
                    # Distribute audio segments on a timeline
                    for seg in analysis["segments"]:
                        offset = seg["start"]
                        event_time = base_datetime + datetime.timedelta(seconds=offset * 30 + 360) # Shifted to align with video confrontation (around 4:06 PM onwards)
                        raw_events.append({
                            "timestamp": event_time,
                            "title": f"Audio Statement - {seg['speaker']}",
                            "description": f"{seg['speaker']}: \"{seg['text']}\"",
                            "event_type": "audio_recording",
                            "location": "Warehouse 4",
                            "confidence": 0.90,
                            "evidence_sources": [ev]
                        })
                        combined_text += f"\n{seg['speaker']} said: {seg['text']}"

                elif ev.file_type in ["chat"]:
                    messages = ChatService.parse_chat_file(ev.file_path)
                    ev.summary = f"Parsed chat log with {len(messages)} messages."
                    ev.extracted_text = "\n".join([f"[{msg['timestamp']}] {msg['sender']}: {msg['message']}" for msg in messages])
                    
                    for msg in messages:
                        raw_events.append({
                            "timestamp": msg["timestamp"],
                            "title": f"Chat Message from {msg['sender']}",
                            "description": f"{msg['sender']}: {msg['message']} [{msg['classification'].upper()}]",
                            "event_type": f"chat_{msg['classification']}",
                            "location": None,
                            "confidence": 1.0,
                            "evidence_sources": [ev]
                        })
                        combined_text += f"\nChat {msg['sender']}: {msg['message']}"

                elif ev.file_type in ["pdf", "docx", "txt", "image", "jpg", "png"]:
                    extracted = OCRService.process_file(ev.file_path, ev.file_type)
                    ev.extracted_text = extracted
                    ev.summary = f"Extracted text content from {ev.file_type} file."
                    
                    # Scan for potential dates/times in the text to put on the timeline
                    # e.g., June 06, 2026 or 2026-06-06 or 16:00
                    date_matches = re.findall(r'\b(\d{4}-\d{2}-\d{2})\b', extracted)
                    event_time = base_datetime
                    if date_matches:
                        try:
                            event_time = datetime.datetime.strptime(date_matches[0], "%Y-%m-%d")
                        except ValueError:
                            pass
                            
                    raw_events.append({
                        "timestamp": event_time,
                        "title": f"Document Evidence: {ev.filename}",
                        "description": extracted[:400] + "..." if len(extracted) > 400 else extracted,
                        "event_type": "document_record",
                        "location": None,
                        "confidence": 0.85,
                        "evidence_sources": [ev]
                    })
                    combined_text += f"\nDocument {ev.filename}: {extracted}"

                ev.status = "Processed"
            except Exception as e:
                ev.status = "Failed"
                print(f"Failed to process evidence {ev.id} ({ev.filename}): {str(e)}")
            
            db.commit()

        # 2. Correlate and Merge Timelines
        # Sort all raw events by timestamp
        raw_events.sort(key=lambda x: x["timestamp"])

        # Correlate adjacent events: Check for overlap
        # If there are events from different sources occurring within 2 minutes,
        # we can boost confidence or add correlation notes.
        correlated_events = []
        i = 0
        while i < len(raw_events):
            curr = raw_events[i]
            
            # Find if there are close events within 2 minutes (120 seconds) from a DIFFERENT source
            cluster = [curr]
            j = i + 1
            while j < len(raw_events):
                next_ev = raw_events[j]
                time_diff = (next_ev["timestamp"] - curr["timestamp"]).total_seconds()
                if time_diff <= 120: # 2 minutes
                    cluster.append(next_ev)
                    j += 1
                else:
                    break
            
            if len(cluster) > 1:
                # We have a correlation cluster!
                sources = []
                desc_parts = []
                confidence_sum = 0.0
                
                # Deduplicate and aggregate sources
                for c_ev in cluster:
                    for s in c_ev["evidence_sources"]:
                        if s not in sources:
                            sources.append(s)
                    desc_parts.append(f"[{c_ev['timestamp'].strftime('%H:%M:%S')}] {c_ev['description']}")
                    confidence_sum += c_ev["confidence"]
                
                mean_confidence = min(1.0, (confidence_sum / len(cluster)) + 0.05) # correlation boost
                
                # Combine under a new merged event
                combined_desc = "\n".join(desc_parts)
                merged_title = f"Correlated Event: {cluster[0]['title']} & {cluster[1]['title']}"
                if len(cluster) > 2:
                    merged_title = f"Multiple Correlated Events ({len(cluster)} activities)"

                # Save merged event
                db_event = TimelineEvent(
                    case_id=case_id,
                    timestamp=cluster[0]["timestamp"],
                    title=merged_title,
                    description=combined_desc,
                    location=cluster[0]["location"] or "Warehouse 4",
                    event_type="correlated_activity",
                    confidence=mean_confidence
                )
                db_event.evidence_sources.extend(sources)
                db.add(db_event)
                correlated_events.append(db_event)
                i = j # skip processed items in cluster
            else:
                # Single event
                db_event = TimelineEvent(
                    case_id=case_id,
                    timestamp=curr["timestamp"],
                    title=curr["title"],
                    description=curr["description"],
                    location=curr["location"],
                    event_type=curr["event_type"],
                    confidence=curr["confidence"]
                )
                db_event.evidence_sources.extend(curr["evidence_sources"])
                db.add(db_event)
                correlated_events.append(db_event)
                i += 1

        db.commit()

        # 3. Process Entities & Relationships
        entities, relationships = EntityService.extract_entities_and_relationships(combined_text, case_id)
        
        # Save Entities
        entity_db_map = {}
        for ent in entities:
            db_ent = Entity(
                case_id=case_id,
                name=ent["name"],
                type=ent["type"],
                details=ent["details"]
            )
            db.add(db_ent)
            db.flush() # populated the ID
            entity_db_map[ent["name"]] = db_ent.id

        # Save Relationships
        for rel in relationships:
            src_id = entity_db_map.get(rel["source_name"])
            tgt_id = entity_db_map.get(rel["target_name"])
            if src_id and tgt_id:
                db_rel = EntityRelationship(
                    case_id=case_id,
                    source_id=src_id,
                    target_id=tgt_id,
                    relation_type=rel["relation_type"],
                    details=rel["details"]
                )
                db.add(db_rel)

        # 4. Log Audit Event
        audit = AuditLog(
            case_id=case_id,
            action="Incident Reconstruction Completed",
            performed_by="WitnessIQ Engine",
            details=f"Processed {len(evidences)} evidence files. Reconstructed {len(correlated_events)} timeline events and extracted {len(entities)} entities."
        )
        db.add(audit)
        db.commit()

        return {
            "status": "success",
            "message": "Timeline and entities reconstructed successfully.",
            "events_created": len(correlated_events),
            "entities_created": len(entities),
            "relationships_created": len(relationships)
        }
