import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

# Mock Database for Session State
SESSION_STORE: Dict[str, Dict[str, Any]] = {}

QUESTIONS_TA = {
    "farm_name": "உங்கள் தோட்டத்தின் பெயர் என்ன?",
    "total_farm_acres": "மொத்த நிலப்பரப்பு எத்தனை ஏக்கர்?",
    "banana_area_acres": "வாழை பயிரிடப்பட்ட பரப்பு எத்தனை ஏக்கர்?",
    "banana_variety": "எந்த வாழை ரகம் பயிடு செய்துள்ளீர்கள்?",
    "planting_age": "நடவு செய்தது எத்தனை மாதங்கள் ஆனது?",
    "approximate_plants": "சுமார் எத்தனை வாழை மரங்கள் உள்ளன?",
    "drainage": "தோட்டத்தில் வடிகால் வசதி உள்ளதா? (ஆம்/இல்லை)",
    "support": "ஆதரவு கம்புகள் (Support poles) உள்ளதா? (ஆம்/இல்லை)",
    "accessibility": "தோட்டத்திற்கு சாலை வசதி உள்ளதா? (ஆம்/இல்லை)",
}

QUESTIONS_EN = {
    "farm_name": "What is the name of your farm?",
    "total_farm_acres": "What is the total land area in acres?",
    "banana_area_acres": "How many acres are under banana cultivation?",
    "banana_variety": "Which banana variety have you planted?",
    "planting_age": "How many months ago was it planted?",
    "approximate_plants": "Approximately how many banana trees are there?",
    "drainage": "Is there drainage facility in the farm? (Yes/No)",
    "support": "Are there support poles? (Yes/No)",
    "accessibility": "Is there road access to the farm? (Yes/No)",
}

FIELD_ORDER = [
    "farm_name", "total_farm_acres", "banana_area_acres", "banana_variety",
    "planting_age", "approximate_plants", "drainage", "support", "accessibility"
]

def get_empty_state() -> Dict[str, Any]:
    """Returns a fully initialized state to prevent undefined errors"""
    return {
        "farm_name": "",
        "total_farm_acres": None,
        "banana_area_acres": None,
        "banana_variety": "",
        "planting_age": "",
        "approximate_plants": None,
        "drainage": "",
        "support": "",
        "accessibility": "",
    }

def start_session(language: str) -> Dict[str, Any]:
    session_id = str(uuid.uuid4())
    SESSION_STORE[session_id] = {
        "created_at": datetime.now(),
        "language": language,
        "current_field_index": 0,
        "state": get_empty_state()
    }
    
    first_field = FIELD_ORDER[0]
    question = QUESTIONS_TA[first_field] if language == "ta-IN" else QUESTIONS_EN[first_field]
    
    return {
        "session_id": session_id,
        "current_field": first_field,
        "question": question,
        "farm_state": SESSION_STORE[session_id]["state"], # Always returns valid object
        "complete": False
    }

def process_turn(session_id: str, transcript: str, current_field: str, language: str) -> Dict[str, Any]:
    if session_id not in SESSION_STORE:
        raise ValueError("Session not found")
    
    session = SESSION_STORE[session_id]
    state = session["state"]
    idx = session["current_field_index"]
    
    value = transcript.strip()
    
    # ✅ FIX: Convert numeric fields to numbers before saving
    if current_field in ["total_farm_acres", "banana_area_acres", "approximate_plants"]:
        try:
            # Try to convert to float (handles "5", "5.5", "five" if using NLP later)
            # For now, we keep it as string if it's not a pure number to avoid crashes
            if value.replace('.', '', 1).isdigit():
                state[current_field] = float(value) if '.' in value else int(value)
            else:
                state[current_field] = value # Keep as string if user spoke text
        except:
            state[current_field] = value
    else:
        state[current_field] = value

    idx += 1
    session["current_field_index"] = idx
    
    is_complete = idx >= len(FIELD_ORDER)
    
    next_field = ""
    next_question = ""
    reply_text = ""
    
    if is_complete:
        next_field = "complete"
        next_question = "Registration Complete"
        reply_text = "பதிவு முடிந்தது!" if language == "ta-IN" else "Registration complete!"
    else:
        next_field = FIELD_ORDER[idx]
        next_question = QUESTIONS_TA[next_field] if language == "ta-IN" else QUESTIONS_EN[next_field]
        reply_text = "சரி, அடுத்து..." if language == "ta-IN" else "Okay, next..."

    return {
        "session_id": session_id,
        "accepted": True,
        "current_field": next_field,
        "next_field": next_field,
        "next_question": next_question,
        "reply_text": reply_text,
        "farm_state": state,
        "complete": is_complete
    }