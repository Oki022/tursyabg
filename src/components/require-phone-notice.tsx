import { Link } from "@tanstack/react-router";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Приятелско съобщение, когато потребителят още няма телефон в профила си. */
export function RequirePhoneNotice({
  title = "Добави телефон, за да продължиш",
  description = "Телефонният ти номер се пази скрит и се показва само на майстор, който плати, за да види контакта ти.",
  className = "",
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-amber-200 bg-amber-50 p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <PhoneCall className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">{title}</p>
          <p className="mt-1 text-sm text-amber-800">{description}</p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/settings/profile">Добави телефон</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
