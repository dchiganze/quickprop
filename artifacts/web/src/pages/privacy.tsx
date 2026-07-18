import { Layout } from '@/components/layout';
import { Link } from 'wouter';
import { Shield } from 'lucide-react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100">
          <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-sm text-gray-400">Last updated: July 2026</p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 max-w-2xl space-y-10">

          <Section title="1. Information We Collect">
            <p>When you use QuickProp, we may collect the following information:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information</strong> — your name, email address, and phone number when you register.</li>
              <li><strong>Property data</strong> — listings, photos, and descriptions you submit as an agent.</li>
              <li><strong>Search activity</strong> — property searches, filters applied, and properties you save or view.</li>
              <li><strong>Device information</strong> — device type, operating system, and app version.</li>
              <li><strong>Location data</strong> — approximate location when you grant permission, used to show nearby properties.</li>
              <li><strong>Communications</strong> — messages and enquiries sent through the platform between buyers and agents.</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Create and manage your account.</li>
              <li>Display property listings and search results relevant to you.</li>
              <li>Facilitate communication between buyers and estate agents.</li>
              <li>Send alerts for new listings matching your preferences.</li>
              <li>Improve the performance and features of the platform.</li>
              <li>Comply with legal obligations.</li>
            </ul>
            <p>We do not sell your personal information to third parties.</p>
          </Section>

          <Section title="3. Cookies">
            <p>
              QuickProp uses cookies and similar technologies to maintain your session, remember your
              preferences, and understand how the platform is used.
            </p>
            <p>
              You can disable cookies through your browser settings, but some features of the platform
              may not function correctly without them.
            </p>
          </Section>

          <Section title="4. Account Deletion">
            <p>
              You may request deletion of your account and associated personal data at any time by
              emailing <a href="mailto:support@melios.co.zw" className="text-primary hover:underline">support@melios.co.zw</a>.
            </p>
            <p>
              Upon verification, we will delete your personal data within 30 days. Some information
              may be retained where required by law or to resolve disputes.
            </p>
            <p>
              Mobile app users can also request account deletion directly within the app via
              Settings → Account → Delete Account.
            </p>
          </Section>

          <Section title="5. Third-Party Services">
            <p>QuickProp uses the following third-party services, each with their own privacy practices:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Replit</strong> — cloud hosting and infrastructure.</li>
              <li><strong>Expo / React Native</strong> — mobile application framework.</li>
              <li><strong>PostgreSQL</strong> — secure database storage.</li>
            </ul>
            <p>
              We do not integrate advertising networks or sell data to marketing companies.
            </p>
          </Section>

          <Section title="6. Data Security">
            <p>
              We implement industry-standard security measures including encrypted connections (HTTPS/TLS),
              hashed passwords, and access-controlled databases. No system is completely secure;
              if you suspect unauthorised access to your account, contact us immediately.
            </p>
          </Section>

          <Section title="7. Children's Privacy">
            <p>
              QuickProp is not directed at children under the age of 13. We do not knowingly collect
              personal information from children. If you believe we have collected such data, please
              contact us and we will delete it promptly.
            </p>
          </Section>

          <Section title="8. Contact">
            <p>For any privacy-related questions or requests, contact us at:</p>
            <p>
              <strong>Melios Technologies (Private) Limited</strong><br />
              Email: <a href="mailto:support@melios.co.zw" className="text-primary hover:underline">support@melios.co.zw</a>
            </p>
          </Section>

          <div className="border-t border-gray-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <p>© 2026 Melios Technologies (Private) Limited. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
              <Link href="/support" className="hover:text-primary transition-colors">Support</Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
