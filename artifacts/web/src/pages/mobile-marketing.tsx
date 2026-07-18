import { Layout } from '@/components/layout';
import { Link } from 'wouter';
import {
  Search, Heart, Phone, Calendar, Bell, Upload,
  LayoutGrid, BookOpen, Inbox, RefreshCw, Smartphone,
  CheckCircle2, Star, Shield
} from 'lucide-react';

const BUYER_FEATURES = [
  { icon: Search,    text: 'Search thousands of verified properties' },
  { icon: CheckCircle2, text: 'Houses for sale and rent' },
  { icon: LayoutGrid, text: 'Apartments, townhouses, commercial property and land' },
  { icon: Search,    text: 'Fast property search with powerful filters' },
  { icon: Heart,     text: 'Save favourite properties' },
  { icon: Phone,     text: 'Contact estate agents directly' },
  { icon: Calendar,  text: 'Request property viewings' },
  { icon: Bell,      text: 'Receive alerts for new listings' },
];

const AGENT_FEATURES = [
  { icon: Upload,    text: 'Upload properties in minutes' },
  { icon: LayoutGrid, text: 'Manage your property portfolio' },
  { icon: BookOpen,  text: 'Generate branded property catalogues' },
  { icon: Inbox,     text: 'Receive and manage buyer enquiries' },
  { icon: RefreshCw, text: 'Keep your inventory synchronised across all QuickProp platforms' },
];

export default function MobileMarketing() {
  return (
    <Layout>
      <div className="min-h-screen bg-white">

        {/* Hero */}
        <div className="bg-gradient-to-b from-primary/5 to-white border-b border-gray-100">
          <div className="container mx-auto px-4 py-20 max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Smartphone className="w-3.5 h-3.5" />
              Available on iOS &amp; Android
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5 leading-tight">
              Find Your Next Property<br className="hidden sm:block" /> with QuickProp
            </h1>
            <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8">
              QuickProp makes it easy to buy, sell and rent property across Zimbabwe.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Download on the App Store
              </a>
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2 bg-primary text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M3.18 23.76c.3.17.64.22.99.14l12.1-6.99-2.65-2.65-10.44 9.5zM.53 1.67C.2 2 0 2.5 0 3.16v17.69c0 .66.2 1.16.53 1.49l.08.07 9.9-9.9v-.23L.61 1.6l-.08.07zM19.94 9.8l-2.73-1.58-2.98 2.98 2.98 2.98 2.76-1.59c.79-.45.79-1.19-.03-1.79zM4.17.24L16.27 7.23l-2.65 2.65L3.18.38A1.18 1.18 0 0 1 4.17.24z"/></svg>
                Get it on Google Play
              </a>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-16 max-w-4xl space-y-16">

          {/* Buyer Features */}
          <section>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Features</h2>
              <p className="text-gray-500">Everything you need to find your perfect property.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {BUYER_FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-gray-700 leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Agent Features */}
          <section className="bg-gray-900 rounded-2xl p-8 sm:p-10">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 bg-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                <Star className="w-3.5 h-3.5" />
                For Estate Agents
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Grow your business with QuickProp</h2>
              <p className="text-gray-400">Tools designed for Zimbabwe's estate agents.</p>
            </div>
            <div className="space-y-3">
              {AGENT_FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-gray-200 leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Why QuickProp */}
          <section className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-5">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Why QuickProp?</h2>
            <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
              QuickProp is designed to make property discovery faster, simpler and more transparent
              for buyers, tenants and estate agents across Zimbabwe.
            </p>
          </section>

          {/* Footer links */}
          <div className="border-t border-gray-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <p>© 2026 Melios Technologies (Private) Limited. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
              <Link href="/support" className="hover:text-primary transition-colors">Support</Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
