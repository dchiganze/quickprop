import { Layout } from '@/components/layout';
import { Link } from 'wouter';
import { FileText } from 'lucide-react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function Terms() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100">
          <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
            <p className="text-sm text-gray-400">Last updated: July 2026</p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 max-w-2xl space-y-10">

          <Section title="1. Acceptance of Terms">
            <p>
              By downloading, installing, or using the QuickProp application or website
              (the "Service"), you agree to be bound by these Terms of Service. If you do not
              agree to these terms, do not use the Service.
            </p>
            <p>
              The Service is operated by <strong>Melios Technologies (Private) Limited</strong>,
              a company registered in Zimbabwe ("we", "us", or "QuickProp").
            </p>
          </Section>

          <Section title="2. Use of the Service">
            <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You must not:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Submit false, misleading, or fraudulent property listings.</li>
              <li>Impersonate any person or entity.</li>
              <li>Use the Service to harass, threaten, or harm other users.</li>
              <li>Attempt to gain unauthorised access to any part of the platform.</li>
              <li>Scrape, copy, or reproduce content without our written permission.</li>
              <li>Use the Service in any way that could damage, disable, or overburden it.</li>
            </ul>
          </Section>

          <Section title="3. Account Registration">
            <p>
              To access certain features, you must register an account. You are responsible for
              maintaining the confidentiality of your login credentials and for all activity that
              occurs under your account.
            </p>
            <p>
              You must provide accurate and complete information when registering. We reserve the
              right to suspend or terminate accounts that provide false information or violate these Terms.
            </p>
          </Section>

          <Section title="4. Property Listings">
            <p>
              Estate agents and agencies are responsible for the accuracy and legality of property
              listings they submit. By submitting a listing, you confirm that:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>You have authority to list the property.</li>
              <li>All information provided is accurate and not misleading.</li>
              <li>The listing complies with applicable Zimbabwean property and advertising laws.</li>
            </ul>
            <p>
              QuickProp reserves the right to remove any listing that violates these Terms or that
              we determine to be inappropriate at our sole discretion.
            </p>
          </Section>

          <Section title="5. Intellectual Property">
            <p>
              All content, trademarks, logos, and software on the QuickProp platform are the property
              of Melios Technologies (Private) Limited or its licensors. You may not reproduce,
              distribute, or create derivative works without our express written consent.
            </p>
            <p>
              By submitting content (such as photos or listing descriptions), you grant QuickProp
              a non-exclusive, royalty-free licence to use, display, and distribute that content
              on the platform.
            </p>
          </Section>

          <Section title="6. Disclaimers">
            <p>
              QuickProp is a listing platform and does not act as a real estate agent, broker, or
              financial adviser. We do not verify all listing details and are not responsible for
              the accuracy of content submitted by third parties.
            </p>
            <p>
              The Service is provided "as is" without warranties of any kind, express or implied,
              including fitness for a particular purpose or uninterrupted availability.
            </p>
          </Section>

          <Section title="7. Limitation of Liability">
            <p>
              To the fullest extent permitted by law, Melios Technologies (Private) Limited shall
              not be liable for any indirect, incidental, or consequential damages arising from your
              use of the Service, including loss of profits, data, or business opportunities.
            </p>
          </Section>

          <Section title="8. Termination">
            <p>
              We may suspend or terminate your access to the Service at any time, with or without
              notice, for conduct that we determine violates these Terms or is harmful to other users,
              us, or third parties.
            </p>
            <p>
              You may stop using the Service at any time and request account deletion as described
              in our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </Section>

          <Section title="9. Governing Law">
            <p>
              These Terms are governed by the laws of Zimbabwe. Any disputes arising under these
              Terms shall be subject to the exclusive jurisdiction of the courts of Zimbabwe.
            </p>
          </Section>

          <Section title="10. Changes to These Terms">
            <p>
              We may update these Terms from time to time. We will notify users of significant
              changes by updating the date at the top of this page. Continued use of the Service
              after changes constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>For any questions about these Terms, contact us at:</p>
            <p>
              <strong>Melios Technologies (Private) Limited</strong><br />
              Email: <a href="mailto:support@melios.co.zw" className="text-primary hover:underline">support@melios.co.zw</a>
            </p>
          </Section>

          <div className="border-t border-gray-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <p>© 2026 Melios Technologies (Private) Limited. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <Link href="/support" className="hover:text-primary transition-colors">Support</Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
