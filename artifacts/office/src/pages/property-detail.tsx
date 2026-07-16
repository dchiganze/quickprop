import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  useGetProperty, useUpdateProperty, useGetPropertyPriceHistory, 
  useGetPropertyActivity, useGetSeller, getGetSellerQueryKey, useListViewings, useListDocuments,
  useGenerateBrochure, useShareProperty 
} from '@workspace/api-client-react';
import { 
  ArrowLeft, MapPin, Bed, Bath, Car, Square, Building2, Calendar, 
  Tag, Download, Share2, PenLine, CheckCircle2, FileText, Eye, 
  Activity, ArrowUpRight, ArrowDownRight, Loader2, Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function PropertyDetail({ params }: { params: { id: string } }) {
  const propertyId = parseInt(params.id, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: property, isLoading } = useGetProperty(propertyId);
  const { data: activity } = useGetPropertyActivity(propertyId);
  const { data: priceHistory } = useGetPropertyPriceHistory(propertyId);
  const { data: viewings } = useListViewings({ propertyId });
  const { data: documents } = useListDocuments({ propertyId });
  const sellerId = property?.sellerId;
  const { data: seller } = useGetSeller(sellerId || 0, { query: { enabled: !!sellerId, queryKey: getGetSellerQueryKey(sellerId || 0) }});

  const updateProperty = useUpdateProperty();
  const generateBrochure = useGenerateBrochure();
  const shareProperty = useShareProperty();

  const [shareChannel, setShareChannel] = useState('whatsapp');

  if (isLoading) {
    return <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>;
  }

  if (!property) {
    return <div className="p-8">Property not found</div>;
  }

  const handleStatusChange = (newStatus: string) => {
    updateProperty.mutate({ id: propertyId, data: { status: newStatus } }, {
      onSuccess: () => {
        toast({ title: 'Status updated', description: `Property status is now ${newStatus.replace('_', ' ')}` });
      }
    });
  };

  const handleGenerateBrochure = () => {
    window.open(`${window.location.pathname.replace(/\/property\/\d+.*/, '')}/property/${propertyId}/brochure`, '_blank');
  };

  const handleShare = () => {
    shareProperty.mutate({ id: propertyId, data: { channel: shareChannel } }, {
      onSuccess: (res) => {
        toast({ title: 'Share link created', description: 'Link copied to clipboard or opened in app.' });
        if (res.url) window.open(res.url, '_blank');
      }
    });
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{property.title}</h1>
              <Badge variant="outline" className="uppercase font-bold tracking-wider">{property.reference}</Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin className="w-4 h-4" />
              {property.address ? `${property.address}, ` : ''}{property.suburb}, {property.city}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <Select value={property.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px] bg-card font-semibold capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="internal_only">Internal Only</SelectItem>
              <SelectItem value="public">Publicly Listed</SelectItem>
              <SelectItem value="under_offer">Under Offer</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="shadow-sm">
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share Property</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <Select value={shareChannel} onValueChange={setShareChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="link">Copy Link</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={handleShare} disabled={shareProperty.isPending}>
                  {shareProperty.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
                  Share via {shareChannel}
                </Button>
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
            {property.coverImage ? (
              <img src={property.coverImage} alt={property.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                <p>No photos uploaded</p>
                <Button variant="outline" className="mt-4">Upload Photos</Button>
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
                {property.mandateType && <Badge variant="secondary" className="text-[10px] capitalize">{property.mandateType} Mandate</Badge>}
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