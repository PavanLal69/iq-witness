from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# --- Audit Log ---
class AuditLogBase(BaseModel):
    action: str
    performed_by: str
    details: Optional[str] = None

class AuditLogResponse(AuditLogBase):
    id: int
    case_id: int
    timestamp: datetime

    class Config:
        from_attributes = True

# --- Evidence ---
class EvidenceBase(BaseModel):
    filename: str
    file_type: str
    file_size: int

class EvidenceResponse(EvidenceBase):
    id: int
    case_id: int
    file_path: str
    uploaded_at: datetime
    status: str
    summary: Optional[str] = None
    extracted_text: Optional[str] = None
    metadata_json: Optional[str] = None

    class Config:
        from_attributes = True

# --- Timeline Event ---
class TimelineEventBase(BaseModel):
    timestamp: datetime
    title: str
    description: str
    location: Optional[str] = None
    event_type: str
    confidence: float = 1.0

class TimelineEventCreate(TimelineEventBase):
    evidence_ids: List[int] = []

class TimelineEventResponse(TimelineEventBase):
    id: int
    case_id: int
    evidence_sources: List[EvidenceResponse] = []

    class Config:
        from_attributes = True

# --- Entity ---
class EntityBase(BaseModel):
    name: str
    type: str # person, vehicle, organization, location, phone, email
    details: Optional[str] = None

class EntityCreate(EntityBase):
    pass

class EntityResponse(EntityBase):
    id: int
    case_id: int

    class Config:
        from_attributes = True

# --- Entity Relationship ---
class EntityRelationshipBase(BaseModel):
    source_id: int
    target_id: int
    relation_type: str
    details: Optional[str] = None

class EntityRelationshipCreate(EntityRelationshipBase):
    pass

class EntityRelationshipResponse(EntityRelationshipBase):
    id: int
    case_id: int
    source: EntityResponse
    target: EntityResponse

    class Config:
        from_attributes = True

# --- Case ---
class CaseBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "Active"

class CaseCreate(CaseBase):
    pass

class CaseResponse(CaseBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CaseDetailResponse(CaseResponse):
    evidence: List[EvidenceResponse] = []
    events: List[TimelineEventResponse] = []
    entities: List[EntityResponse] = []
    audit_logs: List[AuditLogResponse] = []

    class Config:
        from_attributes = True

# --- Report Request ---
class ReportRequest(BaseModel):
    report_type: str # police, insurance, hr, disciplinary, legal
    custom_notes: Optional[str] = None
