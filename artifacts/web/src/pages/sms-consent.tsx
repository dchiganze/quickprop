import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Layout } from '@/components/layout';
import { MessageSquareText, ShieldCheck } from 'lucide-react';

export default function SmsConsent() {
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    const descriptionText =
      'QuickProp SMS consent and message disclosures for two-factor sign-in and account security.';
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const createdDescription = !description;
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    const previousDescription = description.content;
    document.title = 'SMS Consent & Disclosures | QuickProp';
    description.content = descriptionText;

    return () => {
      document.title = previousTitle;
      if (createdDescription) description?.remove();
      else if (description) description.content = previousDescription;
    };
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-gray-50" data-testid="page-sms-consent">
        <header className="border-b border-gray-100 bg-white">
          <div className="container mx-auto max-w-3xl px-4 py-12 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10" aria-hidden="true">
              <MessageSquareText className="h-6 w-6 text-primary" />
            </div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900" data-testid="sms-consent-title">
              SMS consent for two-factor sign-in
            </h1>
            <p className="mx-auto max-w-xl text-gray-600">
              Review how QuickProp uses text messages to help protect your mobile app account.
            </p>
          </div>
        </header>

        <div className="container mx-auto max-w-3xl space-y-6 px-4 py-10">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="sms-purpose">
            <div className="mb-5 flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
              <div>
                <h2 id="sms-purpose" className="text-lg font-semibold text-gray-900">What messages to expect</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  If you choose SMS verification in the QuickProp mobile app, QuickProp may text you one-time verification codes and account-security messages. These texts are not promotional or marketing messages.
                </p>
              </div>
            </div>

            <ul className="ml-8 list-disc space-y-2 text-sm leading-relaxed text-gray-600">
              <li>Message frequency varies; you will generally receive a message when you request a sign-in or security code.</li>
              <li>Message and data rates may apply depending on your mobile plan and carrier.</li>
              <li>Delivery may be delayed or unavailable due to your carrier or network coverage.</li>
              <li>SMS consent is not a condition of downloading or using the QuickProp app.</li>
              <li>You can withdraw SMS consent at any time in the app or by replying STOP to a QuickProp text. Reply HELP for help, or contact <a className="text-primary hover:underline" href="mailto:support@melios.co.zw">support@melios.co.zw</a>.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="sms-opt-in">
            <h2 id="sms-opt-in" className="text-lg font-semibold text-gray-900">SMS consent</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              In the mobile app, SMS must remain off unless you actively select the checkbox below. You can change your choice later in the app.
            </p>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 transition-colors hover:border-primary/50">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(event) => setConsentChecked(event.currentTarget.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                aria-describedby="sms-consent-note"
                data-testid="checkbox-sms-consent"
              />
              <span className="text-sm leading-relaxed text-gray-800">
                I agree to receive SMS text messages from QuickProp for two-factor sign-in and account security at the mobile number I provide in the app. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.
              </span>
            </label>
            <p id="sms-consent-note" className="mt-3 text-xs leading-relaxed text-gray-500" data-testid="text-sms-consent-note">
              This public page is for disclosure purposes only. Changing this checkbox here does not save or change SMS preferences in your QuickProp account. See our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.
            </p>
          </section>

          <p className="text-center text-xs leading-relaxed text-gray-500">
            QuickProp account and privacy support: <a className="text-primary hover:underline" href="mailto:support@melios.co.zw">support@melios.co.zw</a>
          </p>
        </div>
      </main>
    </Layout>
  );
}
