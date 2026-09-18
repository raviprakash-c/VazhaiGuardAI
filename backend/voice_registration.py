import json
import os
import re
import uuid
from typing import Any, Dict, Literal, Tuple

import boto3

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


router = APIRouter(
    prefix="/voice/registration",
    tags=["Voice Registration"],
)


AWS_REGION = os.getenv(
    "AWS_REGION",
    "ap-south-1",
)

AWS_PROFILE = os.getenv(
    "AWS_PROFILE"
)

VOICE_MODEL_ID = os.getenv(
    "VOICE_MODEL_ID",
    "mistral.ministral-3-8b-instruct",
)

MIN_ACCEPT_CONFIDENCE = float(
    os.getenv(
        "VOICE_MIN_ACCEPT_CONFIDENCE",
        "0.60",
    )
)


if AWS_PROFILE:
    aws_session = boto3.Session(
        profile_name=AWS_PROFILE,
        region_name=AWS_REGION,
    )
else:
    aws_session = boto3.Session(
        region_name=AWS_REGION,
    )

bedrock = aws_session.client(
    "bedrock-runtime",
    region_name=AWS_REGION,
)


Language = Literal[
    "ta-IN",
    "en-IN",
]


RegistrationField = Literal[
    "farm_name",
    "total_farm_acres",
    "banana_area_acres",
    "banana_variety",
    "planting_age",
    "approximate_plants",
    "drainage",
    "support",
    "accessibility",
    "complete",
]


FIELD_ORDER = [
    "farm_name",
    "total_farm_acres",
    "banana_area_acres",
    "banana_variety",
    "planting_age",
    "approximate_plants",
    "drainage",
    "support",
    "accessibility",
]


QUESTIONS = {
    "ta-IN": {
        "farm_name":
            "வணக்கம்! நான் வாழைகார்டு உதவியாளர். முதல்ல, உங்கள் வாழைத் தோட்டத்துக்கு என்ன பெயர் சொல்லலாம்?",

        "total_farm_acres":
            "உங்களுடைய மொத்த தோட்ட நிலம் சுமார் எத்தனை ஏக்கர்?",

        "banana_area_acres":
            "அந்த மொத்த நிலத்தில் எத்தனை ஏக்கரில் வாழை பயிரிட்டிருக்கீங்க?",

        "banana_variety":
            "சரி. உங்கள் தோட்டத்தில் எந்த வகை வாழை பயிரிட்டிருக்கீங்க? ஜி-9, கிராண்ட் நைன், நேந்திரன், பூவன் மாதிரி சொல்லலாம்.",

        "planting_age":
            "இந்த வாழை நட்டு சுமார் எத்தனை மாதம் ஆகுது? சரியான தேதி தெரியலன்னா பரவாயில்லை.",

        "approximate_plants":
            "சுமார் எத்தனை வாழை மரங்கள் இருக்கும்? தெரியலன்னா தெரியாது என்று சொல்லலாம்.",

        "drainage":
            "பலமான மழைக்கு பிறகு தோட்டத்தில் தண்ணீர் எப்படி இருக்கும்? சீக்கிரம் வெளியேறுமா, கொஞ்ச நேரம் நிக்குமா, இல்ல நீண்ட நேரம் தேங்குமா?",

        "support":
            "வாழை மரங்களுக்கு கம்பு அல்லது ஆதரவு எப்படி இருக்கு? பெரும்பாலான மரங்களுக்கு இருக்கா, சில மரங்களுக்கு மட்டும் இருக்கா, இல்ல பல மரங்களுக்கு இல்லையா?",

        "accessibility":
            "தொழிலாளர்கள் தோட்டத்துக்குள்ள எல்லா பகுதிகளுக்கும் எளிதாக போக முடியுதா?",

        "complete":
            "சரி. அடிப்படை தோட்ட பதிவு முடிந்தது. அடுத்து உங்கள் தோட்டத்தின் இடத்தையும் எல்லையையும் வரைபடத்தில் உறுதி செய்வோம்.",
    },

    "en-IN": {
        "farm_name":
            "Hello! I am your VazhaiGuard assistant. What name would you like to give your banana farm?",

        "total_farm_acres":
            "Approximately how many acres is your total farm?",

        "banana_area_acres":
            "Out of that total farm area, approximately how many acres are planted with banana?",

        "banana_variety":
            "Which banana variety are you growing? For example, G9, Grand Naine, Nendran or Poovan.",

        "planting_age":
            "Approximately how many months ago were these banana plants planted?",

        "approximate_plants":
            "Approximately how many banana plants are there? You can say you do not know.",

        "drainage":
            "After heavy rain, does water drain quickly, remain for some time, or stay waterlogged for a long time?",

        "support":
            "How is the support or propping condition? Do most plants have support, only some plants, or many plants have no support?",

        "accessibility":
            "Can workers easily reach all parts of your farm?",

        "complete":
            "Basic farm registration is complete. Next, we will confirm your location and farm boundary on the map.",
    },
}


