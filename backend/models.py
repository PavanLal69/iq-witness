import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Table
from sqlalchemy.orm import relationship
from database import Base

# Association table for Many-to-Many relationship between TimelineEvents and Evidence
event_evidence_association = Table(
    "event_evidence",
    Base.metadata,
    Column("event_id", Integer, ForeignKey("timeline_events.id", ondelete="CASCADE"), primary_key=True),
    Column("evidence_id", Integer, ForeignKey("evidence.id", ondelete="CASCADE"), primary_key=True)
)

class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="Active") # Active, Archived, Resolved
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    evidence = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    events = relationship("TimelineEvent", back_populates="case", cascade="all, delete-orphan")
    entities = relationship("Entity", back_populates="case", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="case", cascade="all, delete-orphan")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False) # video, audio, image, pdf, docx, txt, chat
    file_size = Column(Integer, nullable=False) # in bytes
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="Pending") # Pending, Processing, Processed, Failed
    summary = Column(Text, nullable=True)
    extracted_text = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True) # JSON string containing technical meta (duration, resolution, atc)

    # Relationships
    case = relationship("Case", back_populates="evidence")
    events = relationship("TimelineEvent", secondary=event_evidence_association, back_populates="evidence_sources")


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, nullable=False) # Merged absolute timestamp of the event
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String, nullable=True)
    event_type = Column(String, nullable=False) # e.g., communication, physical, surveillance, dokumentation
    confidence = Column(Float, default=1.0) # 0.0 to 1.0 confidence score of correlation

    # Relationships
    case = relationship("Case", back_populates="events")
    evidence_sources = relationship("Evidence", secondary=event_evidence_association, back_populates="events")


class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False) # person, vehicle, organization, location, phone, email
    details = Column(Text, nullable=True) # Description or additional metadata (e.g., license plate no, address)

    # Relationships
    case = relationship("Case", back_populates="entities")


class EntityRelationship(Base):
    __tablename__ = "entity_relationships"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    source_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    target_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String, nullable=False) # e.g. owns, contacts, works_for, located_at
    details = Column(Text, nullable=True)

    # Relationships
    source = relationship("Entity", foreign_keys=[source_id])
    target = relationship("Entity", foreign_keys=[target_id])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    action = Column(String, nullable=False) # e.g. "Case Created", "Evidence Uploaded", "Timeline Generated"
    performed_by = Column(String, default="System")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    details = Column(Text, nullable=True)

    # Relationships
    case = relationship("Case", back_populates="audit_logs")
