import { useState } from "react";
import { BadgeCheck, Loader2, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SMS_PHONE_VERIFICATION_ENABLED } from "@/lib/feature-flags";
import {
  confirmPhoneCode,
  phoneVerificationMessage,
  requestPhoneCode,
} from "@/lib/phone-verification.functions";

export function usePhoneVerified(userId?: string) {
  return useQuery({
    queryKey: ["profile", "phone-verified", userId],
    enabled: Boolean(userId) && SMS_PHONE_VERIFICATION_ENABLED,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone_verified_at")
        .eq("id", userId!)
        .maybeSingle();
      return Boolean(data?.phone_verified_at);
    },
  });
}

/**
 * Потвърждение на телефона с 6-цифрен код. Показва се само когато функцията е
 * включена от `src/lib/feature-flags.ts`.
 */
export function PhoneVerificationCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const verified = usePhoneVerified(user?.id);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");

  if (!SMS_PHONE_VERIFICATION_ENABLED) return null;

  const send = async () => {
    setSending(true);
    try {
      const res = await requestPhoneCode();
      if (!res.ok) {
        toast.error(phoneVerificationMessage(res.error));
        return;
      }
      setSent(true);
      toast.success("Изпратихме ти код по SMS. Валиден е 5 минути.");
    } catch {
      toast.error("Кодът не беше изпратен. Опитай пак.");
    } finally {
      setSending(false);
    }
  };

  const confirm = async () => {
    setChecking(true);
    try {
      const res = await confirmPhoneCode({ data: { code } });
      if (!res.ok) {
        toast.error(phoneVerificationMessage(res.error, res.attemptsLeft));
        return;
      }
      setCode("");
      setSent(false);
      await qc.invalidateQueries({ queryKey: ["profile", "phone-verified"] });
      toast.success("Телефонът ти е потвърден.");
    } catch {
      toast.error("Кодът не беше проверен. Опитай пак.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <PhoneCall className="h-4 w-4 text-muted-foreground" />
        Потвърждение на телефона
      </h3>

      {verified.data ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <BadgeCheck className="h-4 w-4" />
          Телефонът ти е потвърден.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Потвърденият номер показва на другите, че си истински човек, и е нужен, за да публикуваш задача
            или да отключиш контакт. Смяната на номера изисква ново потвърждение.
          </p>
          {sent ? (
            <div className="mt-3 space-y-2">
              <Label htmlFor="sms-code">Код от SMS</Label>
              <div className="flex gap-2">
                <Input
                  id="sms-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="max-w-[8rem] tracking-widest"
                />
                <Button onClick={() => void confirm()} disabled={checking || code.length !== 6}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Потвърди"}
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void send()} disabled={sending}>
                Изпрати нов код
              </Button>
            </div>
          ) : (
            <Button className="mt-3" onClick={() => void send()} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Изпрати код по SMS"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