FIELD_RULES = {
    "farm_name":
        """
        Extract ONLY the farmer's farm name from the full sentence.

        Examples:
        "எங்க தோட்டத்தோட பெயர் முருகன் தோட்டம்" -> "முருகன் தோட்டம்"
        "எங்க farm name Murugan Thottam" -> "Murugan Thottam"

        Remove conversational filler, but preserve the actual proper name.
        Do not invent or autocorrect a proper name that was not clearly spoken.
        If there is no clear farm name, accepted must be false.
        """,

    "total_farm_acres":
        """
        Extract ONLY the farmer's approximate total farm area in acres.

        Examples:
        "எங்க மொத்த நிலம் அஞ்சு ஏக்கர்" -> 5
        "சுமார் மூணரை ஏக்கர் இருக்கும்" -> 3.5
        "five acres" -> 5
        "2.75 acre" -> 2.75

        Return a number only. Do not include the word acre in the value.
        If the area is unclear, accepted must be false.
        """,

    "banana_area_acres":
        """
        Extract ONLY the area under banana cultivation in acres.

        Examples:
        "அதுல மூணு ஏக்கர் வாழை" -> 3
        "மூணரை ஏக்கர் வாழை போட்டிருக்கோம்" -> 3.5
        "all five acres are banana" -> 5

        If the farmer says the entire/full farm is banana and the farm state
        contains total_farm_acres, use that total area.

        Return a number only. Do not include the word acre in the value.
        If unclear, accepted must be false.
        """,

    "banana_variety":
        """
        Extract ONLY the banana variety from natural speech.

        Examples:
        "நாங்க ஜி நைன் தான் போட்டிருக்கோம்" -> "Grand Naine"
        "G9 banana" -> "Grand Naine"
        "கிராண்ட் நைன்" -> "Grand Naine"
        "நேந்திரன் போட்டிருக்கோம்" -> "Nendran"
        "பூவன் தான்" -> "Poovan"

        Canonicalize common aliases when clear.
        If another variety is clearly stated, preserve it.
        """,

    "planting_age":
        """
        Extract ONLY approximate planting age.

        Examples:
        "ஒரு ஆறு மாசம் இருக்கும்" -> "6 months"
        "ஆறு மாதம் ஆகுது" -> "6 months"
        "one year இருக்கும்" -> "1 year"
        "நாலு முதல் அஞ்சு மாசம்" -> "4-5 months"
        """,

    "approximate_plants":
        """
        Extract ONLY approximate number of banana plants.

        "ஒரு ஆயிரம் மரம் இருக்கும்" -> 1000
        "சுமார் 850 இருக்கும்" -> 850

        Return an integer when known.
        If farmer clearly says they do not know, return null and accepted=true.
        """,

    "drainage":
        """
        Normalize drainage into exactly one of:
        "good", "moderate", "poor".

        good = drains quickly.
        moderate = water remains for some time and then drains.
        poor = waterlogging / remains for a long time.
        """,

    "support":
        """
        Normalize plant support/propping into exactly one of:
        "good", "partial", "low".

        good = most plants needing support are supported.
        partial = only some / roughly half are supported.
        low = many plants have no support.
        """,

    "accessibility":
        """
        Normalize worker accessibility into exactly one of:
        "easy", "moderate", "difficult".
        """,
}


