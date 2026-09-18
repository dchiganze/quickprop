import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { 
  useGetProperty, useUpdateProperty, useGetPropertyPriceHistory, 
  useGetPropertyActivity, useGetSeller, getGetSellerQueryKey, useListViewings, useListDocuments,
  useGenerateBrochure, useShareProperty 
  , useGetMultiAgentProperty, useUpdatePropertyHealth
} from '@workspace/api-client-react';
import { 
  ArrowLeft, MapPin, Bed, Bath, Car, Square, Building2, Calendar, 
  Tag, Download, Share2, PenLine, CheckCircle2, FileText, Eye, 
  Activity, ArrowUpRight, ArrowDownRight, Loader2, Image as ImageIcon,
  MessageCircle, Facebook, Instagram, Linkedin, Mail, Link as LinkIcon, Copy, ChevronRight,
  Upload, Video, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  buildPropertyShareCaption,
  createPropertyShareCard,
  openSocialShareLink,
  shareCardWithCaption,
} from '@/utils/shareCards';
import {
  ensurePublicSharePreview,
  getQuickPropPublicOrigin,
  QUICKPROP_SHARE_PREVIEW_VERSION,
} from '@/utils/shareLinks';

const PROPERTY_FEATURES = [
  'Solar', 'Borehole', 'Swimming Pool', 'Electric Fence',
  'Staff Quarters', 'Cottage', 'Fitted Kitchen', 'Generator',
  'Fireplace', 'Fibre', 'Air Conditioning', 'Alarm System',
  'Paved Driveway', 'Municipal Water', 'Septic Tank', 'Internet',
  'Schools Nearby', 'Hospital Nearby', 'Shopping Centre Nearby',
  'Double Storey', 'Servant Quarters', 'Garden', 'Deck',
  'Study', 'Gym', 'Home Theatre', 'Wine Cellar',
  'Irrigation', 'Boma', 'Lapa', 'Outhouse',
];

const PUBLIC_PROPERTY_STATUSES = new Set(['public', 'under_offer', 'coming_soon']);
const PUBLIC_PROPERTY_AVAILABILITY = new Set(['available', 'under_offer']);

type SellingStatus = 'available' | 'under_offer' | 'sold' | 'withdrawn';

