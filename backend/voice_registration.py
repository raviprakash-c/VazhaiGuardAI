import json
import os
import re
import uuid
from typing import Any, Dict, Literal

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

VOICE_MODEL_ID = os.getenv(
    "VOICE_MODEL_ID",
    "mistral.ministral-3-8b-instruct",
)


bedrock = boto3.client(
    "bedrock-runtime",
    region_name=AWS_REGION,
)


Language = Literal[
    "ta-IN",
    "en-IN",
]


RegistrationField = Literal[
    "farm_name",
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
        Extract the name the farmer uses for this farm.
        Return a short string.
        Do not invent a name.
        """,

    "banana_variety":
        """
        Extract the banana variety.
        Preserve known names such as G9, Grand Naine,
        Nendran, Poovan, Rasthali, Red Banana, etc.
        If unclear, accepted must be false.
        """,

    "planting_age":
        """
        Extract approximate planting age.
        Normalize to a concise English representation,
        for example:
        "2 months", "4-6 months", "10 months", "1 year".
        Do not invent an age.
        """,

    "approximate_plants":
        """
        Extract approximate number of banana plants.

        Return an integer when the farmer gives a number.

        If the farmer clearly says they do not know,
        return null and accepted=true.
        """,

    "drainage":
        """
        Normalize drainage into exactly one of:
        "good", "moderate", "poor".

        good = water drains quickly.
        moderate = water remains for some time.
        poor = waterlogging or water remains a long time.
        """,

    "support":
        """
        Normalize plant support/propping into exactly:
        "good", "partial", "low".

        good = most needed plants supported.
        partial = only some supported.
        low = many plants lack support.
        """,

    "accessibility":
        """
        Normalize worker accessibility into exactly:
        "easy", "moderate", "difficult".

        easy = workers can reach most areas easily.
        moderate = some areas are harder.
        difficult = movement is substantially difficult.
        """,
}


class StartResponse(BaseModel):
    session_id: str

    current_field:RegistrationField

    question: str

    farm_state:Dict[str, Any]

    complete: bool


class TurnRequest(BaseModel):
    session_id: str

    language:Language

    current_field:RegistrationField

    transcript: str

    farm_state:Dict[str, Any]


class TurnResponse(BaseModel):
    session_id: str

    accepted: bool

    current_field:RegistrationField

    next_field:RegistrationField

    normalized_value: Any = None

    reply_text: str

    next_question: str

    farm_state:Dict[str, Any]

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

        question=QUESTIONS[
            language
        ]["farm_name"],

        farm_state={},

        complete=False,
    )


def extract_json(
    raw_text: str,
) -> Dict[str, Any]:
    cleaned = (
        raw_text
        .replace(
            "```json",
            ""
        )
        .replace(
            "```",
            ""
        )
        .strip()
    )

    try:
        return json.loads(
            cleaned
        )
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


def invoke_extractor(
    field: str,
    transcript: str,
    language: str,
) -> Dict[str, Any]:
    rule = FIELD_RULES[
        field
    ]

    prompt = f"""
You are VazhaiGuard, an agricultural registration
assistant for banana farmers in Tamil Nadu.

The farmer may speak:
- natural Tamil,
- colloquial Tamil,
- Tamil mixed with English,
- Indian English.

Your task is NOT to answer agricultural questions.

Your only task is to extract the requested registration field
from this farmer utterance.

CURRENT FIELD:
{field}

FIELD RULE:
{rule}

FARMER LANGUAGE:
{language}

FARMER SAID:
{transcript}

Return STRICT JSON ONLY.

Schema:

{{
  "accepted": true,
  "value": "normalized value here",
  "confidence": 0.95
}}

If the answer cannot be understood reliably:

{{
  "accepted": false,
  "value": null,
  "confidence": 0.25
}}

Do not guess.
Do not add Markdown.
Do not explain.
"""

    try:
        response = bedrock.converse(
            modelId=VOICE_MODEL_ID,

            messages=[
                {
                    "role":
                        "user",

                    "content": [
                        {
                            "text":
                                prompt
                        }
                    ],
                }
            ],

            inferenceConfig={
                "maxTokens":
                    250,

                "temperature":
                    0.1,

                "topP":
                    0.9,
            },
        )

        text = (
            response[
                "output"
            ][
                "message"
            ][
                "content"
            ][0][
                "text"
            ]
        )

        return extract_json(
            text
        )

    except Exception as exc:

        print(
        "\n================ BEDROCK ERROR ================"
        )
        print(type(exc).__name__)
        print(repr(exc))
        print("===============================================\n")

        raise HTTPException(
            status_code=502,
            detail=f"Bedrock error: {type(exc).__name__}: {str(exc)}",
        )


def next_field_after(
    current: str,
) -> str:
    try:
        index = (
            FIELD_ORDER.index(
                current
            )
        )

    except ValueError:
        return "complete"

    if (
        index ==
        len(
            FIELD_ORDER
        ) - 1
    ):
        return "complete"

    return FIELD_ORDER[
        index + 1
    ]


def tamil_value_label(
    field: str,
    value: Any,
) -> str:
    mappings = {
        "drainage": {
            "good":
                "தண்ணீர் சீக்கிரம் வெளியேறும்",

            "moderate":
                "சில நேரம் தண்ணீர் நிற்கும்",

            "poor":
                "தண்ணீர் தேங்கும்",
        },

        "support": {
            "good":
                "பெரும்பாலான வாழைக்கு ஆதரவு இருக்கு",

            "partial":
                "சில வாழைக்கு மட்டும் ஆதரவு இருக்கு",

            "low":
                "பல வாழைக்கு ஆதரவு இல்லை",
        },

        "accessibility": {
            "easy":
                "தொழிலாளர்கள் எளிதாக செல்ல முடியும்",

            "moderate":
                "சில இடங்களில் செல்ல சிரமம்",

            "difficult":
                "தொழிலாளர்கள் செல்ல மிகவும் சிரமம்",
        },
    }

    return (
        mappings
        .get(
            field,
            {}
        )
        .get(
            value,
            str(value)
        )
    )


def confirmation_text(
    field: str,
    value: Any,
    language: str,
) -> str:
    if (
        language ==
        "en-IN"
    ):
        if (
            field ==
            "approximate_plants" and
            value is None
        ):
            return (
                "That's okay. "
                "I will record that the plant count is not known."
            )

        return (
            f"Okay, I have recorded {value}."
        )

    if (
        field ==
        "farm_name"
    ):
        return (
            f"சரி, {value} என்று தோட்டத்தின் பெயரை பதிவு பண்ணிக்கிறேன்."
        )

    if (
        field ==
        "banana_variety"
    ):
        return (
            f"சரி, {value} வாழை என்று பதிவு பண்ணிக்கிறேன்."
        )

    if (
        field ==
        "planting_age"
    ):
        return (
            f"சரி, நடவு வயது சுமார் {value} என்று பதிவு பண்ணிக்கிறேன்."
        )

    if (
        field ==
        "approximate_plants"
    ):
        if value is None:
            return (
                "பரவாயில்லை. வாழை மரங்களின் எண்ணிக்கை தெரியவில்லை என்று பதிவு பண்ணிக்கிறேன்."
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

        return (
            f"சரி, {label} என்று பதிவு பண்ணிக்கிறேன்."
        )

    return (
        "சரி, பதிவு பண்ணிக்கிறேன்."
    )


@router.post(
    "/turn",
    response_model=TurnResponse,
)
def process_turn(
    request: TurnRequest,
):
    if (
        request.current_field ==
        "complete"
    ):
        return TurnResponse(
            session_id=
                request.session_id,

            accepted=True,

            current_field=
                "complete",

            next_field=
                "complete",

            normalized_value=
                None,

            reply_text=
                QUESTIONS[
                    request.language
                ][
                    "complete"
                ],

            next_question=
                QUESTIONS[
                    request.language
                ][
                    "complete"
                ],

            farm_state=
                request.farm_state,

            confidence=
                1.0,

            complete=True,
        )

    extraction =invoke_extractor(
            request.current_field,
            request.transcript,
            request.language,
        )

    accepted = bool(
        extraction.get(
            "accepted",
            False,
        )
    )

    confidence = float(
        extraction.get(
            "confidence",
            0.0,
        )
    )

    value = extraction.get(
        "value"
    )

    if not accepted:
        if (
            request.language ==
            "ta-IN"
        ):
            retry = (
                "மன்னிக்கவும், அது தெளிவாக புரியவில்லை. "
                "இன்னொரு முறை கொஞ்சம் மெதுவாக சொல்லுங்கள். "
                +
                QUESTIONS[
                    request.language
                ][
                    request.current_field
                ]
            )

        else:
            retry = (
                "Sorry, I could not understand that clearly. "
                "Please say it again. "
                +
                QUESTIONS[
                    request.language
                ][
                    request.current_field
                ]
            )

        return TurnResponse(
            session_id=
                request.session_id,

            accepted=False,

            current_field=
                request.current_field,

            next_field=
                request.current_field,

            normalized_value=
                None,

            reply_text=
                retry,

            next_question=
                QUESTIONS[
                    request.language
                ][
                    request.current_field
                ],

            farm_state=
                request.farm_state,

            confidence=
                confidence,

            complete=False,
        )

    updated_state = dict(
        request.farm_state
    )

    updated_state[
        request.current_field
    ] = value

    next_field =next_field_after(
            request.current_field
        )

    confirmation =confirmation_text(
            request.current_field,
            value,
            request.language,
        )

    if (
        next_field ==
        "complete"
    ):
        next_question =  QUESTIONS[
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
        next_question =QUESTIONS[
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
        session_id=
            request.session_id,

        accepted=True,

        current_field=
            request.current_field,

        next_field=
            next_field,

        normalized_value=
            value,

        reply_text=
            reply_text,

        next_question=
            next_question,

        farm_state=
            updated_state,

        confidence=
            confidence,

        complete=
            complete,
    )