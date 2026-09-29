import os


AWS_PROFILE = os.getenv(
    "AWS_PROFILE",
    "vazhaiguard",
)

AWS_REGION = os.getenv(
    "AWS_REGION",
    "ap-south-1",
)

DYNAMODB_TABLE = os.getenv(
    "VAZHAIGUARD_DYNAMODB_TABLE",
    "fai-tce-team53-vazhaiguard-farms",
)

BEDROCK_MODEL_ID = os.getenv(
    "VAZHAIGUARD_TEXT_MODEL",
    "mistral.ministral-3-8b-instruct",
)