class StartResponse(BaseModel):
    session_id: str
    current_field: RegistrationField
    question: str
    farm_state: Dict[str, Any]
    complete: bool


class TurnRequest(BaseModel):
    session_id: str
    language: Language
    current_field: RegistrationField
    transcript: str
    farm_state: Dict[str, Any]


class TurnResponse(BaseModel):
    session_id: str
    accepted: bool
    current_field: RegistrationField
    next_field: RegistrationField
    normalized_value: Any = None
    reply_text: str
    next_question: str
    farm_state: Dict[str, Any]
    confidence: float
    complete: bool


@router.get(
    "/start",
    response_model=StartResponse,
)
def start_registration(
    language: Language = "ta-IN",
):
    return StartResponse(
        session_id=str(uuid.uuid4()),
        current_field="farm_name",
        question=QUESTIONS[language]["farm_name"],
        farm_state={},
        complete=False,
    )


def extract_json(
    raw_text: str,
) -> Dict[str, Any]:
    cleaned = (
        raw_text
        .replace("```json", "")
        .replace("```", "")
        .strip()
    )

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(
            r"\{.*\}",
            cleaned,
            re.DOTALL,
        )

        if not match:
            raise ValueError(
                "Model did not return JSON."
            )

        return json.loads(
            match.group(0)
        )


def clamp_confidence(
    value: Any,
) -> float:
    try:
        confidence = float(value)
    except (
        TypeError,
        ValueError,
    ):
        return 0.0

    return max(
        0.0,
        min(
            1.0,
            confidence,
        ),
    )


def clean_string_value(
    value: Any,
) -> str:
    if value is None:
        return ""

    text = str(value).strip()

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text.strip(
        " \t\r\n\"'`.,;:!?"
    )


def normalize_acres(
    value: Any,
) -> Tuple[bool, Any]:
    if value is None:
        return False, None

    if isinstance(
        value,
        bool,
    ):
        return False, None

    try:
        if isinstance(
            value,
            (
                int,
                float,
            ),
        ):
            number = float(value)
        else:
            text = (
                clean_string_value(value)
                .lower()
                .replace("acres", "")
                .replace("acre", "")
                .replace(",", "")
                .strip()
            )

            number = float(text)
    except (
        TypeError,
        ValueError,
    ):
        return False, None

    if (
        number <= 0
        or number > 100000
    ):
        return False, None

    if number.is_integer():
        return True, int(number)

    return True, round(number, 2)


def validate_and_normalize(
    field: str,
    value: Any,
) -> Tuple[bool, Any]:
    if field == "farm_name":
        text = clean_string_value(value)

        if not text or len(text) > 100:
            return False, None

        return True, text

    if field in [
        "total_farm_acres",
        "banana_area_acres",
    ]:
        return normalize_acres(value)

    if field == "banana_variety":
        text = clean_string_value(value)

        if not text or len(text) > 80:
            return False, None

        alias = (
            text
            .lower()
            .replace("-", " ")
        )

        alias = re.sub(
            r"\s+",
            " ",
            alias,
        ).strip()

        canonical = {
            "g9": "Grand Naine",
            "g 9": "Grand Naine",
            "grand nain": "Grand Naine",
            "grand naine": "Grand Naine",
            "nendran": "Nendran",
            "poovan": "Poovan",
            "rasthali": "Rasthali",
            "red banana": "Red Banana",
        }

        return (
            True,
            canonical.get(
                alias,
                text,
            ),
        )

    if field == "planting_age":
        text = clean_string_value(value)

        if not text or len(text) > 60:
            return False, None

        return True, text

    if field == "approximate_plants":
        if value is None:
            return True, None

        if isinstance(value, bool):
            return False, None

        if isinstance(
            value,
            (
                int,
                float,
            ),
        ):
            number = int(value)
        else:
            text = (
                clean_string_value(value)
                .replace(",", "")
            )

            if not re.fullmatch(
                r"\d+(?:\.0+)?",
                text,
            ):
                return False, None

            number = int(float(text))

        if number <= 0 or number > 10_000_000:
            return False, None

        return True, number

    allowed_values = {
        "drainage": {
            "good",
            "moderate",
            "poor",
        },
        "support": {
            "good",
            "partial",
            "low",
        },
        "accessibility": {
            "easy",
            "moderate",
            "difficult",
        },
    }

    if field in allowed_values:
        text = clean_string_value(value).lower()

        if text not in allowed_values[field]:
            return False, None

        return True, text

    return False, None


