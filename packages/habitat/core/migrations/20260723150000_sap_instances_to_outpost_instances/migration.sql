ALTER TABLE "sap_instances" RENAME TO "outpost_instances";

-- conversations.platform_info JSONB：satellite_* → outpost_*
UPDATE "conversations"
SET "platform_info" =
  ("platform_info" - 'satellite_app_id' - 'satellite_instance_id')
  || jsonb_strip_nulls(
    jsonb_build_object(
      'outpost_app_id', "platform_info" -> 'satellite_app_id',
      'outpost_instance_id', "platform_info" -> 'satellite_instance_id'
    )
  )
WHERE "platform_info" ? 'satellite_app_id'
   OR "platform_info" ? 'satellite_instance_id';