function getSellingStatus(property: { status: string; availabilityStatus?: string }) {
  if (['under_offer', 'sold', 'withdrawn'].includes(property.status)) {
    return property.status as SellingStatus;
  }
  return ['available', 'under_offer', 'sold', 'withdrawn'].includes(property.availabilityStatus ?? '')
    ? property.availabilityStatus as SellingStatus
    : 'available';
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function futureViewingDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatViewingSlot(value: string) {
  if (!value) return 'Select date and time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Select date and time';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function uploadOfficeMedia(file: File): Promise<string> {
  const request = await fetch('/api/storage/uploads/request-url', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  const target = await request.json().catch(() => null) as {
    uploadURL?: string;
    objectPath?: string;
    error?: string;
  } | null;
  if (!request.ok || !target?.uploadURL || !target.objectPath) {
    throw new Error(target?.error || `Could not prepare ${file.name} for upload.`);
  }

  const upload = await fetch(target.uploadURL, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!upload.ok) throw new Error(`Could not upload ${file.name}.`);
  return `/api/storage${target.objectPath}`;
}

export default function PropertyDetail({ params }: { params: { id: string } }) {
  const propertyId = parseInt(params.id, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: property, isLoading } = useGetProperty(propertyId);
  const { data: activity } = useGetPropertyActivity(propertyId);
  const { data: priceHistory } = useGetPropertyPriceHistory(propertyId);
  const { data: viewings } = useListViewings({ propertyId });
  const { data: documents } = useListDocuments({ propertyId });
  const { data: multiAgent } = useGetMultiAgentProperty(propertyId);
  const sellerId = property?.sellerId;
  const { data: seller } = useGetSeller(sellerId || 0, { query: { enabled: !!sellerId, queryKey: getGetSellerQueryKey(sellerId || 0) }});

  const updateProperty = useUpdateProperty();
  const generateBrochure = useGenerateBrochure();
  const shareProperty = useShareProperty();
  const updateHealth = useUpdatePropertyHealth();

  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [viewingPickerOpen, setViewingPickerOpen] = useState(false);
  const [activeViewingSlot, setActiveViewingSlot] = useState<number | null>(null);
  const [viewingPickerDate, setViewingPickerDate] = useState('');
  const [viewingPickerTime, setViewingPickerTime] = useState('');
  const [photoUploadPending, setPhotoUploadPending] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  const editVideoInputRef = useRef<HTMLInputElement>(null);
  const [listingVisibility, setListingVisibility] = useState<'public' | 'internal_only'>('internal_only');
  const [sellingStatus, setSellingStatus] = useState<SellingStatus>('available');
  const [edit, setEdit] = useState({
    title: '', propertyType: 'house', listingType: 'sale', price: '', negotiable: false,
    suburb: '', city: '', address: '', addressVisible: false, bedrooms: '', bathrooms: '',
    parking: '', landSize: '', buildingSize: '', levies: '', rates: '', description: '',
    photos: '', coverImage: '', videoUrl: '', proposedViewingTimes: [] as string[], features: [] as string[],
    sellerName: '', sellerPhone: '', sellerEmail: '', mandateExpiry: '',
    mandateType: 'sole' as 'open' | 'sole', sellerNotes: '', collaborationEnabled: false,
  });

  useEffect(() => {
    if (!property) return;
    setEdit({
      title: property.title,
      propertyType: property.propertyType,
      listingType: property.listingType,
      price: String(property.price),
      negotiable: property.negotiable ?? false,
      suburb: property.suburb,
      city: property.city,
      address: property.address ?? '',
      addressVisible: property.addressVisible ?? false,
      bedrooms: property.bedrooms == null ? '' : String(property.bedrooms),
      bathrooms: property.bathrooms == null ? '' : String(property.bathrooms),
      parking: property.parking == null ? '' : String(property.parking),
      landSize: property.landSize == null ? '' : String(property.landSize),
      buildingSize: property.buildingSize == null ? '' : String(property.buildingSize),
      levies: property.levies == null ? '' : String(property.levies),
      rates: property.rates == null ? '' : String(property.rates),
       description: property.description ?? '',
      photos: (property.photos ?? []).join('\n'),
      coverImage: property.coverImage ?? property.photos?.[0] ?? '',
      videoUrl: property.videoUrl ?? '',
       proposedViewingTimes: (property.proposedViewingTimes ?? []).slice(0, 3).map(toDateTimeLocal),
       features: property.features ?? [],
       sellerName: seller?.name ?? '',
       sellerPhone: seller?.phone ?? '',
       sellerEmail: seller?.email ?? '',
       mandateExpiry: property.mandateExpiry ?? '',
       mandateType: property.mandateType === 'open' ? 'open' : 'sole',
       sellerNotes: seller?.notes ?? property.privateNotes ?? '',
       collaborationEnabled: property.collaborationEnabled ?? false,
    });
   }, [property, seller]);

  useEffect(() => {
    if (!property) return;
    setListingVisibility(property.status === 'public' ? 'public' : 'internal_only');
  }, [property?.id, property?.status]);

  useEffect(() => {
    if (!property) return;
    setSellingStatus(getSellingStatus(property));
  }, [property?.id, property?.status, property?.availabilityStatus]);

  if (isLoading) {
    return <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>;
  }

  if (!property) {
    return <div className="p-8">Property not found</div>;
  }

  const coverPhoto = property.coverImage || property.photos?.[0];
  const editPhotoUrls = edit.photos.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);

  const handleVisibilityChange = (newStatus: string) => {
    const nextStatus = newStatus === 'public' ? 'public' : 'internal_only';
    setListingVisibility(nextStatus);
    updateProperty.mutate({ id: propertyId, data: { status: nextStatus } }, {
      onSuccess: () => {
        toast({
          title: 'Status updated',
          description: `Property status is now ${nextStatus === 'public' ? 'Publicly Listed' : 'Internally Only'}.`,
        });
      },
      onError: () => {
        setListingVisibility(property.status === 'public' ? 'public' : 'internal_only');
        toast({ title: 'Could not update status', description: 'Please try again.', variant: 'destructive' });
      },
    });
  };

  const handleSellingStatusChange = (newStatus: string) => {
    const nextStatus = newStatus as SellingStatus;
    if (!['available', 'under_offer', 'sold', 'withdrawn'].includes(nextStatus)) return;
    if (nextStatus === 'sold') {
      setSalePrice(property.salePrice == null ? '' : String(property.salePrice));
      setSaleDate(property.soldAt ? property.soldAt.slice(0, 10) : '');
      setSaleDialogOpen(true);
      return;
    }

    const previousStatus = sellingStatus;
    setSellingStatus(nextStatus);
    updateProperty.mutate({ id: propertyId, data: { availabilityStatus: nextStatus } }, {
      onSuccess: () => {
        toast({
          title: 'Selling status updated',
          description: `Property is now ${nextStatus === 'under_offer' ? 'Under Offer' : nextStatus === 'withdrawn' ? 'Withdrawn' : 'Available'}.`,
        });
      },
      onError: () => {
        setSellingStatus(previousStatus);
        toast({ title: 'Could not update selling status', description: 'Please try again.', variant: 'destructive' });
      },
    });
  };

  const handleConfirmSale = () => {
    const parsedSalePrice = salePrice.trim() ? Number(salePrice) : undefined;
    if (parsedSalePrice != null && (!Number.isFinite(parsedSalePrice) || parsedSalePrice <= 0)) {
      toast({ title: 'Invalid sale price', description: 'Enter a positive final sale price or leave it blank.', variant: 'destructive' });
      return;
    }
    updateProperty.mutate({
      id: propertyId,
      data: {
        availabilityStatus: 'sold',
        ...(parsedSalePrice == null ? {} : { salePrice: parsedSalePrice }),
        ...(saleDate ? { soldAt: new Date(`${saleDate}T00:00:00`).toISOString() } : {}),
      },
    }, {
      onSuccess: () => {
        setSaleDialogOpen(false);
        setSellingStatus('sold');
        toast({
          title: 'Selling status updated',
          description: 'Property marked as Sold. Adding the sale price and date enhances your selling history on the marketplace.',
        });
      },
      onError: (error) => {
        toast({ title: 'Could not record sale', description: error.message, variant: 'destructive' });
      },
    });
  };

  const handleGenerateBrochure = () => {
    window.open(`${window.location.pathname.replace(/\/property\/\d+.*/, '')}/property/${propertyId}/brochure`, '_blank');
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const accepted = files.filter((file) => file.type.startsWith('image/') && file.size <= 25 * 1024 * 1024);
    const rejected = files.filter((file) => !file.type.startsWith('image/') || file.size > 25 * 1024 * 1024);
    if (rejected.length > 0) {
      toast({
        title: 'Some photos were skipped',
        description: 'Photos must be image files no larger than 25 MB.',
        variant: 'destructive',
      });
    }
    if (accepted.length === 0) return;

    setPhotoUploadPending(true);
    try {
      const uploadedPhotos = await Promise.all(accepted.map(async (file) => {
        const request = await fetch('/api/storage/uploads/request-url', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        });
        const target = await request.json().catch(() => null) as {
          uploadURL?: string;
          objectPath?: string;
          error?: string;
        } | null;
        if (!request.ok || !target?.uploadURL || !target.objectPath) {
          throw new Error(target?.error || `Could not prepare ${file.name} for upload.`);
        }

        const upload = await fetch(target.uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!upload.ok) throw new Error(`Could not upload ${file.name}.`);
        return `/api/storage${target.objectPath}`;
      }));

      const photos = [...(property.photos ?? []), ...uploadedPhotos];
      await updateProperty.mutateAsync({
        id: propertyId,
        data: {
          photos,
          ...(property.coverImage ? {} : { coverImage: photos[0] }),
        },
      });
      toast({
        title: 'Photos uploaded',
        description: `${uploadedPhotos.length} ${uploadedPhotos.length === 1 ? 'photo was' : 'photos were'} added to this listing.`,
      });
    } catch (error) {
      toast({
        title: 'Could not upload photos',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPhotoUploadPending(false);
    }
  };

  const handleEditPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const accepted = files.filter((file) => file.type.startsWith('image/') && file.size <= 25 * 1024 * 1024);
    const rejected = files.filter((file) => !file.type.startsWith('image/') || file.size > 25 * 1024 * 1024);
    if (rejected.length > 0) {
      toast({
        title: 'Some photos were skipped',
        description: 'Photos must be image files no larger than 25 MB.',
        variant: 'destructive',
      });
    }
    if (accepted.length === 0) return;

    setPhotoUploadPending(true);
    try {
      const uploadedPhotos = await Promise.all(accepted.map(uploadOfficeMedia));
      setEdit((current) => {
        const photos = [
          ...current.photos.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean),
          ...uploadedPhotos,
        ];
        return {
          ...current,
          photos: photos.join('\n'),
          coverImage: current.coverImage || uploadedPhotos[0],
        };
      });
      toast({
        title: 'Photos added',
        description: `${uploadedPhotos.length} ${uploadedPhotos.length === 1 ? 'photo is' : 'photos are'} ready to save.`,
      });
    } catch (error) {
      toast({
        title: 'Could not upload photos',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPhotoUploadPending(false);
    }
  };

  const handleEditVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast({ title: 'Unsupported video', description: 'Choose a video file.', variant: 'destructive' });
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: 'Video is too large', description: 'Videos must be 100 MB or smaller.', variant: 'destructive' });
      return;
    }

    setPhotoUploadPending(true);
    try {
      const videoUrl = await uploadOfficeMedia(file);
      setEdit((current) => ({ ...current, videoUrl }));
      toast({ title: 'Video added', description: 'The video is ready to save with this listing.' });
    } catch (error) {
      toast({
        title: 'Could not upload video',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPhotoUploadPending(false);
    }
  };

  const openViewingPicker = (slotIndex: number) => {
    const value = edit.proposedViewingTimes[slotIndex] ?? '';
    setActiveViewingSlot(slotIndex);
    setViewingPickerDate(value.slice(0, 10));
    setViewingPickerTime(value.slice(11, 16));
    setViewingPickerOpen(true);
  };

  const applyViewingPicker = () => {
    if (activeViewingSlot == null || !viewingPickerDate || !viewingPickerTime) {
      toast({ title: 'Choose a date and time', description: 'Both fields are required for a viewing slot.', variant: 'destructive' });
      return;
    }
    if (viewingPickerDate < futureViewingDate()) {
      toast({ title: 'Choose a future date', description: 'Viewing dates must be after today.', variant: 'destructive' });
      return;
    }

    const proposedViewingTimes = [...edit.proposedViewingTimes];
    proposedViewingTimes[activeViewingSlot] = `${viewingPickerDate}T${viewingPickerTime}`;
    setEdit({ ...edit, proposedViewingTimes });
    setViewingPickerOpen(false);
  };

  const clearViewingPicker = () => {
    if (activeViewingSlot == null) return;
    const proposedViewingTimes = [...edit.proposedViewingTimes];
    proposedViewingTimes[activeViewingSlot] = '';
    setEdit({ ...edit, proposedViewingTimes });
    setViewingPickerOpen(false);
  };

  const handleShare = async (channel: 'whatsapp' | 'facebook' | 'instagram' | 'linkedin' | 'email' | 'link') => {
    const canSharePublicPreview = PUBLIC_PROPERTY_STATUSES.has(property.status)
      && PUBLIC_PROPERTY_AVAILABILITY.has(property.availabilityStatus ?? 'available');
    if ((channel === 'facebook' || channel === 'linkedin') && !canSharePublicPreview) {
      toast({
        title: 'Publish this property first',
        description: 'Facebook and LinkedIn previews are only available for public listings.',
        variant: 'destructive',
      });
      return;
    }

    shareProperty.mutate({ id: propertyId, data: { channel } }, {
      onSuccess: async (res) => {
        const publicOrigin = getQuickPropPublicOrigin();
        const catalogueUrl = property.agentId
          ? `${publicOrigin}/web/agents/${property.agentId}`
          : `${publicOrigin}/web/`;
        const propertyUrl = `${publicOrigin}/properties/${encodeURIComponent(property.reference.toLowerCase())}`;
        const previewUrl = `${publicOrigin}/api/share/properties/${encodeURIComponent(property.reference)}?v=${QUICKPROP_SHARE_PREVIEW_VERSION}`;
        const shareMessage = buildPropertyShareCaption(property, propertyUrl, catalogueUrl);

        try {
          if (channel === 'whatsapp') {
            const caption = shareMessage;
            const card = await createPropertyShareCard(property);
            const result = await shareCardWithCaption(
              card,
              caption,
              property.title,
              `quickprop-${property.reference}.jpg`,
            );
            toast({
              title: 'Property ready to share',
              description: result === 'shared'
                ? 'The property image and caption were sent to the share sheet.'
                : 'The property image was downloaded and the caption was opened in WhatsApp.',
            });
            return;
          } else if (channel === 'facebook' || channel === 'linkedin' || channel === 'instagram') {
            if (channel === 'facebook' || channel === 'linkedin') {
              const fallbackUrl = channel === 'facebook'
                ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(previewUrl)}`
                : `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(previewUrl)}`;
              await ensurePublicSharePreview(previewUrl);
              await openSocialShareLink(shareMessage, fallbackUrl);
              toast({
                title: `${channel[0].toUpperCase()}${channel.slice(1)} ready to share`,
                description: `The ${channel} link was opened and the caption was copied. Facebook will load the preview image from QuickProp.`,
              });
              return;
            }
            const card = await createPropertyShareCard(property);
            const result = await shareCardWithCaption(
              card,
              shareMessage,
              property.title,
              `quickprop-${property.reference}.jpg`,
              null,
            );
            toast({
              title: `${channel[0].toUpperCase()}${channel.slice(1)} ready to share`,
              description: result === 'shared'
                ? 'The property collage and caption were sent to the share sheet.'
                : `The property collage was downloaded and the caption was copied for ${channel}.`,
            });
            return;
          } else if (channel === 'email') {
            window.location.href = `mailto:?subject=${encodeURIComponent(property.title)}&body=${encodeURIComponent(shareMessage)}`;
          } else {
            await navigator.clipboard.writeText(shareMessage);
          }
          const description = channel === 'link'
            ? 'Property details and link copied to clipboard.'
            : `Opened ${channel}.`;
          toast({ title: 'Property ready to share', description });
        } catch (error) {
          toast({
            title: 'Could not share property',
            description: error instanceof Error
              ? error.message
              : 'The public QuickProp preview is not available yet.',
            variant: 'destructive',
          });
        }
      }
    });
  };

  const confirmAvailability = () => {
    updateHealth.mutate({ id: propertyId, data: { action: 'still_available' } }, {
      onSuccess: () => toast({ title: 'Availability confirmed', description: 'This property is marked current for today.' }),
      onError: () => toast({ title: 'Could not confirm availability', variant: 'destructive' }),
    });
  };

  const handleEditSave = () => {
    const price = Number(edit.price);
    const photos = edit.photos.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
    if (!edit.title.trim() || !edit.suburb.trim() || !edit.city.trim() || !Number.isFinite(price) || price <= 0 || photos.length === 0) {
      toast({ title: 'Title, location, price and photos are required', variant: 'destructive' });
      return;
    }
    updateProperty.mutate({
      id: propertyId,
      data: {
        title: edit.title.trim(),
        propertyType: edit.propertyType,
        listingType: edit.listingType,
        price,
        negotiable: edit.negotiable,
        suburb: edit.suburb.trim(),
        city: edit.city.trim(),
        address: edit.address.trim() || undefined,
        addressVisible: Boolean(edit.address.trim() && edit.addressVisible),
        bedrooms: edit.bedrooms ? Number(edit.bedrooms) : undefined,
        bathrooms: edit.bathrooms ? Number(edit.bathrooms) : undefined,
        parking: edit.parking ? Number(edit.parking) : undefined,
        landSize: edit.landSize ? Number(edit.landSize) : undefined,
        buildingSize: edit.buildingSize ? Number(edit.buildingSize) : undefined,
        levies: edit.levies ? Number(edit.levies) : undefined,
        rates: edit.rates ? Number(edit.rates) : undefined,
        description: edit.description.trim() || undefined,
         features: edit.features,
        photos,
        coverImage: edit.coverImage || photos[0],
        videoUrl: edit.videoUrl.trim() || undefined,
        proposedViewingTimes: edit.proposedViewingTimes
          .filter(Boolean)
          .map((value) => new Date(value))
          .filter((value) => !Number.isNaN(value.getTime()))
          .slice(0, 3)
          .map((value) => value.toISOString()),
         sellerName: edit.sellerName.trim() || undefined,
         sellerPhone: edit.sellerPhone.trim() || undefined,
         sellerEmail: edit.sellerEmail.trim() || undefined,
         sellerNotes: edit.sellerNotes.trim() || undefined,
         privateNotes: edit.sellerNotes.trim() || undefined,
         mandateType: edit.mandateType,
         mandateExpiry: edit.mandateExpiry || undefined,
         collaborationEnabled: edit.collaborationEnabled,
      },
    }, {
      onSuccess: () => {
        setEditOpen(false);
        toast({ title: 'Listing updated', description: `${edit.title} was saved.` });
      },
      onError: (error: Error) => toast({ title: 'Could not update listing', description: error.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark property as sold</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sale price and date are optional. Adding them enhances your selling history on the QuickProp marketplace.
            </p>
            <div className="space-y-2">
              <label htmlFor="sale-price" className="text-sm font-medium">Final sale price ({property.currency})</label>
              <Input
                id="sale-price"
                inputMode="decimal"
                value={salePrice}
                onChange={(event) => setSalePrice(event.target.value)}
                placeholder="Enter sale price"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sale-date" className="text-sm font-medium">Sale date (optional)</label>
              <Input
                id="sale-date"
                type="date"
                value={saleDate}
                onChange={(event) => setSaleDate(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmSale} disabled={updateProperty.isPending}>Save sold status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit listing</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label htmlFor="edit-title" className="text-sm font-medium">Title</label>
              <Input id="edit-title" value={edit.title} onChange={(event) => setEdit({ ...edit, title: event.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Property type</label>
                <Select value={edit.propertyType} onValueChange={(value) => setEdit({ ...edit, propertyType: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['house', 'apartment', 'townhouse', 'stand', 'commercial', 'industrial', 'farm', 'mine'].map((value) => <SelectItem key={value} value={value} className="capitalize">{value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Listing type</label>
                <Select value={edit.listingType} onValueChange={(value) => setEdit({ ...edit, listingType: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="sale">For Sale</SelectItem><SelectItem value="rent">To Rent</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="grid gap-2"><label htmlFor="edit-price" className="text-sm font-medium">Price</label><Input id="edit-price" inputMode="decimal" value={edit.price} onChange={(event) => setEdit({ ...edit, price: event.target.value })} /></div>
              <div className="grid gap-2"><label htmlFor="edit-bedrooms" className="text-sm font-medium">Bedrooms</label><Input id="edit-bedrooms" inputMode="numeric" value={edit.bedrooms} onChange={(event) => setEdit({ ...edit, bedrooms: event.target.value })} /></div>
              <div className="grid gap-2"><label htmlFor="edit-bathrooms" className="text-sm font-medium">Bathrooms</label><Input id="edit-bathrooms" inputMode="numeric" value={edit.bathrooms} onChange={(event) => setEdit({ ...edit, bathrooms: event.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2"><label htmlFor="edit-suburb" className="text-sm font-medium">Suburb</label><Input id="edit-suburb" value={edit.suburb} onChange={(event) => setEdit({ ...edit, suburb: event.target.value })} /></div>
              <div className="grid gap-2"><label htmlFor="edit-city" className="text-sm font-medium">City</label><Input id="edit-city" value={edit.city} onChange={(event) => setEdit({ ...edit, city: event.target.value })} /></div>
            </div>
            <div className="grid gap-2 rounded-lg border bg-muted/30 p-4">
              <label htmlFor="edit-address" className="text-sm font-medium">Full property address</label>
              <Input id="edit-address" value={edit.address} onChange={(event) => setEdit({ ...edit, address: event.target.value })} />
              <div className="flex items-center justify-between gap-4">
                <div><label htmlFor="edit-address-visible" className="text-sm font-medium">Show exact address on website</label><p className="text-xs text-muted-foreground">Keep this off to show only suburb and city.</p></div>
                <Switch id="edit-address-visible" checked={edit.addressVisible} disabled={!edit.address.trim()} onCheckedChange={(checked) => setEdit({ ...edit, addressVisible: checked })} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
              <div><label htmlFor="edit-negotiable" className="text-sm font-medium">Price is negotiable</label><p className="text-xs text-muted-foreground">Show buyers that the asking price can be discussed.</p></div>
              <Switch id="edit-negotiable" checked={edit.negotiable} onCheckedChange={(checked) => setEdit({ ...edit, negotiable: checked })} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="grid gap-2"><label htmlFor="edit-parking" className="text-sm font-medium">Garages</label><Input id="edit-parking" inputMode="numeric" value={edit.parking} onChange={(event) => setEdit({ ...edit, parking: event.target.value })} /></div>
              <div className="grid gap-2"><label htmlFor="edit-land" className="text-sm font-medium">Land m²</label><Input id="edit-land" inputMode="decimal" value={edit.landSize} onChange={(event) => setEdit({ ...edit, landSize: event.target.value })} /></div>
              <div className="grid gap-2"><label htmlFor="edit-building" className="text-sm font-medium">Floor m²</label><Input id="edit-building" inputMode="decimal" value={edit.buildingSize} onChange={(event) => setEdit({ ...edit, buildingSize: event.target.value })} /></div>
              <div className="grid gap-2"><label htmlFor="edit-levies" className="text-sm font-medium">Levies / month</label><Input id="edit-levies" inputMode="decimal" value={edit.levies} onChange={(event) => setEdit({ ...edit, levies: event.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2"><label htmlFor="edit-rates" className="text-sm font-medium">Rates / month</label><Input id="edit-rates" inputMode="decimal" value={edit.rates} onChange={(event) => setEdit({ ...edit, rates: event.target.value })} /></div>
             <div className="grid gap-3">
               <div className="flex items-center justify-between gap-3">
                 <div>
                   <label className="text-sm font-medium">Property video</label>
                   <p className="text-xs text-muted-foreground">Upload a short walkthrough video.</p>
                 </div>
                 <div className="flex shrink-0 gap-2">
                   <input ref={editVideoInputRef} type="file" accept="video/*" className="hidden" onChange={handleEditVideoUpload} />
                   <Button type="button" variant="outline" size="sm" onClick={() => editVideoInputRef.current?.click()} disabled={photoUploadPending}>
                     {photoUploadPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
                     Add video
                   </Button>
                 </div>
               </div>
               {edit.videoUrl && (
                 <div className="flex items-center gap-3 rounded-lg border bg-background p-2">
                   <video src={edit.videoUrl} muted controls className="h-20 w-32 rounded object-cover" />
                   <div className="min-w-0 flex-1">
                     <p className="truncate text-xs text-muted-foreground">{edit.videoUrl}</p>
                   </div>
                   <Button type="button" variant="ghost" size="sm" onClick={() => setEdit({ ...edit, videoUrl: '' })}>
                     <X className="mr-1 h-4 w-4" /> Remove
                   </Button>
                 </div>
               )}
             </div>
             <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
               <div className="flex items-start justify-between gap-3">
                 <div>
                   <label htmlFor="edit-photos" className="text-sm font-medium">Property photos</label>
                   <p className="mt-1 text-xs text-muted-foreground">Add photos from your device.</p>
                 </div>
                 <div className="shrink-0">
                   <input ref={editPhotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleEditPhotoUpload} />
                   <Button type="button" variant="outline" size="sm" onClick={() => editPhotoInputRef.current?.click()} disabled={photoUploadPending}>
                     {photoUploadPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                     Add photos
                   </Button>
                 </div>
               </div>
               {editPhotoUrls.length > 0 && (
                 <div className="flex flex-wrap gap-3">
                   {editPhotoUrls.map((url, index) => (
                     <div key={`${url}-${index}`} className="group relative h-24 w-32 overflow-hidden rounded-lg border bg-background">
                       <img src={url} alt={`Property photo ${index + 1}`} className="h-full w-full object-cover" />
                       {index === 0 && (
                         <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">Cover</span>
                       )}
                       <button
                         type="button"
                         aria-label={`Remove photo ${index + 1}`}
                         onClick={() => {
                           const photos = editPhotoUrls.filter((_, photoIndex) => photoIndex !== index);
                           setEdit({
                             ...edit,
                             photos: photos.join('\n'),
                             coverImage: photos[0] ?? '',
                           });
                         }}
                         className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                       >
                         <X className="h-3 w-3" />
                       </button>
                     </div>
                   ))}
                 </div>
               )}
             </div>
            </div>
             <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
               <div>
                 <label className="text-sm font-medium">Proposed viewing times</label>
                 <p className="mt-1 text-xs text-muted-foreground">Choose up to 3 available days and times for buyers.</p>
               </div>
               <div className="grid min-w-0 gap-3 lg:grid-cols-3">
                 {Array.from({ length: 3 }, (_, index) => (
                   <div key={`viewing-slot-${index}`} className="grid min-w-0 gap-2">
                     <label htmlFor={`edit-viewing-${index}`} className="text-xs font-medium text-muted-foreground">
                       Slot {index + 1}
                     </label>
                     <Input
                       id={`edit-viewing-${index}`}
                       type="datetime-local"
                       min={toDateTimeLocal(new Date().toISOString())}
                       className="min-w-0 text-sm"
                       value={edit.proposedViewingTimes[index] ?? ''}
                       onChange={(event) => {
                         const proposedViewingTimes = [...edit.proposedViewingTimes];
                         proposedViewingTimes[index] = event.target.value;
                         setEdit({ ...edit, proposedViewingTimes });
                       }}
                     />
                   </div>
                 ))}
               </div>
             </div>
            <div className="grid gap-2"><label htmlFor="edit-description" className="text-sm font-medium">Description</label><Textarea id="edit-description" rows={4} value={edit.description} onChange={(event) => setEdit({ ...edit, description: event.target.value })} /></div>
             <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
               <div><label className="text-sm font-medium">Property features</label><p className="mt-1 text-xs text-muted-foreground">{edit.features.length} selected. Choose all that apply.</p></div>
               <div className="flex flex-wrap gap-2">
                 {PROPERTY_FEATURES.map((feature) => (
                   <Button key={feature} type="button" size="sm" variant={edit.features.includes(feature) ? 'default' : 'outline'} onClick={() => setEdit({ ...edit, features: edit.features.includes(feature) ? edit.features.filter((item) => item !== feature) : [...edit.features, feature] })} className="rounded-full">
                     {feature}
                   </Button>
                 ))}
               </div>
             </div>
             <div className="grid gap-4 rounded-lg border bg-muted/30 p-4">
               <div><label className="text-sm font-medium">Seller details</label><p className="mt-1 text-xs text-muted-foreground">Private information used by your agency.</p></div>
               <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                 <div className="grid gap-2"><label htmlFor="edit-seller-name" className="text-sm font-medium">Seller name</label><Input id="edit-seller-name" value={edit.sellerName} onChange={(event) => setEdit({ ...edit, sellerName: event.target.value })} /></div>
                 <div className="grid gap-2"><label htmlFor="edit-seller-phone" className="text-sm font-medium">Phone</label><Input id="edit-seller-phone" value={edit.sellerPhone} onChange={(event) => setEdit({ ...edit, sellerPhone: event.target.value })} /></div>
               </div>
               <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                 <div className="grid gap-2"><label htmlFor="edit-seller-email" className="text-sm font-medium">Email</label><Input id="edit-seller-email" type="email" value={edit.sellerEmail} onChange={(event) => setEdit({ ...edit, sellerEmail: event.target.value })} /></div>
                 <div className="grid gap-2"><label htmlFor="edit-mandate-expiry" className="text-sm font-medium">Mandate expiry</label><Input id="edit-mandate-expiry" type="date" value={edit.mandateExpiry} onChange={(event) => setEdit({ ...edit, mandateExpiry: event.target.value })} /></div>
               </div>
               <div className="grid gap-2">
                 <label className="text-sm font-medium">Mandate type</label>
                 <Select value={edit.mandateType} onValueChange={(value: 'open' | 'sole') => setEdit({ ...edit, mandateType: value })}>
                   <SelectTrigger><SelectValue /></SelectTrigger>
                   <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="sole">Sole</SelectItem></SelectContent>
                 </Select>
               </div>
               <div className="grid gap-2"><label htmlFor="edit-seller-notes" className="text-sm font-medium">Internal notes</label><Textarea id="edit-seller-notes" rows={3} value={edit.sellerNotes} onChange={(event) => setEdit({ ...edit, sellerNotes: event.target.value })} /></div>
             </div>
             <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
               <div><label htmlFor="edit-collaboration" className="text-sm font-medium">Open to collaboration?</label><p className="text-xs text-muted-foreground">Allow other QuickProp agents to request collaboration.</p></div>
               <Switch id="edit-collaboration" checked={edit.collaborationEnabled} onCheckedChange={(checked) => setEdit({ ...edit, collaborationEnabled: checked })} />
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateProperty.isPending}>{updateProperty.isPending ? 'Saving...' : 'Save changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Header */}
       <div className="flex flex-col gap-4">
         <div className="flex min-w-0 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
           <div className="min-w-0 flex-1">
             <div className="relative -top-[0.5cm] flex items-center gap-3 mb-1">
               <h1 className="min-w-0 flex-1 truncate whitespace-nowrap text-3xl font-bold tracking-tight text-foreground">{property.title}</h1>
               <Badge variant="outline" className="shrink-0 uppercase font-bold tracking-wider">{property.reference}</Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin className="w-4 h-4" />
              {property.address ? `${property.address}, ` : ''}{property.suburb}, {property.city}
            </div>
          </div>
        </div>
        
         <div className="flex w-full flex-wrap items-center gap-3">
          <Select value={sellingStatus} onValueChange={handleSellingStatusChange} disabled={updateProperty.isPending}>
            <SelectTrigger className="w-[250px] whitespace-nowrap bg-card font-semibold" aria-label="Selling Status">
              <span className="mr-1 text-muted-foreground">Selling Status:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="under_offer">Under Offer</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
            </SelectContent>
          </Select>
          <Select value={listingVisibility} onValueChange={handleVisibilityChange} disabled={updateProperty.isPending}>
            <SelectTrigger className="w-[180px] bg-card font-semibold capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Publicly Listed</SelectItem>
              <SelectItem value="internal_only">Internally Only</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="shadow-sm" onClick={() => setEditOpen(true)}>
            <PenLine className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button onClick={handleGenerateBrochure} disabled={generateBrochure.isPending} variant="secondary" className="shadow-sm">
            {generateBrochure.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Brochure
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="shadow-sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share Property</DialogTitle>
              </DialogHeader>
              <div className="space-y-2.5 py-4">
                <button
                  type="button"
                  onClick={() => handleShare('whatsapp')}
                  disabled={shareProperty.isPending}
                  className="group flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">WhatsApp</p>
                    <p className="text-xs text-muted-foreground">Open WhatsApp with this property</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => handleShare('facebook')}
                  disabled={shareProperty.isPending || !PUBLIC_PROPERTY_STATUSES.has(property.status) || !PUBLIC_PROPERTY_AVAILABILITY.has(property.availabilityStatus ?? 'available')}
                  className="group flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1877F2]">
                    <Facebook className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">Facebook</p>
                    <p className="text-xs text-muted-foreground">
                      {PUBLIC_PROPERTY_STATUSES.has(property.status) ? 'Share this property on Facebook' : 'Publish listing to share on Facebook'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => handleShare('instagram')}
                  disabled={shareProperty.isPending}
                  className="group flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}
                  >
                    <Instagram className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">Instagram</p>
                    <p className="text-xs text-muted-foreground">Copy caption + link for an Instagram post</p>
                  </div>
                  <Copy className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => handleShare('linkedin')}
                  disabled={shareProperty.isPending || !PUBLIC_PROPERTY_STATUSES.has(property.status) || !PUBLIC_PROPERTY_AVAILABILITY.has(property.availabilityStatus ?? 'available')}
                  className="group flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A66C2]">
                    <Linkedin className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">LinkedIn</p>
                    <p className="text-xs text-muted-foreground">
                      {PUBLIC_PROPERTY_STATUSES.has(property.status) ? 'Share this property as a post' : 'Publish listing to share on LinkedIn'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => handleShare('email')} disabled={shareProperty.isPending}>
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleShare('link')} disabled={shareProperty.isPending}>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Copy Link
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Cover Photo */}
          <div className="rounded-xl overflow-hidden aspect-video bg-muted relative border border-border shadow-sm">
            {coverPhoto ? (
              <img src={coverPhoto} alt={property.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                <p>No photos uploaded</p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploadPending}
                >
                  {photoUploadPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {photoUploadPending ? 'Uploading...' : 'Upload Photos'}
                </Button>
              </div>
            )}
            <div className="absolute top-4 left-4 flex gap-2">
              <Badge className="bg-background/90 text-foreground backdrop-blur font-bold text-lg px-3 py-1 shadow-sm">
                {property.currency} {property.price.toLocaleString()}
              </Badge>
              <Badge variant="secondary" className="bg-primary/90 text-primary-foreground backdrop-blur font-bold px-3 py-1 capitalize shadow-sm">
                For {property.listingType}
              </Badge>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start border-b border-border rounded-none h-12 bg-transparent p-0">
              <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">Overview</TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">Activity & Price</TabsTrigger>
              <TabsTrigger value="viewings" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">Viewings</TabsTrigger>
              <TabsTrigger value="documents" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">Documents</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="py-6 space-y-8">
              {multiAgent && multiAgent.offers.length > 0 && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3 flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Multi-agent property</CardTitle>
                      <CardDescription>{multiAgent.agencyCount} agency offer{multiAgent.agencyCount === 1 ? '' : 's'} · lowest {multiAgent.property.currency} {multiAgent.lowestPrice.toLocaleString()}</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={confirmAvailability} disabled={updateHealth.isPending}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirm available
                    </Button>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2">
                    {multiAgent.offers.map((offer) => (
                      <div key={offer.id} className="rounded-md bg-background border border-border/60 p-3">
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="font-semibold text-sm">{offer.agencyName}</p>
                            {offer.mandateType === 'sole' && <p className="text-xs text-muted-foreground">{offer.agentName} · Sole mandate</p>}
                          </div>
                          <p className="font-bold text-sm">{offer.currency} {offer.askingPrice.toLocaleString()}</p>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground capitalize">{offer.verificationStatus} verification · {offer.priceStatus ?? 'current'} price</p>
                         {offer.assets?.[0]?.attributionName && (
                           <p className="mt-2 text-xs text-muted-foreground">Media attributed to {offer.assets[0].attributionName}</p>
                         )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {/* Key Features */}
              <div className="flex flex-wrap gap-6 py-4 border-y border-border/50">
                {property.bedrooms != null && (
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-muted rounded"><Bed className="w-5 h-5 text-foreground" /></div>
                    <div>
                      <div className="text-xl font-bold">{property.bedrooms}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Bedrooms</div>
                    </div>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-muted rounded"><Bath className="w-5 h-5 text-foreground" /></div>
                    <div>
                      <div className="text-xl font-bold">{property.bathrooms}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Bathrooms</div>
                    </div>
                  </div>
                )}
                {property.parking != null && (
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-muted rounded"><Car className="w-5 h-5 text-foreground" /></div>
                    <div>
                      <div className="text-xl font-bold">{property.parking}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Parking</div>
                    </div>
                  </div>
                )}
                {property.landSize != null && (
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-muted rounded"><Square className="w-5 h-5 text-foreground" /></div>
                    <div>
                      <div className="text-xl font-bold">{property.landSize} <span className="text-sm font-normal text-muted-foreground">m²</span></div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Land Size</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-muted rounded"><Building2 className="w-5 h-5 text-foreground" /></div>
                  <div>
                    <div className="text-xl font-bold capitalize">{property.propertyType.replace('_', ' ')}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Type</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {property.description || 'No description provided.'}
                </p>
              </div>

              {property.features && property.features.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Features</h3>
                  <div className="flex flex-wrap gap-2">
                    {property.features.map(f => (
                      <Badge key={f} variant="secondary" className="px-3 py-1 bg-muted">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="py-6 space-y-6">
               <div className="grid grid-cols-2 gap-6">
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-base flex items-center"><Tag className="w-4 h-4 mr-2" /> Price History</CardTitle>
                   </CardHeader>
                   <CardContent>
                     {priceHistory && priceHistory.length > 0 ? (
                       <div className="space-y-4">
                         {priceHistory.map((ph, idx) => (
                           <div key={ph.id} className="flex justify-between items-center text-sm">
                             <div className="flex flex-col">
                               <span className="font-semibold text-foreground">{property.currency} {ph.price.toLocaleString()}</span>
                               <span className="text-xs text-muted-foreground">{format(new Date(ph.changedAt), 'MMM d, yyyy')}</span>
                             </div>
                             {ph.previousPrice && (
                               <div className={`flex items-center gap-1 font-medium ${ph.price > ph.previousPrice ? 'text-green-600' : 'text-red-600'}`}>
                                 {ph.price > ph.previousPrice ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                 {Math.abs(((ph.price - ph.previousPrice) / ph.previousPrice) * 100).toFixed(1)}%
                               </div>
                             )}
                           </div>
                         ))}
                       </div>
                     ) : <p className="text-sm text-muted-foreground">No price changes recorded.</p>}
                   </CardContent>
                 </Card>

                 <Card>
                   <CardHeader>
                     <CardTitle className="text-base flex items-center"><Activity className="w-4 h-4 mr-2" /> Activity Log</CardTitle>
                   </CardHeader>
                   <CardContent>
                     {activity && activity.length > 0 ? (
                       <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted before:to-transparent">
                         {activity.slice(0, 5).map(act => (
                           <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                             <div className="flex items-center justify-center w-5 h-5 rounded-full border border-background bg-muted text-muted-foreground group-[.is-active]:bg-primary group-[.is-active]:text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div>
                             <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded border border-border bg-card shadow-sm">
                               <div className="flex items-center justify-between mb-1">
                                 <div className="font-semibold text-sm">{act.type.replace('_', ' ')}</div>
                                 <time className="text-xs text-muted-foreground">{format(new Date(act.createdAt), 'MMM d')}</time>
                               </div>
                               <div className="text-xs text-muted-foreground">{act.message}</div>
                             </div>
                           </div>
                         ))}
                       </div>
                     ) : <p className="text-sm text-muted-foreground">No activity recorded.</p>}
                   </CardContent>
                 </Card>
               </div>
            </TabsContent>

            <TabsContent value="viewings" className="py-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center"><Eye className="w-4 h-4 mr-2" /> Viewings</CardTitle>
                    <CardDescription>Scheduled and past viewings</CardDescription>
                  </div>
                  <Button size="sm"><Calendar className="w-4 h-4 mr-2" /> Book</Button>
                </CardHeader>
                <CardContent>
                  {viewings && viewings.length > 0 ? (
                    <div className="divide-y">
                      {viewings.map(v => (
                        <div key={v.id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{v.buyerName || 'Unknown Buyer'}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(v.scheduledAt), 'MMM d, yyyy h:mm a')}</p>
                          </div>
                          <Badge variant={v.status === 'completed' ? 'default' : v.status === 'cancelled' ? 'destructive' : 'secondary'} className="capitalize">
                            {v.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No viewings scheduled.</p>}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="documents" className="py-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center"><FileText className="w-4 h-4 mr-2" /> Documents</CardTitle>
                    <CardDescription>Mandates, title deeds, and reports</CardDescription>
                  </div>
                  <Button size="sm">Upload</Button>
                </CardHeader>
                <CardContent>
                  {documents && documents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <FileText className="w-8 h-8 text-primary" />
                            <div>
                              <p className="font-medium text-sm line-clamp-1">{doc.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{doc.category.replace('_', ' ')} • {doc.sizeKb ? `${Math.round(doc.sizeKb/1024)}MB` : 'Unknown size'}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon"><Download className="w-4 h-4" /></Button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No documents uploaded.</p>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Sidebars */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="bg-muted/30 border-b border-border pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Performance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 divide-x divide-y border-b border-border">
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{property.views || 0}</div>
                  <div className="text-xs font-medium text-muted-foreground mt-1">VIEWS</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{property.enquiries || 0}</div>
                  <div className="text-xs font-medium text-muted-foreground mt-1">ENQUIRIES</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{property.shares || 0}</div>
                  <div className="text-xs font-medium text-muted-foreground mt-1">SHARES</div>
                </div>
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{viewings?.length || 0}</div>
                  <div className="text-xs font-medium text-muted-foreground mt-1">VIEWINGS</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-muted/30 border-b border-border pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
                <span>Seller Info</span>
                {property.mandateType === 'sole' && <Badge variant="secondary" className="text-[10px]">Sole Mandate</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {seller ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold">{seller.name}</div>
                    <div className="text-xs text-muted-foreground">{seller.email || 'No email'}</div>
                    <div className="text-xs text-muted-foreground">{seller.phone || 'No phone'}</div>
                  </div>
                  {property.mandateExpiry && (
                    <div className="pt-3 border-t text-xs flex justify-between items-center">
                      <span className="text-muted-foreground">Mandate Expires:</span>
                      <span className="font-medium text-destructive">{format(new Date(property.mandateExpiry), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {property.commissionPercent && (
                    <div className="text-xs flex justify-between items-center">
                      <span className="text-muted-foreground">Commission:</span>
                      <span className="font-medium">{property.commissionPercent}%</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">No seller assigned.</div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="bg-muted/30 border-b border-border pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Private Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-yellow-50/50 dark:bg-yellow-900/10">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                {property.privateNotes || 'No private notes.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}