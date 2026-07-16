import { useParams, Link, Navigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { ShieldCheck, FileText, Stethoscope } from "lucide-react";

const EFFECTIVE_DATE = "July 15, 2026";

// GitHub repository used as the contact channel for privacy/legal questions —
// there is no company, account system, or support inbox behind this app.
const REPO_URL = "https://github.com/dizzafizza/Meditrax";

// All legal copy lives here so the three documents stay consistent with the
// app's actual architecture: local-only storage, no server, no accounts,
// optional user-supplied OpenRouter key.
const DOCS = {
  privacy: {
    title: "Privacy Policy",
    icon: ShieldCheck,
    sections: [
      {
        h: "The short version",
        p: [
          "Meditrax is an offline-first app. Your data — medications, dose logs, mood check-ins, health profile, notes — is stored only on your device, in your browser's local storage (IndexedDB). We do not operate a server, we do not have user accounts, and we cannot see, collect, sell, or share your data. We couldn't even if we wanted to: it never leaves your device unless you send it somewhere.",
        ],
      },
      {
        h: "What data the app stores locally",
        p: [
          "Medications and schedules, dose logs (including amounts, times, mood, effectiveness ratings and notes), mood check-ins, effect-tracking sessions and the per-medication timing models learned from them, inventory counts, taper and cyclic dosing plans, family profiles and health details you enter (allergies, conditions, emergency contacts), app settings, AI assistant configuration (including your API key), and AI chat history. All of it stays in IndexedDB on this device.",
          "Because storage is local, clearing your browser data, uninstalling the app, or losing the device deletes your data. Use Settings → Export to make your own backups — the backup file is created on your device and saved wherever you choose.",
        ],
      },
      {
        h: "The optional AI features",
        p: [
          "AI features (assistant chat, medication research, AI insights) are off until you add your own OpenRouter API key in Settings. The key is stored only on your device and is sent only to OpenRouter (openrouter.ai) to authenticate your requests.",
          "When you use an AI feature, the content needed for that request is sent to OpenRouter and the model provider you selected. For AI insights, that is a compact numeric summary (adherence percentages, refill projections, mood trends, usage-pattern signals and medication names) — your free-text notes are not included. For assistant chat, whatever you type and relevant context (such as your medication list) is sent. OpenRouter's and the model providers' own privacy policies govern how they handle those requests. If you never add a key, nothing is ever transmitted anywhere.",
        ],
      },
      {
        h: "International data transfers",
        p: [
          "If you add an OpenRouter API key and use an AI feature, the request described above is sent to OpenRouter and the model provider you selected, which may process it on servers outside your country — commonly the United States. That transfer happens only for the request you triggered, only with data you chose to send, and only because you supplied your own key. If you never use an AI feature, no data ever crosses a border, because it never leaves your device.",
        ],
      },
      {
        h: "What we don't do",
        p: [
          "No analytics, no tracking pixels, no advertising, no cookies for tracking, no fingerprinting, no telemetry. Fonts and all other app assets are bundled with the App (self-hosted) rather than loaded from a third-party CDN, so the App makes zero network requests at startup or while idle — the only network activity, ever, is the OpenRouter call you explicitly trigger with your own key.",
        ],
      },
      {
        h: "Notifications",
        p: [
          "Dose reminders use your device's local notification system. Reminder scheduling happens on your device; no reminder data is sent to any server.",
        ],
      },
      {
        h: "Family profiles",
        p: [
          "If you track medications for family members, that data is also stored only on this device. You are responsible for having their permission to record their health information.",
        ],
      },
      {
        h: "Health information & special category data",
        p: [
          "Some information you choose to enter — medications, conditions, allergies, dependency-risk and behaviour signals — is sensitive health information (\"special category data\" under GDPR Art. 9). Because it is stored only on your device and never transmitted to us, Meditrax is not a \"covered entity\" or \"business associate\" under the U.S. Health Insurance Portability and Accountability Act (HIPAA), and HIPAA does not apply to your use of the App. The protection here comes from the App's architecture — your data physically never reaches a server we operate — not from a regulatory relationship, so you remain responsible for securing the device it lives on.",
        ],
      },
      {
        h: "Children's privacy",
        p: [
          "Meditrax is not directed at children and we do not knowingly collect personal information from anyone, of any age — we don't collect data from anyone, period. Consistent with the U.S. Children's Online Privacy Protection Act (COPPA) and EU/UK rules on the age of consent for information-society services, you must be at least 16 years old to use the App on your own, or use it under the supervision of a parent or guardian (see Terms of Use). If a parent or guardian records a minor's medications using a family profile, that data stays on the same device under the adult's control, exactly like any other profile.",
        ],
      },
      {
        h: "Your rights under GDPR, CCPA/CPRA and other privacy laws",
        p: [
          "Because Meditrax never receives, stores, or has access to your personal data, there is nothing on our side to request, correct, delete, or export — you already hold the only copy, and every right below is exercised directly in the App rather than through a request to us:",
          "• Access & portability (GDPR Art. 15/20, CCPA \"right to know\"): Settings → Export gives you a complete, machine-readable copy of your data at any time.",
          "• Rectification (GDPR Art. 16): edit any record directly in the App.",
          "• Erasure (GDPR \"right to be forgotten\", CCPA \"right to delete\"): delete a profile, or clear the App's site data / uninstall it, to permanently remove everything.",
          "• Restriction & objection (GDPR Art. 18/21): simply stop using a feature — nothing continues to run or process data in the background.",
          "• No sale or sharing of personal information, and no targeted or cross-context behavioural advertising (CCPA/CPRA and similar laws in Colorado, Connecticut, Virginia, Utah and other U.S. states) — we cannot sell or share what we never receive.",
          "• No automated decision-making or profiling with legal or similarly significant effects (GDPR Art. 22) — behaviour/dependency signals are informational only (see Medical Disclaimer) and are never used to make decisions about you.",
          "This applies equally to users in the EU/EEA, UK (UK GDPR), Canada (PIPEDA), Australia (Privacy Act 1988), Brazil (LGPD), and any other jurisdiction: the same local-only architecture means the same rights, exercised the same self-service way, everywhere. We don't honour Do Not Track / Global Privacy Control signals with a special response because there is no tracking to turn off in the first place.",
        ],
      },
      {
        h: "Your control",
        p: [
          "Export your data at any time (Settings → Export). Delete everything by deleting profiles, clearing browser site data, or uninstalling the app. There is no copy on our side to request or delete — you hold the only copy.",
        ],
      },
      {
        h: "Contact us",
        p: [
          `Meditrax is an independently developed project with no company, account system, or support inbox behind it. Privacy questions or concerns can be raised by opening an issue at ${REPO_URL}. Because we hold no personal data, most requests are already answered above — but we're glad to explain how any part of the App works.`,
        ],
      },
      {
        h: "Changes",
        p: [
          "If this policy changes, the updated version ships with an app update and the effective date above is revised. Material changes will be noted in the release notes.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    icon: FileText,
    sections: [
      {
        h: "Agreement",
        p: [
          "By using Meditrax (the \"App\") you agree to these Terms of Use, which also serve as the App's terms of service. If you do not agree, do not use the App.",
        ],
      },
      {
        h: "What Meditrax is — and is not",
        p: [
          "Meditrax is a personal medication tracking and educational tool. It is NOT a medical device, does not provide medical advice, diagnosis, or treatment, and is not a substitute for professional medical care. Refill projections, adherence statistics, behaviour signals, taper plans and AI-generated content are informational estimates that can be wrong.",
          "Never start, stop, or change a medication based on anything in this App without consulting your prescriber or pharmacist. Taper plans generated by the App are illustrative models to discuss with a clinician, not instructions.",
        ],
      },
      {
        h: "Your responsibilities",
        p: [
          "You are responsible for the accuracy of the data you enter, for verifying medication information against official sources (package inserts, your pharmacist), for backing up your data via Export, and for securing the device the data lives on. If you track medications for others (family profiles), you are responsible for having their consent.",
          "You must be at least 16 years old to use the App on your own, or use it under the supervision of a parent or guardian who controls the device and any family profiles on it — consistent with COPPA (US) and the age-of-consent rules for online services in the EU/UK.",
        ],
      },
      {
        h: "AI features",
        p: [
          "AI features require your own OpenRouter API key and are billed to you by OpenRouter under their terms. AI-generated content (drug information, insights, chat responses) can be inaccurate, incomplete or outdated — verify anything that matters with a professional source. You are responsible for your use of the AI features and for the costs they incur.",
        ],
      },
      {
        h: "Emergencies",
        p: [
          "The App is not for emergencies. If you experience an overdose, a severe reaction, or a mental-health crisis, contact your local emergency number immediately (911 in North America, 999 in the UK, 112 across the EU, 000 in Australia), or call/text 988 (Suicide & Crisis Lifeline, US/Canada).",
        ],
      },
      {
        h: "No warranty",
        p: [
          "The App is provided \"as is\" and \"as available\", without warranties of any kind, express or implied, including fitness for a particular purpose, accuracy, or uninterrupted availability. Reminders may fail to fire (especially in the background on iOS); projections may be wrong; local data may be lost if your browser storage is cleared.",
        ],
      },
      {
        h: "Limitation of liability",
        p: [
          "To the maximum extent permitted by law, the developers and contributors of Meditrax shall not be liable for any indirect, incidental, special, consequential or exemplary damages — including harm arising from missed or incorrect doses, reliance on projections or AI output, or loss of data — arising from your use of, or inability to use, the App.",
        ],
      },
      {
        h: "Governing law & your statutory rights",
        p: [
          "These Terms are intended to apply wherever you use the App. To the extent your local law permits, they are governed by general contract-law principles without regard to conflict-of-laws rules. Nothing in these Terms limits or waives any statutory right that cannot lawfully be excluded under the law of your country of residence — for example, EU/UK consumer-protection law, Australian Consumer Law's consumer guarantees, or equivalent protections elsewhere. If any term above conflicts with a mandatory protection you're entitled to, your local mandatory protection controls for that term only, and every other term stays in effect.",
        ],
      },
      {
        h: "Severability",
        p: [
          "If any provision of these Terms is found unenforceable or invalid under applicable law, that provision is limited or removed to the minimum extent necessary, and the remaining provisions remain in full force and effect.",
        ],
      },
      {
        h: "Changes and termination",
        p: [
          "These terms may be updated with app updates; continued use after an update constitutes acceptance. You can stop using the App at any time; since all data is local, deleting the App and its site data removes everything.",
        ],
      },
    ],
  },
  disclaimer: {
    title: "Medical Disclaimer",
    icon: Stethoscope,
    sections: [
      {
        h: "Educational information only",
        p: [
          "All content in Meditrax — the medication knowledge base, AI-generated drug information, adherence analytics, refill projections, mood and behaviour insights, dependency-risk signals, and taper plans — is general educational information. It is not medical advice and does not create a clinician–patient relationship.",
        ],
      },
      {
        h: "Behaviour & dependency signals",
        p: [
          "The usage-pattern and dependency-risk features compute statistical signals from your own logs. They cannot diagnose dependency, addiction, or any condition, and a high or low score means neither that you have nor that you don't have a problem. They exist to support self-awareness and better conversations with your prescriber. If anything in them resonates with you, bring it to your next appointment.",
        ],
      },
      {
        h: "Never change medication on your own",
        p: [
          "Never start, stop, skip, or change the dose of a prescribed medication without professional guidance. Some medications (for example benzodiazepines, opioids, antidepressants, anticonvulsants and corticosteroids) can be dangerous to stop abruptly. Taper plans in this App are mathematical illustrations to discuss with your clinician — not a schedule to follow on your own.",
        ],
      },
      {
        h: "Accuracy limits",
        p: [
          "Drug information may be incomplete, region-specific, or out of date, and AI-generated entries can contain errors. Always confirm dosing, interactions and warnings with your pharmacist, prescriber, or the official product information.",
        ],
      },
      {
        h: "If you need help now",
        p: [
          "For overdose or severe reactions call your local emergency number (911 in North America, 999 in the UK, 112 across the EU, 000 in Australia) or poison control (1-800-222-1222 in the US). If you feel unable to control your medication use, or you're in crisis: call or text 988 (Suicide & Crisis Lifeline, US/Canada), contact the SAMHSA helpline at 1-800-662-4357 (US, free, confidential, 24/7), call Samaritans at 116 123 (UK & Ireland, free, 24/7), or Lifeline at 13 11 14 (Australia).",
          "Outside these countries, search for \"[your country] suicide or crisis helpline\" or contact a local emergency service — this App cannot provide region-specific numbers for every country, and it is never a substitute for local emergency services.",
        ],
      },
    ],
  },
};

export default function Legal() {
  const { doc } = useParams();
  const d = DOCS[doc];
  if (!d) return <Navigate to="/legal/privacy" replace />;
  const Icon = d.icon;

  return (
    <div>
      <PageHeader back title={d.title} subtitle={`Effective ${EFFECTIVE_DATE}`} />
      <div className="px-4 pb-8 space-y-4">
        <div className="card-soft p-4 flex gap-3 items-start">
          <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Meditrax stores your data only on this device and provides educational information, not medical advice.
          </p>
        </div>

        {d.sections.map((s) => (
          <section key={s.h} className="card-soft p-4">
            <h2 className="font-semibold mb-2">{s.h}</h2>
            {s.p.map((t, i) => (
              <p key={i} className="text-sm text-muted-foreground mt-2 first:mt-0">{t}</p>
            ))}
          </section>
        ))}

        <div className="flex flex-wrap gap-2 justify-center pt-2">
          {Object.entries(DOCS).filter(([k]) => k !== doc).map(([k, v]) => (
            <Link key={k} to={`/legal/${k}`} className="text-xs rounded-full border border-border px-3 py-1.5 text-primary" data-testid={`legal-link-${k}`}>
              {v.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
