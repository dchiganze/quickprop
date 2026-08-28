import { useGetPublicProperty, useSubmitEnquiry, useSaveProperty, useUnsaveProperty, useListSavedProperties } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { useParams } from "wouter";
import { Bed, Bath, Car, Maximize, MapPin, Share2, Heart, MessageSquare, Phone, Building, CheckCircle2, Users, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListSavedPropertiesQueryKey } from "@workspace/api-client-react";

const enquirySchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(6, "Phone number required"),
  message: z.string().min(10, "Please provide more details"),
});

export default function PropertyDetail() {
  const params = useParams();
  const propertyIdentifier = params.id || "";
  const id = parseInt(propertyIdentifier, 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // The public API accepts a numeric ID or the stable listing reference. This
  // lets links shared from the field app continue working after cross-device
  // sync replaces a temporary local ID.
  const { data, isLoading } = useGetPublicProperty(propertyIdentifier);
  const { data: savedProperties } = useListSavedProperties();
  
  const submitEnquiry = useSubmitEnquiry();
  const saveProperty = useSaveProperty();
  const unsaveProperty = useUnsaveProperty();

  const [activeImage, setActiveImage] = useState(0);

  const resolvedPropertyId = data?.property?.id ?? id;
  const isSaved = savedProperties?.some(p => p.id === resolvedPropertyId);

  const form = useForm<z.infer<typeof enquirySchema>>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: "I am interested in this property and would like to arrange a viewing.",
    },
  });

  const onSubmit = (values: z.infer<typeof enquirySchema>) => {
    submitEnquiry.mutate({
      data: {
        ...values,
        propertyId: resolvedPropertyId,
        agentId: data?.agent?.id,
        enquiryType: "viewing"
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Enquiry Sent",
          description: "The agent will be in touch with you shortly.",
        });
        form.reset();
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to send enquiry. Please try again.",
        });
      }
    });
  };

  const handleSaveToggle = () => {
    if (isSaved) {
      unsaveProperty.mutate({ propertyId: resolvedPropertyId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSavedPropertiesQueryKey() });
          toast({ description: "Property removed from saved list" });
        }
      });
    } else {
      saveProperty.mutate({ propertyId: resolvedPropertyId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSavedPropertiesQueryKey() });
          toast({ description: "Property saved successfully" });
        }
      });
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: data?.property?.title,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ description: "Link copied to clipboard" });
    }
  };

  if (isLoading || !data) return (
    <Layout>
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    </Layout>
  );

  const { property, agent, offers = [] } = data;
  const allImages = property.photos || [];
  if (property.coverImage && !allImages.includes(property.coverImage)) {
    allImages.unshift(property.coverImage);
  }
  const activeImageAttribution = offers
    .flatMap((offer) => offer.assets ?? [])
    .find((asset) => asset.objectPath === allImages[activeImage])
    ?.attributionName;

  return (
    <Layout>
      {/* Image Gallery Header */}
      <div className="bg-gray-900 w-full h-[40vh] md:h-[60vh] relative flex items-center justify-center overflow-hidden">
        {allImages.length > 0 ? (
          <>
            <img src={allImages[activeImage]} className="object-contain w-full h-full" alt={property.title} />
             <div className="absolute bottom-4 right-4 rounded-md bg-black/60 px-3 py-1.5 text-right text-[11px] font-semibold text-white backdrop-blur">
               <div>QuickProp</div>
               {activeImageAttribution && <div className="font-normal text-white/80">{activeImageAttribution}</div>}
             </div>
            {allImages.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto">
                {allImages.map((img, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setActiveImage(idx)}
                    className={`h-16 w-24 flex-shrink-0 border-2 rounded overflow-hidden transition-all ${activeImage === idx ? 'border-primary scale-105' : 'border-white/20 opacity-70'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-white/50">
            <Building className="h-16 w-16 mb-4" />
            <p>No images available</p>
          </div>
        )}
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex gap-2">
                  <Badge variant="default" className="bg-primary text-white text-sm px-3 py-1">
                    {property.listingType === 'sale' ? 'For Sale' : 'To Rent'}
                  </Badge>
                  <Badge variant="outline" className="bg-white text-sm px-3 py-1">
                    {property.propertyType}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleSaveToggle} className={isSaved ? "text-red-500 border-red-200 bg-red-50" : ""}>
                    <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                  </Button>
                </div>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{property.title}</h1>
              <p className="text-lg text-gray-500 flex items-center gap-2 mb-6">
                <MapPin className="h-5 w-5" />
                {property.address ? `${property.address}, ` : ''}{property.suburb}, {property.city}
              </p>

              <div className="text-3xl font-bold text-primary mb-8">
                {formatPrice(property.lowestPrice ?? property.price, property.currency)}
                {property.listingType === 'rent' && <span className="text-lg text-gray-500 font-normal"> / month</span>}
              </div>
              {(data.agencyCount ?? property.agencyCount ?? 1) > 1 && (
                <div className="mb-8 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-emerald-800">
                  <Users className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">{data.agencyCount} agencies represent this property</p>
                    <p className="text-sm text-emerald-700">Compare independent prices, terms and availability below.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-100">
                {property.bedrooms != null && (
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                    <Bed className="h-6 w-6 text-primary mb-2" />
                    <span className="font-bold text-lg">{property.bedrooms}</span>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Bedrooms</span>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                    <Bath className="h-6 w-6 text-primary mb-2" />
                    <span className="font-bold text-lg">{property.bathrooms}</span>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Bathrooms</span>
                  </div>
                )}
                {property.parking != null && (
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                    <Car className="h-6 w-6 text-primary mb-2" />
                    <span className="font-bold text-lg">{property.parking}</span>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Parking</span>
                  </div>
                )}
                {property.landSize != null && (
                  <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                    <Maximize className="h-6 w-6 text-primary mb-2" />
                    <span className="font-bold text-lg">{property.landSize}m²</span>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Land Size</span>
                  </div>
                )}
              </div>
            </div>

            {property.description && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Description</h2>
                <div className="prose prose-gray max-w-none">
                  {property.description.split('\n').map((para, i) => (
                    <p key={i} className="mb-4 text-gray-600 leading-relaxed">{para}</p>
                  ))}
                </div>
              </div>
            )}

            {property.features && property.features.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Features</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {property.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-gray-700">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {offers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Agency offers</h2>
                  <span className="text-sm text-gray-500">{offers.length} active offer{offers.length === 1 ? '' : 's'}</span>
                </div>
                <div className="grid gap-3">
                  {offers.map((offer) => (
                    <Card key={offer.id} className="border-gray-100">
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900">{offer.agencyName}</h3>
                            {offer.verificationStatus === 'verified' && <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="Verified availability" />}
                          </div>
                          <p className="text-sm text-gray-500">{offer.agentName} · {offer.mandateType.replace('_', ' ')}</p>
                          {offer.terms && <p className="text-sm text-gray-600 mt-1">{offer.terms}</p>}
                           {offer.assets?.[0]?.attributionName && (
                             <p className="mt-2 text-xs text-gray-500">Media: {offer.assets[0].attributionName}</p>
                           )}
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-bold text-primary">{formatPrice(offer.askingPrice, offer.currency)}</p>
                          <p className="text-xs text-gray-500 capitalize">{offer.priceStatus ?? 'current'} price</p>
                          {offer.phone && <a className="text-sm text-primary hover:underline" href={`tel:${offer.phone}`}>Contact agency</a>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              
              {agent && (
                <Card className="border-emerald-100 shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="h-16 w-16 rounded-full bg-gray-100 overflow-hidden">
                        {agent.avatarUrl ? (
                          <img src={agent.avatarUrl} alt={agent.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold text-xl">
                            {agent.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{agent.name}</h3>
                        <p className="text-sm text-gray-500">{agent.branchName || 'Agent'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      {agent.phone && (
                        <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" asChild>
                          <a href={`https://wa.me/${agent.phone.replace(/\D/g, '')}?text=Hi ${agent.name}, I'm interested in property reference: ${property.reference}`} target="_blank" rel="noopener noreferrer">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            WhatsApp
                          </a>
                        </Button>
                      )}
                      {agent.phone && (
                        <Button variant="outline" className="w-full" asChild>
                          <a href={`tel:${agent.phone}`}>
                            <Phone className="h-4 w-4 mr-2" />
                            Call Agent
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-4 text-gray-900">Enquire about this property</h3>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Your Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="+263..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Message</FormLabel>
                            <FormControl>
                              <Textarea rows={4} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={submitEnquiry.isPending}>
                        {submitEnquiry.isPending ? "Sending..." : "Send Enquiry"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