def invoke_extractor(
    field: str,
    transcript: str,
    language: str,
    farm_state: Dict[str, Any],
) -> Dict[str, Any]:
    rule = FIELD_RULES[field]

    prompt = f"""
You are the structured voice-registration intelligence for VazhaiGuard AI,
a farmer-facing application for Tamil Nadu banana farms.

The farmer is speaking naturally, not filling a form with exact keywords.
They may use formal Tamil, colloquial Tamil, Tamil-English mix,
Indian English, filler words, incomplete grammar and small speech-to-text errors.

Your job is SEMANTIC EXTRACTION.
Extract ONLY the information required for CURRENT FIELD.

CURRENT FIELD:
{field}

CURRENT FARM STATE:
{json.dumps(farm_state, ensure_ascii=False)}

FIELD-SPECIFIC RULE:
{rule}

FARMER LANGUAGE:
{language}

FARMER SAID:
{transcript}

IMPORTANT RULES:
1. Extract only the requested field.
2. Ignore greetings, filler and surrounding conversational words.
3. Never invent missing information.
4. Never infer a proper name that was not clearly spoken.
5. If speech-to-text is too broken, accepted must be false.
6. If the farmer answers a different question, accepted must be false.
7. If two incompatible values are stated without resolution, accepted must be false.
8. Confidence is extraction confidence from this transcript.
9. Return STRICT JSON only.

Return when clear:
{{
  "accepted": true,
  "value": "normalized value",
  "confidence": 0.90,
  "reason": "short internal reason"
}}

Return when unclear:
{{
  "accepted": false,
  "value": null,
  "confidence": 0.30,
  "reason": "requested value is unclear or missing"
}}
"""

    try:
        response = bedrock.converse(
            modelId=VOICE_MODEL_ID,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "text": prompt,
                        }
                    ],
                }
            ],
            inferenceConfig={
                "maxTokens": 300,
                "temperature": 0.0,
                "topP": 0.9,
            },
        )

        text = (
            response["output"]
            ["message"]
            ["content"]
            [0]
            ["text"]
        )

        return extract_json(text)

    except Exception as exc:
        print(
            "BEDROCK ERROR:",
            repr(exc),
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Bedrock error: "
                f"{type(exc).__name__}: {str(exc)}"
            ),
        )


def next_field_after(
    current: str,
) -> str:
    try:
        index = FIELD_ORDER.index(current)
    except ValueError:
        return "complete"

    if index == len(FIELD_ORDER) - 1:
        return "complete"

    return FIELD_ORDER[index + 1]


def tamil_value_label(
    field: str,
    value: Any,
) -> str:
    mappings = {
        "drainage": {
            "good": "தண்ணீர் சீக்கிரம் வெளியேறும்",
            "moderate": "சில நேரம் தண்ணீர் நிற்கும்",
            "poor": "தண்ணீர் தேங்கும்",
        },
        "support": {
            "good": "பெரும்பாலான வாழைக்கு ஆதரவு இருக்கு",
            "partial": "சில வாழைக்கு மட்டும் ஆதரவு இருக்கு",
            "low": "பல வாழைக்கு ஆதரவு இல்லை",
        },
        "accessibility": {
            "easy": "தொழிலாளர்கள் எளிதாக செல்ல முடியும்",
            "moderate": "சில இடங்களில் செல்ல சிரமம்",
            "difficult": "தொழிலாளர்கள் செல்ல மிகவும் சிரமம்",
        },
    }

    return (
        mappings
        .get(field, {})
        .get(value, str(value))
    )


