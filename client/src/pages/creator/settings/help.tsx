import { useState } from "react";
import { SettingsSubShell } from "./_shell";
import { Icon } from "@/components/brand";
import { cn } from "@/lib/utils";

const FAQ: { q: string; a: string }[] = [
  {
    q: "When do I receive payment for a campaign?",
    a: "Earnings are credited to your CreatorX balance the moment an admin approves your deliverable. You can withdraw any time after that, subject to your KYC being verified.",
  },
  {
    q: "Why do you deduct TDS?",
    a: "Indian tax law (Section 194R) requires us to deduct 10% TDS after you earn ₹20,000 in a financial year. Without a valid PAN, TDS is 20%. We file a quarterly return with the IT Department so you can claim the credit while filing your ITR.",
  },
  {
    q: "How is GST calculated on my payouts?",
    a: "If you have a valid GSTIN on file, we add 18% GST on top of your earnings and issue a tax invoice in the format CRX/YY-YY/NNNN. If you don't have a GSTIN, no GST is added.",
  },
  {
    q: "UPI vs bank transfer — which should I use?",
    a: "UPI is instant and free for payouts up to ₹1,00,000. Bank transfers (IMPS/NEFT) are used for any amount, but arrive next business day. We automatically pick the best method when you withdraw.",
  },
  {
    q: "Can I change my handle or email?",
    a: "Yes, your handle can be changed anytime from Edit profile. Email changes require contacting support for verification.",
  },
  {
    q: "What if an admin rejects my deliverable?",
    a: "You'll get feedback in the campaign thread. Submit a revised version — there's no limit on revisions. Earnings are credited only after final approval.",
  },
];

export default function SettingsHelpPage() {
  return (
    <SettingsSubShell title="Help & support" subtitle="We're here to help">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <ContactCard
            icon="mail"
            label="Email us"
            value="support@creatorx.app"
            href="mailto:support@creatorx.app"
          />
          <ContactCard
            icon="chat"
            label="WhatsApp"
            value="+91 73000 11111"
            href="https://wa.me/917300011111"
          />
        </div>

        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Frequently asked
          </h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {FAQ.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} last={i === FAQ.length - 1} />
            ))}
          </div>
        </section>

        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <Icon name="support_agent" filled className="text-primary text-[32px] mx-auto" />
          <div className="font-bold text-sm mt-2">Still need help?</div>
          <div className="text-xs text-muted-foreground mt-1">
            Our team usually replies within 4 business hours.
          </div>
          <a
            href="mailto:support@creatorx.app"
            className="inline-flex mt-3 px-4 h-10 items-center rounded-xl bg-primary text-primary-foreground font-bold text-sm hover-elevate"
            data-testid="button-contact-support"
          >
            Contact support
          </a>
        </div>
      </div>
    </SettingsSubShell>
  );
}

function ContactCard({ icon, label, value, href }: { icon: string; label: string; value: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 bg-card border border-border rounded-2xl hover-elevate"
    >
      <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
        <Icon name={icon} filled className="text-primary text-[20px]" />
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="font-semibold text-sm mt-0.5 truncate">{value}</div>
    </a>
  );
}

function FaqItem({ q, a, last }: { q: string; a: string; last?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(!last && "border-b border-border")}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover-elevate"
      >
        <div className="flex-1 min-w-0 font-semibold text-sm">{q}</div>
        <Icon
          name="expand_more"
          className={cn("text-muted-foreground flex-shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 -mt-1 text-sm text-muted-foreground leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}
