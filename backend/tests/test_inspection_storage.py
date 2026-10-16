import unittest
from unittest.mock import MagicMock, patch

# Avoid requiring a developer's local AWS SSO profile during unit tests.
with patch("boto3.Session") as _session_factory:
    _session_factory.return_value.resource.return_value.Table.return_value = MagicMock()
    from services import inspection_storage


class InspectionStorageTests(unittest.TestCase):
    def test_store_photo_reports_not_configured_without_bucket(self):
        with patch.object(inspection_storage, "S3_BUCKET", ""):
            result = inspection_storage.store_photo(
                farm_id="farm-1",
                inspection_id="insp-1",
                image_bytes=b"jpeg-bytes",
                content_type="image/jpeg",
            )

        self.assertFalse(result["stored"])
        self.assertEqual(result["status"], "not_configured")
        self.assertIsNone(result["key"])

    @patch("services.inspection_storage.get_s3_client")
    def test_store_photo_uses_private_prefixed_key_and_encryption(self, get_client):
        client = MagicMock()
        get_client.return_value = client

        with patch.object(
            inspection_storage,
            "S3_BUCKET",
            "team-demo-inspections",
        ), patch.object(inspection_storage, "S3_PREFIX", "inspections"):
            result = inspection_storage.store_photo(
                farm_id="farm/unsafe",
                inspection_id="insp:001",
                image_bytes=b"jpeg-bytes",
                content_type="image/jpeg",
            )

        self.assertTrue(result["stored"])
        self.assertEqual(result["status"], "stored")
        self.assertEqual(
            result["key"],
            "inspections/farm_unsafe/insp_001/photo.jpg",
        )
        client.put_object.assert_called_once_with(
            Bucket="team-demo-inspections",
            Key="inspections/farm_unsafe/insp_001/photo.jpg",
            Body=b"jpeg-bytes",
            ContentType="image/jpeg",
            ServerSideEncryption="AES256",
            Metadata={"farm-id": "farm_unsafe", "inspection-id": "insp_001"},
        )

    @patch("services.inspection_storage.get_s3_client")
    def test_s3_health_does_not_list_when_bucket_missing(self, get_client):
        with patch.object(inspection_storage, "S3_BUCKET", ""):
            result = inspection_storage.s3_health()

        self.assertFalse(result["configured"])
        self.assertEqual(result["status"], "not_configured")
        get_client.assert_not_called()

    @patch("services.inspection_storage.get_s3_client")
    def test_s3_health_reports_provider_failure_without_crashing(self, get_client):
        get_client.return_value.list_objects_v2.side_effect = PermissionError("denied")

        with patch.object(
            inspection_storage,
            "S3_BUCKET",
            "team-demo-inspections",
        ):
            result = inspection_storage.s3_health()

        self.assertTrue(result["configured"])
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["bucket"], "team-demo-inspections")


if __name__ == "__main__":
    unittest.main()
