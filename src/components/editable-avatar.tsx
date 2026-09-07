import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/lib/auth";
import { uploadAvatar } from "@/services/avatars";
import { toastError } from "@/lib/toast-error";
import { cn } from "@/lib/utils";

/**
 * Аватар на собствения профил с покана за качване: при посочване с мишка или
 * докосване се появява тъмен слой с икона на фотоапарат, който отваря избора
 * на файл. Показва се само за собствения профил.
 */
export function EditableAvatar({
  className,
  textClassName,
  label = "Смени",
}: {
  className?: string;
  textClassName?: string;
  label?: string;
}) {
  const { user, updateUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const pick = async (file: File) => {
    setBusy(true);
    try {
      const path = await uploadAvatar(user.id, file);
      await updateUser({ avatarUrl: path });
      toast.success("Профилната снимка е обновена.");
    } catch (err) {
      toastError(err, { title: "Снимката не беше качена" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("group relative shrink-0", className)}>
      <UserAvatar
        userId={user.id}
        name={user.name}
        src={user.avatarUrl}
        withPersonIcon
        className="h-full w-full"
        textClassName={textClassName}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
      <button
        type="button"
        aria-label="Качи профилна снимка"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="absolute inset-0 grid place-items-center rounded-full bg-slate-900/55 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 active:opacity-100 md:opacity-0"
      >
        <span className="flex flex-col items-center gap-0.5">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
          <span className="text-[10px] font-semibold leading-none">{label}</span>
        </span>
      </button>
    </div>
  );
}