def confirmation_text(
    field: str,
    value: Any,
    language: str,
) -> str:
    if language == "en-IN":
        if field == "approximate_plants" and value is None:
            return (
                "That's okay. I will record that "
                "the plant count is not known."
            )

        if field in [
            "total_farm_acres",
            "banana_area_acres",
        ]:
            return f"Okay, I have recorded {value} acres."

        return f"Okay, I have recorded {value}."

    if field == "farm_name":
        return (
            f"சரி, {value} என்று தோட்டத்தின் பெயரை பதிவு பண்ணிக்கிறேன்."
        )

    if field == "total_farm_acres":
        return (
            f"சரி, மொத்த தோட்ட நிலம் சுமார் {value} ஏக்கர் என்று பதிவு பண்ணிக்கிறேன்."
        )

    if field == "banana_area_acres":
        return (
            f"சரி, அதில் {value} ஏக்கரில் வாழை பயிரிட்டிருக்கீங்க என்று பதிவு பண்ணிக்கிறேன்."
        )

    if field == "banana_variety":
        return (
            f"சரி, {value} வாழை என்று பதிவு பண்ணிக்கிறேன்."
        )

    if field == "planting_age":
        return (
            f"சரி, நடவு வயது சுமார் {value} என்று பதிவு பண்ணிக்கிறேன்."
        )

    if field == "approximate_plants":
        if value is None:
            return (
                "பரவாயில்லை. வாழை மரங்களின் எண்ணிக்கை "
                "தெரியவில்லை என்று பதிவு பண்ணிக்கிறேன்."
            )

        return (
            f"சரி, சுமார் {value} வாழை மரங்கள் என்று பதிவு பண்ணிக்கிறேன்."
        )

    if field in [
        "drainage",
        "support",
        "accessibility",
    ]:
        label = tamil_value_label(
            field,
            value,
        )

        return f"சரி, {label} என்று பதிவு பண்ணிக்கிறேன்."

    return "சரி, பதிவு பண்ணிக்கிறேன்."


def retry_text(
    field: str,
    language: str,
) -> str:
    if language == "ta-IN":
        field_prompts = {
            "farm_name":
                "உங்கள் தோட்டத்தின் பெயரை இன்னொரு முறை தெளிவாக சொல்லுங்க.",

            "total_farm_acres":
                "உங்களுடைய மொத்த தோட்ட நிலம் எத்தனை ஏக்கர் என்று இன்னொரு முறை சொல்லுங்க.",

            "banana_area_acres":
                "அந்த மொத்த நிலத்தில் எத்தனை ஏக்கரில் வாழை பயிரிட்டிருக்கீங்க என்று சொல்லுங்க.",

            "banana_variety":
                "நீங்கள் பயிரிட்டுள்ள வாழை வகையை இன்னொரு முறை சொல்லுங்க.",

            "planting_age":
                "வாழை நட்டு சுமார் எத்தனை மாதம் ஆகுது என்று இன்னொரு முறை சொல்லுங்க.",

            "approximate_plants":
                "சுமார் எத்தனை வாழை மரங்கள் இருக்கிறது என்று இன்னொரு முறை சொல்லுங்க. தெரியலன்னா தெரியாது என்று சொல்லலாம்.",

            "drainage":
                "மழைக்குப் பிறகு தண்ணீர் சீக்கிரம் வெளியேறுமா, கொஞ்ச நேரம் நிக்குமா, இல்ல தேங்குமா என்று சொல்லுங்க.",

            "support":
                "வாழை மரங்களுக்கு ஆதரவு பெரும்பாலும் இருக்கா, சில மரங்களுக்கு மட்டும் இருக்கா, இல்ல குறைவா என்று சொல்லுங்க.",

            "accessibility":
                "தொழிலாளர்கள் எல்லா பகுதிகளுக்கும் எளிதாக போக முடியுமா என்று சொல்லுங்க.",
        }

        return (
            "மன்னிக்கவும், அது தெளிவாக புரியவில்லை. "
            + field_prompts.get(
                field,
                QUESTIONS[language][field],
            )
        )

    return (
        "Sorry, I could not understand that clearly. "
        "Please answer this question again. "
        + QUESTIONS[language][field]
    )


