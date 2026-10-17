import { Mail, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { gmailComposeUrl } from "@/lib/contact-links";

function whatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export function DesktopContactActions({
  phone,
  email,
  compact = false,
}: {
  phone?: string | null;
  email?: string | null;
  compact?: boolean;
}) {
  if (!phone && !email) return null;

  return (
    <div className="hidden flex-wrap items-center gap-1.5 md:flex">
      {phone ? (
        <Button asChild size="sm" variant="outline" className={compact ? "px-2" : undefined}>
          <a
            href={`https://web.whatsapp.com/send?phone=${whatsappNumber(phone)}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open WhatsApp Web for ${phone}`}
            title="Open WhatsApp Web"
          >
            <MessageCircle className="size-3.5" />
            {compact ? <span className="sr-only">WhatsApp</span> : "WhatsApp"}
          </a>
        </Button>
      ) : null}
      {email ? (
        <Button asChild size="sm" variant="outline" className={compact ? "px-2" : undefined}>
          <a
            href={gmailComposeUrl(email)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Email ${email} in Gmail`}
            title="Compose in Gmail"
          >
            <Mail className="size-3.5" />
            {compact ? <span className="sr-only">Email</span> : "Email"}
          </a>
        </Button>
      ) : null}
    </div>
  );
}
