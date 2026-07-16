import React, { useState, useCallback } from 'react';
import { Share2, MessageCircle, Facebook, Instagram, Check, Copy, ExternalLink, ChevronRight } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  useListProperties,
  useGetCurrentUser,
  Property,
} from '@workspace/api-client-react';

type CatalogMode = 'company' | 'agent';

const PUBLIC_STATUSES = ['public', 'under_offer', 'coming_soon'];

function formatPrice(price: number, currency: string, listingType: string) {
  const fmt =
    price >= 1_000_000
      ? `${currency} ${(price / 1_000_000).toFixed(1)}M`
      : `${currency} ${price.toLocaleString()}`;
  return listingType === 'rent' ? `${fmt}/mo` : fmt;
}

function buildWhatsAppText(
  properties: Property[],
  mode: CatalogMode,
  agentName: string | undefined,
  catalogUrl: string,
) {
  const lines: string[] = [];
  lines.push('*QuickProp — Property Catalogue*');
  lines.push('_Your trusted Harare estate agency_');
  if (mode === 'agent' && agentName) lines.push(`_Agent: ${agentName}_`);
  lines.push('');

  const forSale = properties.filter(p => p.listingType === 'sale');
  const forRent = properties.filter(p => p.listingType === 'rent');

  if (forSale.length > 0) {
    lines.push(`*For Sale (${forSale.length} properties):*`);
    forSale.slice(0, 8).forEach(p => {
      const beds = p.bedrooms ? `${p.bedrooms}-bed ` : '';
      const type = p.propertyType.charAt(0).toUpperCase() + p.propertyType.slice(1);
      lines.push(`• ${beds}${type} in ${p.suburb} — ${formatPrice(p.price, p.currency, p.listingType)}`);
    });
    if (forSale.length > 8) lines.push(`  _...and ${forSale.length - 8} more_`);
    lines.push('');
  }

  if (forRent.length > 0) {
    lines.push(`*To Rent (${forRent.length} properties):*`);
    forRent.slice(0, 5).forEach(p => {
      const beds = p.bedrooms ? `${p.bedrooms}-bed ` : '';
      const type = p.propertyType.charAt(0).toUpperCase() + p.propertyType.slice(1);
      lines.push(`• ${beds}${type} in ${p.suburb} — ${formatPrice(p.price, p.currency, p.listingType)}`);
    });
    if (forRent.length > 5) lines.push(`  _...and ${forRent.length - 5} more_`);
    lines.push('');
  }

  lines.push(`Browse all listings: ${catalogUrl}`);
  lines.push('_Reply to enquire about any property_');
  return lines.join('\n');
}

export function QuickShareDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CatalogMode>('agent');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: user } = useGetCurrentUser();
  const { data: allProps } = useListProperties(undefined, {
    query: { enabled: open },
  });
  const { data: myProps } = useListProperties(
    user?.id ? { agentId: user.id } : undefined,
    { query: { enabled: open && !!user?.id } },
  );

  const properties = (mode === 'agent' ? myProps : allProps) ?? [];
  const publicProps = properties.filter(p => PUBLIC_STATUSES.includes(p.status));

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const catalogUrl =
    mode === 'agent' && user?.id
      ? `${baseUrl}/web/agents/${user.id}`
      : `${baseUrl}/web/`;

  const forSale = publicProps.filter(p => p.listingType === 'sale');
  const forRent = publicProps.filter(p => p.listingType === 'rent');

  const shareToWhatsApp = useCallback(() => {
    const text = buildWhatsAppText(publicProps, mode, user?.name, catalogUrl);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [publicProps, mode, user?.name, catalogUrl]);

  const shareToFacebook = useCallback(() => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(catalogUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [catalogUrl]);

  const copyForInstagram = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(catalogUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Link copied',
        description: 'Paste the link in your Instagram bio or story.',
      });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  }, [catalogUrl, toast]);

  const suburbList = [...new Set(publicProps.map(p => p.suburb))].slice(0, 4).join(', ');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 font-medium"
        >
          <Share2 className="w-4 h-4" />
          QuickShare
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            QuickShare Catalogue
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <Tabs value={mode} onValueChange={v => setMode(v as CatalogMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="agent" className="flex-1">My Catalog</TabsTrigger>
            <TabsTrigger value="company" className="flex-1">Company Catalog</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Catalog preview */}
        <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-sm text-foreground">
                {mode === 'agent' ? `${user?.name ?? 'My'} Listings` : 'QuickProp — All Listings'}
              </p>
              {suburbList && (
                <p className="text-xs text-muted-foreground mt-0.5">{suburbList}{publicProps.length > 4 ? ' & more' : ''}</p>
              )}
            </div>
            <Badge variant="secondary" className="text-xs">
              {publicProps.length} {publicProps.length === 1 ? 'property' : 'properties'}
            </Badge>
          </div>

          <div className="flex gap-3 text-xs">
            {forSale.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">{forSale.length} for sale</span>
              </div>
            )}
            {forRent.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">{forRent.length} to rent</span>
              </div>
            )}
            {publicProps.length === 0 && (
              <span className="text-muted-foreground italic">No published listings yet</span>
            )}
          </div>

          {publicProps.slice(0, 3).length > 0 && (
            <div className="space-y-1.5">
              {publicProps.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground/80 truncate flex-1">
                    {p.bedrooms ? `${p.bedrooms}-bed ` : ''}{p.propertyType} · {p.suburb}
                  </span>
                  <span className="text-primary font-medium ml-2 shrink-0">
                    {formatPrice(p.price, p.currency, p.listingType)}
                  </span>
                </div>
              ))}
              {publicProps.length > 3 && (
                <p className="text-xs text-muted-foreground">+{publicProps.length - 3} more properties</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 pt-1">
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
            <a
              href={catalogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline truncate"
            >
              {catalogUrl}
            </a>
          </div>
        </div>

        <Separator />

        {/* Share buttons */}
        <div className="space-y-2.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Share via</p>

          <button
            onClick={shareToWhatsApp}
            disabled={publicProps.length === 0}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left group"
          >
            <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">WhatsApp</p>
              <p className="text-xs text-muted-foreground">Opens WhatsApp with your catalogue text</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          <button
            onClick={shareToFacebook}
            disabled={publicProps.length === 0}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left group"
          >
            <div className="w-9 h-9 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
              <Facebook className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Facebook</p>
              <p className="text-xs text-muted-foreground">Share your catalogue link on Facebook</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          <button
            onClick={copyForInstagram}
            disabled={publicProps.length === 0}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left group"
          >
            <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}>
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Instagram</p>
              <p className="text-xs text-muted-foreground">Copy link — paste in your bio or story</p>
            </div>
            {copied
              ? <Check className="w-4 h-4 text-green-500" />
              : <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            }
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