@router.post(
    "/turn",
    response_model=TurnResponse,
)
def process_turn(
    request: TurnRequest,
):
    if request.current_field == "complete":
        return TurnResponse(
            session_id=request.session_id,
            accepted=True,
            current_field="complete",
            next_field="complete",
            normalized_value=None,
            reply_text=QUESTIONS[request.language]["complete"],
            next_question=QUESTIONS[request.language]["complete"],
            farm_state=request.farm_state,
            confidence=1.0,
            complete=True,
        )

    clean_transcript = request.transcript.strip()

    if not clean_transcript:
        return TurnResponse(
            session_id=request.session_id,
            accepted=False,
            current_field=request.current_field,
            next_field=request.current_field,
            normalized_value=None,
            reply_text=retry_text(
                request.current_field,
                request.language,
            ),
            next_question=QUESTIONS[
                request.language
            ][
                request.current_field
            ],
            farm_state=request.farm_state,
            confidence=0.0,
            complete=False,
        )

    extraction = invoke_extractor(
        request.current_field,
        clean_transcript,
        request.language,
        request.farm_state,
    )

    model_accepted = bool(
        extraction.get(
            "accepted",
            False,
        )
    )

    confidence = clamp_confidence(
        extraction.get(
            "confidence",
            0.0,
        )
    )

    raw_value = extraction.get("value")

    (
        value_valid,
        normalized_value,
    ) = validate_and_normalize(
        request.current_field,
        raw_value,
    )

    if (
        request.current_field == "banana_area_acres"
        and value_valid
    ):
        total_farm_acres = request.farm_state.get(
            "total_farm_acres"
        )

        if total_farm_acres is not None:
            try:
                if (
                    float(normalized_value)
                    > float(total_farm_acres)
                ):
                    value_valid = False
            except (
                TypeError,
                ValueError,
            ):
                value_valid = False

    accepted = (
        model_accepted
        and value_valid
        and confidence >= MIN_ACCEPT_CONFIDENCE
    )

    print(
        "VOICE EXTRACTION:",
        {
            "field": request.current_field,
            "transcript": clean_transcript,
            "model_accepted": model_accepted,
            "confidence": confidence,
            "raw_value": raw_value,
            "normalized_value": normalized_value,
            "accepted": accepted,
            "reason": extraction.get("reason"),
        },
    )

    if not accepted:
        return TurnResponse(
            session_id=request.session_id,
            accepted=False,
            current_field=request.current_field,
            next_field=request.current_field,
            normalized_value=None,
            reply_text=retry_text(
                request.current_field,
                request.language,
            ),
            next_question=QUESTIONS[
                request.language
            ][
                request.current_field
            ],
            farm_state=request.farm_state,
            confidence=confidence,
            complete=False,
        )

    updated_state = dict(
        request.farm_state
    )

    updated_state[
        request.current_field
    ] = normalized_value

    next_field = next_field_after(
        request.current_field
    )

    confirmation = confirmation_text(
        request.current_field,
        normalized_value,
        request.language,
    )

    if next_field == "complete":
        next_question = QUESTIONS[
            request.language
        ][
            "complete"
        ]

        reply_text = (
            confirmation
            + " "
            + next_question
        )

        complete = True
    else:
        next_question = QUESTIONS[
            request.language
        ][
            next_field
        ]

        reply_text = (
            confirmation
            + " "
            + next_question
        )

        complete = False

    return TurnResponse(
        session_id=request.session_id,
        accepted=True,
        current_field=request.current_field,
        next_field=next_field,
        normalized_value=normalized_value,
        reply_text=reply_text,
        next_question=next_question,
        farm_state=updated_state,
        confidence=confidence,
        complete=complete,
    )
