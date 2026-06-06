import re
import networkx as nx

class EntityService:
    # Compile regexes
    PHONE_REGEX = re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
    EMAIL_REGEX = re.compile(r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b')
    VEHICLE_REGEX = re.compile(r'\b(?:[A-Z]{2}\d{2}[A-Z]{2}\d{4}|[A-Z]{3}-\d{4}|[A-Z]{2}\s\d{2}\s[A-Z]{2}\s\d{4})\b')
    
    # Keyword based matching for locations, organizations, and vehicles
    LOCATION_KEYWORDS = ["warehouse", "parking lot", "main entrance", "premises", "office", "dock", "lobby", "courtyard", "hq", "headquarters", "tower", "shredding room", "conference room", "enron center"]
    ORG_KEYWORDS = ["security systems", "global logistics", "police", "corporation", "co\\.", "ltd\\.", "inc\\.", "university", "enron", "andersen", "sec", "ljm", "raptor"]
    VEHICLE_KEYWORDS = ["car", "sedan", "suv", "prius", "truck", "toyota", "honda", "ford", "vehicle"]

    # Predefined known names of people to improve extraction (acting as a simple Named Entity Recognizer dictionary)
    KNOWN_NAMES = ["John", "Mark", "Sarah", "David", "Robert", "James", "Michael", "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Officer Green", "Officer Smith", "Sherron", "Kenneth", "Jeffrey", "Andrew", "Skilling", "Lay", "Fastow", "Watkins", "Grubman"]

    @classmethod
    def extract_entities_and_relationships(cls, text: str, case_id: int) -> tuple[list[dict], list[dict]]:
        """
        Scans a block of text (compiled from all evidence in a case) and extracts:
        - entities: list of dicts {name, type, details}
        - relationships: list of dicts {source_name, target_name, relation_type, details}
        """
        entities_dict = {} # Keyed by normalized name/value
        relationships = []
        
        # 1. Extract Emails
        emails = cls.EMAIL_REGEX.findall(text)
        for email in set(emails):
            entities_dict[email] = {"name": email, "type": "email", "details": "Email Address"}
            
        # 2. Extract Phone Numbers
        phones = cls.PHONE_REGEX.findall(text)
        for phone in set(phones):
            # Clean and normalize phone format
            norm_phone = "".join(filter(str.isdigit, phone))
            if len(norm_phone) >= 10:
                entities_dict[phone] = {"name": phone, "type": "phone", "details": "Contact Number"}

        # 3. Extract Vehicles
        vehicles = cls.VEHICLE_REGEX.findall(text)
        for vehicle in set(vehicles):
            entities_dict[vehicle] = {"name": vehicle, "type": "vehicle", "details": "License Plate"}

        # 4. Extract Locations
        # Heuristic: search for terms like "Warehouse 4", "Main Entrance"
        for word in cls.LOCATION_KEYWORDS:
            matches = re.findall(rf'\b([a-zA-Z0-9\s]+{word})\b', text, re.IGNORECASE)
            for match in matches:
                name = match.strip().title()
                if len(name) < 30: # sanity check
                    entities_dict[name] = {"name": name, "type": "location", "details": "Physical Location"}

        # 5. Extract Organizations
        for word in cls.ORG_KEYWORDS:
            matches = re.findall(rf'\b([a-zA-Z0-9\s]+{word})\b', text, re.IGNORECASE)
            for match in matches:
                name = match.strip().title()
                if len(name) < 35:
                    entities_dict[name] = {"name": name, "type": "organization", "details": "Corporate Entity"}

        # 6. Extract People
        # Look for known names or Cap-words preceding/following communication verbs
        for name in cls.KNOWN_NAMES:
            if re.search(rf'\b{name}\b', text, re.IGNORECASE):
                entities_dict[name] = {"name": name, "type": "person", "details": "Person of Interest"}

        # Find other capital names like: John sent, Mark said, etc.
        words = re.findall(r'\b([A-Z][a-z]+)\s+(?:said|told|says|argued|called|entered|exited|wrote|sent)\b', text)
        for word in words:
            if word not in ["The", "A", "He", "She", "They", "We", "I", "It"] and word not in entities_dict:
                entities_dict[word] = {"name": word, "type": "person", "details": "Individual"}

        # 7. Establish Relationships using proximity/context heuristic rules
        entities_list = list(entities_dict.values())
        
        # If there are no entities, return empty lists
        if not entities_list:
            return [], []

        # Find co-occurrences of people in the same paragraph/line to infer connections
        paragraphs = text.split("\n")
        
        # Relationship mapping
        # Let's map people to other entities
        people = [e for e in entities_list if e["type"] == "person"]
        vehicles_found = [e for e in entities_list if e["type"] == "vehicle"]
        locations = [e for e in entities_list if e["type"] == "location"]
        phones_found = [e for e in entities_list if e["type"] == "phone"]
        emails_found = [e for e in entities_list if e["type"] == "email"]

        # Simple heuristics for relationship mapping:
        # A. People talking/interacting
        if len(people) >= 2:
            for i in range(len(people)):
                for j in range(i + 1, len(people)):
                    p1 = people[i]["name"]
                    p2 = people[j]["name"]
                    # If they co-occur in the same paragraph, they have a relationship
                    co_occur_count = sum(1 for p in paragraphs if p1 in p and p2 in p)
                    if co_occur_count > 0:
                        relationships.append({
                            "source_name": p1,
                            "target_name": p2,
                            "relation_type": "contacts",
                            "details": f"Interacted via chat/audio ({co_occur_count} references)"
                        })

        # B. People associated with vehicles
        for p in people:
            for v in vehicles_found:
                # Check proximity in text
                pattern = rf'({p["name"]}.*?{v["name"]}|{v["name"]}.*?{p["name"]})'
                if re.search(pattern, text, re.IGNORECASE | re.DOTALL):
                    relationships.append({
                        "source_name": p["name"],
                        "target_name": v["name"],
                        "relation_type": "associated_vehicle",
                        "details": "Linked to vehicle in CCTV or incident files"
                    })

        # C. People at Locations
        for p in people:
            for loc in locations:
                pattern = rf'({p["name"]}.*?{loc["name"]}|{loc["name"]}.*?{p["name"]})'
                # If they are within 100 characters in the text
                if any(p["name"].lower() in para.lower() and loc["name"].lower() in para.lower() for para in paragraphs):
                    relationships.append({
                        "source_name": p["name"],
                        "target_name": loc["name"],
                        "relation_type": "located_at",
                        "details": "Present at this location during incident"
                    })

        # D. People with Phone/Email
        for p in people:
            for ph in phones_found:
                # If person name and phone number appear in same line
                if any(p["name"].lower() in para.lower() and ph in para for para in paragraphs):
                    relationships.append({
                        "source_name": p["name"],
                        "target_name": ph,
                        "relation_type": "has_phone",
                        "details": "Associated contact number"
                    })

        # Deduplicate relationships
        unique_relationships = []
        seen_rels = set()
        for rel in relationships:
            rel_key = tuple(sorted([rel["source_name"], rel["target_name"]])) + (rel["relation_type"],)
            if rel_key not in seen_rels:
                seen_rels.add(rel_key)
                unique_relationships.append(rel)

        return entities_list, unique_relationships
