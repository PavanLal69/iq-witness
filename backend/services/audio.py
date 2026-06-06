import os
import wave

class AudioService:
    @staticmethod
    def get_audio_duration(file_path: str) -> float:
        """Determines audio duration in seconds. Supports WAV natively, otherwise returns a mock default."""
        try:
            if file_path.lower().endswith(".wav"):
                with wave.open(file_path, "rb") as wav_file:
                    frames = wav_file.getnframes()
                    rate = wav_file.getframerate()
                    duration = frames / float(rate)
                    return duration
        except Exception as e:
            print(f"Error reading WAV headers: {e}")
        
        try:
            size = os.path.getsize(file_path)
            return max(5.0, size / 16000.0)
        except Exception:
            return 30.0

    @classmethod
    def transcribe_audio(cls, file_path: str) -> dict:
        """
        Transcribes audio and performs speaker diarization.
        Supports multiple case scenario mock outputs based on filenames.
        """
        filename = os.path.basename(file_path).lower()
        duration = cls.get_audio_duration(file_path)

        # 1. Case Alpha: Warehouse Altercation
        if "recording" in filename or "altercation" in filename:
            segments = [
                {"speaker": "John Doe", "text": "Get off my property right now! I told you you're not welcome here.", "start": 0.0, "end": 4.5},
                {"speaker": "Mark Smith", "text": "I came to get what's mine, John. You think you can just lock me out of the warehouse?", "start": 5.0, "end": 9.8},
                {"speaker": "John Doe", "text": "Don't touch me! Step back! The camera is recording everything!", "start": 10.2, "end": 14.5},
                {"speaker": "Mark Smith", "text": "I don't care about your cameras! Give me the keys!", "start": 15.0, "end": 18.2},
                {"speaker": "John Doe", "text": "Hey! Stop! Put that down! [Sounds of struggling]", "start": 18.5, "end": 22.0}
            ]
        
        # Enron Case: Grubman / Conference Call
        elif "grubman" in filename or "conference" in filename:
            segments = [
                {"speaker": "Richard Grubman", "text": "You are the only financial institution that cannot produce a balance sheet or a cash flow statement with your earnings.", "start": 0.0, "end": 8.0},
                {"speaker": "Jeffrey Skilling", "text": "Well, thank you very much, we appreciate that... asshole.", "start": 8.5, "end": 13.0},
                {"speaker": "Kenneth Lay", "text": "Let's move on to the next question, please. We will address that in our disclosures.", "start": 14.0, "end": 20.0}
            ]

        # 2. Case Beta: HR Espionage Interview
        elif "interview" in filename or "espionage" in filename:
            segments = [
                {"speaker": "HR Investigator Green", "text": "Alice, we have server logs indicating you downloaded the source code repository 'ai-core-model' at 10:14 PM last night. Can you explain why?", "start": 0.0, "end": 8.5},
                {"speaker": "Alice Vance", "text": "I was... I was just working late. I wanted to review the neural network files from home.", "start": 9.0, "end": 14.2},
                {"speaker": "HR Investigator Green", "text": "But the logs show the access was from a residential IP not registered with our VPN. And we have screenshots of a negotiation with Agent X. Did you leak this code?", "start": 15.0, "end": 23.5},
                {"speaker": "Alice Vance", "text": "[Crying] I had to. They offered me fifty thousand dollars. My family needed the money.", "start": 24.0, "end": 30.0}
            ]

        # 3. Case Gamma: Insurance Statement
        elif "statement" in filename or "burglary" in filename:
            segments = [
                {"speaker": "Claims Adjuster Harris", "text": "This is a statement from shop owner Bob regarding the burglary on June 5. Bob, what time did you leave the store?", "start": 0.0, "end": 6.5},
                {"speaker": "Owner Bob", "text": "I closed up at exactly 9:00 PM. I locked all the doors, including the back door, and set the alarm system.", "start": 7.0, "end": 13.8},
                {"speaker": "Claims Adjuster Harris", "text": "However, the security system audit shows the alarm was never armed, and the back door was left unlocked. Did you coordinate this?", "start": 14.5, "end": 21.0},
                {"speaker": "Owner Bob", "text": "No! That must be a system glitch. I would never help anyone rob my own jewelry store.", "start": 21.5, "end": 28.0}
            ]

        # 4. Case Delta: Student Dean Hearing
        elif "hearing" in filename or "dean" in filename:
            segments = [
                {"speaker": "Dean Miller", "text": "Tim, we have Discord transcripts showing you received the Physics exam answers two days before the test. Where did you get them?", "start": 0.0, "end": 7.0},
                {"speaker": "Student Tim", "text": "I don't know who leaked them, sir. They were just posted in a public channel. I didn't pay for them.", "start": 7.5, "end": 12.0},
                {"speaker": "Dean Miller", "text": "The messages show Dave stating he bought them from an email address associated with the assistant professor. We have record of the transaction.", "start": 12.5, "end": 20.0},
                {"speaker": "Student Tim", "text": "Okay, yes, we pooled money together to buy the questions. Please don't expel me.", "start": 20.5, "end": 26.0}
            ]

        # Generic default response
        else:
            segments = [
                {"speaker": "Speaker 1", "text": "Audio analysis initiated. Checking vocal frequencies.", "start": 0.0, "end": min(4.0, duration / 2)},
                {"speaker": "Speaker 2", "text": f"Audio processing successful. File duration: {duration:.2f}s.", "start": min(5.0, duration / 2), "end": min(10.0, duration)}
            ]

        full_transcript = "\n".join([f"{seg['speaker']}: \"{seg['text']}\"" for seg in segments])
        return {
            "transcript": full_transcript,
            "segments": segments,
            "duration": duration,
            "language": "en"
        }
