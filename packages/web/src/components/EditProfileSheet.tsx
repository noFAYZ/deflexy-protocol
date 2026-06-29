import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDeflexy } from "@/deflexy";
import { useTx, withUploadToast } from "@/hooks";
import { uploadProfileMeta, type ProfileMeta } from "@/lib/ipfs";

export function EditProfileSheet({
  open,
  onOpenChange,
  profileId,
  current,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: bigint;
  current?: ProfileMeta | null;
}) {
  const deflexy = useDeflexy();
  const tx = useTx();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (open) {
      setName(current?.name ?? "");
      setBio(current?.bio ?? "");
      tx.setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save() {
    if (!deflexy) return;
    let ref: `0x${string}`;
    try {
      ref = await withUploadToast(uploadProfileMeta(name.trim(), bio.trim()), "Saving profile…");
    } catch (e) {
      tx.setError(e instanceof Error ? e.message : "Upload failed");
      return;
    }
    const ok = await tx.run(
      () => deflexy.write.updateMetadata(profileId, ref),
      [["profileMeta", profileId.toString()]],
      "Profile updated",
    );
    if (ok) {
      qc.setQueryData(["profileMeta", profileId.toString()], { name: name.trim(), bio: bio.trim() });
      onOpenChange(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>Your public name and bio, stored privately on IPFS.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pf-name">Display name</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada Lovelace" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-bio">Bio</Label>
            <Textarea
              id="pf-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              placeholder="What you do, skills, links…"
              className="resize-none"
            />
          </div>
          {tx.error && <p className="text-destructive text-sm">{tx.error}</p>}
          <Button className="w-full" onClick={save} loading={tx.busy} disabled={!name.trim()}>
            Save profile
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
