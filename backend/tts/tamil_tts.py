from pathlib import Path
import asyncio

import edge_tts


BASE_DIR = (
    Path(__file__)
    .resolve()
    .parent
    .parent
)

OUTPUT_DIR = (
    BASE_DIR
    / "generated_audio"
)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


TAMIL_VOICE = (
    "ta-IN-ValluvarNeural"
)


TAMIL_QUESTIONS = {
    "farm_name":
        "வணக்கம். உங்க தோட்டத்தோட பெயர் என்ன?",

    "total_farm_acres":
        "உங்களுடைய மொத்த தோட்ட நிலம் சுமார் எத்தனை ஏக்கர்?",

    "banana_area_acres":
        "அந்த மொத்த நிலத்தில் எத்தனை ஏக்கரில் வாழை பயிரிட்டிருக்கீங்க?",

    "banana_variety":
        "உங்க தோட்டத்துல எந்த வகை வாழை பயிரிட்டிருக்கீங்க?",

    "planting_age":
        "இந்த வாழை நட்டு சுமார் எத்தனை மாதம் ஆகுது?",

    "approximate_plants":
        "உங்க தோட்டத்துல சுமார் எத்தனை வாழை மரங்கள் இருக்கு?",

    "drainage":
        "பலமான மழை பெய்த பிறகு தோட்டத்துல தண்ணீர் சீக்கிரம் வெளியேறுமா, இல்ல தேங்குமா?",

    "support":
        "வாழை மரங்களுக்கு ஆதரவு கம்பு எப்படி இருக்கு? பெரும்பாலான மரங்களுக்கு இருக்கா, சில மரங்களுக்கு மட்டும் இருக்கா?",

    "accessibility":
        "தொழிலாளர்கள் தோட்டத்துக்குள்ள எல்லா பகுதிகளுக்கும் எளிதாக போக முடியுதா?",

    "confirmed":
        "சரி, பதிவு பண்ணிக்கிறேன்.",

    "retry":
        "சரியாக புரியல. இன்னொரு முறை சொல்லுங்க.",

    "complete":
        "சரி. அடிப்படை தோட்ட பதிவு முடிந்தது. அடுத்து உங்கள் தோட்டத்தின் இடத்தையும் எல்லையையும் வரைபடத்தில் உறுதி செய்வோம்.",
}


async def _generate(
    text: str,
    output_path: Path,
):
    communicate = edge_tts.Communicate(
        text=text,
        voice=TAMIL_VOICE,
        rate="-5%",
    )

    await communicate.save(
        str(output_path)
    )


def generate_question_audio(
    field: str,
) -> Path:

    text = TAMIL_QUESTIONS.get(
        field
    )

    if not text:
        raise ValueError(
            f"Unknown Tamil field: {field}"
        )

    output_path = (
        OUTPUT_DIR
        / f"{field}.mp3"
    )

    if (
        output_path.exists()
        and output_path.stat().st_size > 0
    ):
        return output_path

    asyncio.run(
        _generate(
            text,
            output_path,
        )
    )

    return output_path
