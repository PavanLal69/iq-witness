import re
import os
from datetime import datetime

class ChatService:
    # Common chat patterns
    # 1. WhatsApp iOS: [dd/mm/yy, hh:mm:ss] Name: Message
    # 2. WhatsApp Android: dd/mm/yy, hh:mm - Name: Message
    # 3. Simple text: hh:mm - Name: Message or [yyyy-mm-dd hh:mm:ss] Name: Message
    PATTERNS = [
        re.compile(r'^\[(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[aApP][mM])?)\]\s+([^:]+):\s+(.*)$'),
        re.compile(r'^(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[aApP][mM])?)\s+-\s+([^:]+):\s+(.*)$'),
        re.compile(r'^\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+(.*)$'),
        re.compile(r'^(\d{2}:\d{2})\s+-\s+([^:]+):\s+(.*)$'),
    ]

    @classmethod
    def parse_chat_file(cls, file_path: str) -> list:
        """
        Parses a chat export log file and returns a list of dictionaries with:
        timestamp (datetime), sender (str), message (str), classification (str/None).
        """
        messages = []
        filename = os.path.basename(file_path).lower()
        
        # Default date fallback if not present in the line (e.g., uses file modified time or current date)
        file_date = datetime.now().date()
        try:
            mtime = os.path.getmtime(file_path)
            file_date = datetime.fromtimestamp(mtime).date()
        except Exception:
            pass

        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
        except Exception as e:
            print(f"Error reading chat file {file_path}: {e}")
            return []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            matched = False
            for i, pattern in enumerate(cls.PATTERNS):
                match = pattern.match(line)
                if match:
                    groups = match.groups()
                    timestamp = None
                    sender = ""
                    message = ""
                    
                    try:
                        if i == 0 or i == 1: # dd/mm/yy, hh:mm
                            date_str, time_str, sender, message = groups
                            # Clean up AM/PM
                            time_str = time_str.replace(" ", " ") # Handles thin space in iOS
                            
                            # Standardize datetime parsing
                            formats = ["%d/%m/%y %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%d/%m/%y %H:%M", "%d/%m/%Y %H:%M", 
                                       "%d/%m/%y %I:%M:%S %p", "%d/%m/%Y %I:%M:%S %p", "%d/%m/%y %I:%M %p", "%d/%m/%Y %I:%M %p"]
                            
                            for fmt in formats:
                                try:
                                    dt_str = f"{date_str} {time_str}"
                                    timestamp = datetime.strptime(dt_str, fmt)
                                    break
                                except ValueError:
                                    continue
                                    
                        elif i == 2: # [yyyy-mm-dd hh:mm:ss] Name: Message
                            date_str, time_str, sender, message = groups
                            timestamp = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M:%S")
                            
                        elif i == 3: # hh:mm - Name: Message
                            time_str, sender, message = groups
                            time_obj = datetime.strptime(time_str, "%H:%M").time()
                            timestamp = datetime.combine(file_date, time_obj)
                            
                    except Exception as err:
                        print(f"Date parsing failed for match: {groups}, error: {err}")
                        
                    if not timestamp:
                        # Fallback to current time
                        timestamp = datetime.now()

                    classification = cls.classify_message(message)
                    messages.append({
                        "timestamp": timestamp,
                        "sender": sender.strip(),
                        "message": message.strip(),
                        "classification": classification
                    })
                    matched = True
                    break
            
            # If no regex matched, append to the last message if possible (multiline message)
            if not matched and messages:
                messages[-1]["message"] += "\n" + line

        # Sort messages by timestamp
        messages.sort(key=lambda x: x["timestamp"])
        return messages

    @staticmethod
    def classify_message(text: str) -> str:
        """Classifies a chat message for key events: threat, agreement, request, or general."""
        text_lower = text.lower()
        
        # Threats
        threat_words = ["threat", "regret", "police", "cops", "warn", "kill", "destroy", "pay for", "sue", "legal action", "expose", "stupid"]
        if any(w in text_lower for w in threat_words):
            return "threat"
            
        # Agreements
        agreement_words = ["agree", "ok", "fine", "deal", "accept", "settled", "confirmed", "understand"]
        if any(w in text_lower for w in agreement_words):
            return "agreement"
            
        # Requests / Demands
        request_words = ["send", "give", "bring", "meet", "want", "where", "need", "pay", "please", "demand"]
        if any(w in text_lower for w in request_words):
            return "request"
            
        # Important Statements (general critical keywords)
        important_words = ["warehouse", "cctv", "camera", "files", "evidence", "contract", "stole", "broke", "arrived"]
        if any(w in text_lower for w in important_words):
            return "important"
            
        return "general"
