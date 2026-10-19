import json
import os
import subprocess
import sys
import unittest
from pathlib import Path


class VoiceRegistrationAwsProfileTests(unittest.TestCase):
    def test_default_profile_matches_backend_bedrock_session(self):
        backend_dir = Path(__file__).resolve().parents[1]
        script = r"""
import json
import os
from unittest.mock import MagicMock, patch

os.environ.pop("AWS_PROFILE", None)
with patch("boto3.Session", return_value=MagicMock()) as mocked_session:
    import voice_registration
    print(json.dumps({
        "profile": voice_registration.AWS_PROFILE,
        "session_calls": [
            {"args": list(call.args), "kwargs": call.kwargs}
            for call in mocked_session.call_args_list
        ],
    }))
"""
        environment = os.environ.copy()
        environment.pop("AWS_PROFILE", None)
        result = subprocess.run(
            [sys.executable, "-c", script],
            cwd=backend_dir,
            env=environment,
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertEqual(
            result.returncode,
            0,
            msg=f"Fresh voice-registration import failed: {result.stderr}",
        )
        payload = json.loads(result.stdout)
        self.assertEqual(payload["profile"], "vazhaiguard")
        self.assertTrue(payload["session_calls"])
        self.assertEqual(
            payload["session_calls"][0]["kwargs"].get("profile_name"),
            "vazhaiguard",
        )
        self.assertEqual(
            payload["session_calls"][0]["kwargs"].get("region_name"),
            "ap-south-1",
        )


if __name__ == "__main__":
    unittest.main()
