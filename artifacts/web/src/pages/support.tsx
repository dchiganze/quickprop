import { Layout } from '@/components/layout';
import {
  Mail, Clock, MessageSquare, ChevronDown, ChevronUp,
  UserPlus, Building2, Home, Search, Wrench, Bug
} from 'lucide-react';
import { useState } from 'react';

const SUPPORT_ITEMS = [
  { icon: UserPlus,  label: 'Account setup' },
  { icon: Search,    label: 'Property searches' },
  { icon: Building2, label: 'Agent registration' },
  { icon: Home,      label: 'Listing enquiries' },
  { icon: Wrench,    label: 'Technical support' },
  { icon: Bug,       label: 'Bug reporting' },
];

const FAQS = [
  {
    q: 'How do I create an account?',
    a: 'Download the app and register using your email address or mobile number.',
  },
  {
    q: "I'm an estate agent. How do I list properties?",
    a: 'Register as an Agent or Agency and complete verification before uploading your first property.',
  },
  {
    q: 'How do I report an incorrect listing?',
    a: 'Open the property and tap Report Listing, or email our support team at support@melios.co.zw.',
  },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left border border-gray-200 rounded-xl overflow-hidden hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between px-5 py-4 gap-4">
        <span className="font-medium text-gray-900 text-sm">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-primary flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-600 border-t border-gray-100 pt-3">
          {a}
        </div>
      )}
    </button>
  );
}

export default function Support() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Hero */}
        <div className="bg-white border-b border-gray-100">
          <div className="container mx-auto px-4 py-14 max-w-3xl text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-5">
              <MessageSquare className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">QuickProp Support</h1>
            <p className="text-gray-500 text-lg">Need help using QuickProp? Our support team is here to assist.</p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 max-w-3xl space-y-10">

          {/* What we help with */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">We can help with</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SUPPORT_ITEMS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Contact + Hours */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1 bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Mail className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Email</span>
              </div>
              <a
                href="mailto:support@melios.co.zw"
                className="text-sm font-medium text-gray-900 hover:text-primary transition-colors break-all"
              >
                support@melios.co.zw
              </a>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Business Hours</span>
              </div>
              <p className="text-sm font-medium text-gray-900">Monday – Friday</p>
              <p className="text-sm text-gray-500">08:00 – 17:00 (CAT)</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-primary mb-1">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Response Time</span>
              </div>
              <p className="text-sm font-medium text-gray-900">Within one business day.</p>
            </div>
          </div>

          {/* FAQs */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {FAQS.map((faq) => (
                <Faq key={faq.q} {...faq} />
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-700 mb-3">Still need help? Reach us directly.</p>
            <a
              href="mailto:support@melios.co.zw"
              className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email support@melios.co.zw
            </a>
          </div>

        </div>
      </div>
    </Layout>
  );
}
