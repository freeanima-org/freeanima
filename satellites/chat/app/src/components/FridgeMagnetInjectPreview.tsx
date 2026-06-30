import { FridgeMagnetInjectPreview as SharedFridgeMagnetInjectPreview } from "@freeanima/ui-kit/ui/fridge-magnet";
import { m } from "@chat/lib/i18n.ts";

type FridgeMagnetInjectPreviewProps = {
  injectText: string;
  magnetCount: number;
  redisConfigured: boolean;
  loading?: boolean;
  onRefresh?: () => void;
};

export function FridgeMagnetInjectPreview(props: FridgeMagnetInjectPreviewProps) {
  return (
    <SharedFridgeMagnetInjectPreview
      {...props}
      title={m.admin_nav_fridge()}
      refresh={m.admin_common_refresh()}
      redisUnavailable={m.admin_fridge_redis_unavailable()}
      noNotes={m.admin_fridge_no_notes()}
    />
  );
}
