import { useEffect } from 'react';
import { Layout } from '@/components/layout';
import { Link } from 'wouter';
import { FileText } from 'lucide-react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const sectionId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return (
    <section className="space-y-3" data-testid={`section-${sectionId}`}>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function Terms() {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionText = 'Read the QuickProp Terms of Service for using our Zimbabwe property marketplace, website, and mobile apps.';
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const createdDescription = !description;
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    const previousDescription = description.content;
    document.title = 'QuickProp Terms of Service | Mobile App & Website';
    description.content = descriptionText;

    return () => {
      document.title = previousTitle;
      if (createdDescription) description?.remove();
      else if (description) description.content = previousDescription;
    };
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50" data-testid="page-terms">
        <header className="bg-white border-b border-gray-100">
          <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4" aria-hidden="true">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="terms-title">QuickProp Terms of Service</h1>
            <p className="text-gray-600">Terms for using the QuickProp website and mobile applications.</p>
            <p className="mt-3 text-sm text-gray-400" data-testid="terms-updated">Last updated: October 20, 2026</p>
          </div>
        </header>

        <article className="container mx-auto px-4 py-12 max-w-2xl space-y-10">
          <Section title="1. Acceptance and scope">
            <p>
              These Terms apply when you access or use QuickProp’s website, mobile applications, and related services (together, the “Service”). By creating an account, downloading, installing, or using the Service, you agree to these Terms. If you do not agree, do not use the Service.
            </p>
            <p>
              The Service is operated by <strong>Melios Technologies (Private) Limited</strong>, a company registered in Zimbabwe (“QuickProp”, “we”, “us”, or “our”).
            </p>
          </Section>

          <Section title="2. Eligibility and your account">
            <p>
              You must be legally able to accept these Terms where you live. When you register, provide accurate and current information and update it if it changes. Keep your password and device access secure, and do not share or transfer your account.
            </p>
            <p>
              You are responsible for activity under your account. Contact us promptly if you suspect unauthorised access. We may ask you to verify your identity before responding to account or data requests.
            </p>
          </Section>

          <Section title="3. Mobile app use">
            <p>
              We grant you a personal, limited, non-exclusive, non-transferable, and revocable right to install and use the QuickProp mobile application for its intended purpose, subject to these Terms and the rules of the app store from which you obtained it.
            </p>
            <p>
              You are responsible for your device, operating system, internet connection, and any carrier or data charges. Keep the app reasonably up to date. Some features may require device permissions, such as notifications or location; you can manage these permissions in your device settings, though disabling them may limit those features.
            </p>
            <p>
              Do not copy, modify, reverse engineer, interfere with, or try to bypass security measures in the app, except where applicable law permits this.
            </p>
          </Section>

          <Section title="4. Acceptable use">
            <p>You may use the Service only for lawful purposes. You must not:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Post false, misleading, unlawful, or fraudulent information or listings.</li>
              <li>Impersonate another person or misrepresent your authority or affiliation.</li>
              <li>Harass, threaten, defraud, or harm other users.</li>
              <li>Attempt unauthorised access to accounts, systems, or data.</li>
              <li>Scrape, harvest, copy, or reuse Service content except as allowed by law or with our written permission.</li>
              <li>Upload malware or interfere with the security, availability, or operation of the Service.</li>
            </ul>
          </Section>

          <Section title="5. Listings and user content">
            <p>
              Agents and agencies are responsible for listings they submit. By submitting a listing, you confirm that you are authorised to advertise the property, have permission to use its photos and other materials, and have taken reasonable care to make the details accurate and not misleading.
            </p>
            <p>
              You remain responsible for your listings, messages, profile details, photos, reviews, and other material you submit (“User Content”). Do not submit content that infringes another person’s rights or violates law.
            </p>
          </Section>

          <Section title="6. Property enquiries and transactions">
            <p>
              QuickProp helps users discover properties and contact agents. We do not own, sell, rent, inspect, or guarantee properties listed by users, and we are not a party to any transaction or agreement between users.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Check property details, availability, ownership, agent authority, and any proposed terms independently before paying money or signing an agreement.</li>
              <li>Any purchase, lease, viewing, negotiation, or other transaction is between the relevant users and is their responsibility.</li>
            </ul>
            <p>
              We may review, restrict, or remove listings or other content that we reasonably believe breaches these Terms, creates risk, or is unlawful.
            </p>
          </Section>

          <Section title="7. Ownership and permissions">
            <p>
              QuickProp and its licensors own the Service, including its software, branding, and materials, except for User Content and third-party materials. These Terms do not transfer ownership of your User Content to us.
            </p>
            <p>
              You grant QuickProp a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, and display your User Content as reasonably necessary to operate and provide the Service. You may remove content through available account features; some copies may remain temporarily in backups or be retained where required by law.
            </p>
          </Section>

          <Section title="8. Your choices and requests">
            <p>
              You can manage device permissions and notification preferences through your device or account settings where those controls are available. You may update or remove account content using the Service.
            </p>
            <p>
              You may request account deletion as described in our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. That policy also explains how we handle personal information and related requests.
            </p>
          </Section>

          <Section title="9. Privacy and third-party services">
            <p>
              Our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> explains how information is collected and used. The Service may link to third-party sites or rely on third-party platforms; their terms and privacy policies apply to their services, and QuickProp is not responsible for their content or operation.
            </p>
          </Section>

          <Section title="10. Availability and changes to the Service">
            <p>
              We work to keep QuickProp available but do not promise that the Service will always be uninterrupted, error-free, or compatible with every device. We may update, change, suspend, or discontinue features for operational, security, or legal reasons.
            </p>
          </Section>

          <Section title="11. Suspension and termination">
            <p>
              You may stop using the Service at any time. We may restrict or suspend access, or terminate an account, when reasonably necessary to address a breach of these Terms, protect users or the Service, or comply with law. Where practical, we will provide notice and an opportunity to address the issue.
            </p>
            <p>
              Account deletion requests are handled under our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. Terms that by their nature should continue after termination will remain in effect.
            </p>
          </Section>

          <Section title="12. Disclaimers">
            <p>
              QuickProp is a property discovery and communication platform, not a real estate agent, broker, conveyancer, or financial adviser. We do not independently verify every listing or user submission and cannot guarantee the accuracy, legality, availability, or suitability of third-party content.
            </p>
            <p>
              To the extent permitted by law, the Service is provided “as is” and “as available.” Nothing in these Terms excludes a warranty or right that cannot lawfully be excluded.
            </p>
          </Section>

          <Section title="13. Limitation of liability">
            <p>
              To the fullest extent permitted by applicable law, Melios Technologies (Private) Limited is not liable for indirect or consequential loss arising from use of the Service. Nothing in these Terms limits liability that cannot be limited under applicable law.
            </p>
          </Section>

          <Section title="14. Changes to these Terms">
            <p>
              We may update these Terms. We will post the revised version here and update the date above. If a change materially affects users, we will take reasonable steps to provide notice. Continued use after the updated Terms take effect means you accept them, to the extent allowed by law.
            </p>
          </Section>

          <Section title="15. Governing law and severability">
            <p>
              These Terms are governed by the laws of Zimbabwe. Disputes will be handled by the competent courts of Zimbabwe, subject to any mandatory rights you have under applicable law.
            </p>
            <p>
              If any part of these Terms is held unenforceable, the remaining terms continue in effect.
            </p>
          </Section>

          <Section title="16. Contact">
            <p>For any questions about these Terms, contact us at:</p>
            <p>
              <strong>Melios Technologies (Private) Limited</strong><br />
              Email: <a href="mailto:support@melios.co.zw" className="text-primary hover:underline">support@melios.co.zw</a>
            </p>
          </Section>

        </article>
      </div>
    </Layout>
  );
}
