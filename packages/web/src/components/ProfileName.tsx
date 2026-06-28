import { useProfileMeta } from "@/hooks";

/** Resolves a profileId to its display name, falling back to `{prefix} #id`. */
export function ProfileName({
  profileId,
  prefix = "Profile",
  className,
}: {
  profileId: bigint;
  prefix?: string;
  className?: string;
}) {
  const { data: meta } = useProfileMeta(profileId);
  return <span className={className}>{meta?.name || `${prefix} #${profileId}`}</span>;
}
