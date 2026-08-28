import { PublicProperty } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { Bed, Bath, Car, Maximize, MapPin, Building, Activity, Users } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export function PropertyCard({ property }: { property: PublicProperty }) {
  const imageUrl = property.coverImage || property.photos?.[0];

  return (
    <Link href={`/properties/${property.id}`} className="group h-full">
      <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-lg border-gray-100 hover:border-primary/20 flex flex-col bg-white">
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={property.title} 
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-gray-100 text-gray-400 flex-col gap-2">
              <Building className="h-10 w-10 opacity-20" />
              <span className="text-xs uppercase tracking-wider font-semibold">{property.propertyType}</span>
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge variant="default" className="bg-primary hover:bg-primary shadow-sm font-semibold tracking-wide uppercase text-[10px]">
              {property.listingType === 'sale' ? 'For Sale' : 'To Rent'}
            </Badge>
            {property.status && property.status !== 'public' && (
              <Badge variant="secondary" className="bg-white/90 text-gray-800 shadow-sm backdrop-blur-sm font-semibold tracking-wide uppercase text-[10px]">
                {property.status.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-5 flex-1 flex flex-col">
          <div className="mb-2">
            <h3 className="font-bold text-xl text-primary tracking-tight">
              {formatPrice(property.lowestPrice ?? property.price, property.currency)}
            </h3>
            {property.listingType === 'rent' && <span className="text-xs text-gray-500 uppercase tracking-wider font-medium ml-1">/ month</span>}
          </div>
          <h4 className="font-medium text-gray-900 mb-1 line-clamp-1">{property.title}</h4>
          <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-4 line-clamp-1 mt-auto">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            {property.suburb}, {property.city}
          </p>
          {(property.agencyCount ?? 1) > 1 && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Users className="h-3.5 w-3.5" />
              {property.agencyCount} agencies · compare offers
            </div>
          )}
        </CardContent>
        <CardFooter className="px-5 py-4 border-t bg-gray-50/50 flex flex-wrap gap-4 text-gray-600 text-sm">
          {property.bedrooms != null && property.bedrooms > 0 && (
            <div className="flex items-center gap-1.5 font-medium" title="Bedrooms">
              <Bed className="h-4 w-4 text-gray-400" />
              <span>{property.bedrooms}</span>
            </div>
          )}
          {property.bathrooms != null && property.bathrooms > 0 && (
            <div className="flex items-center gap-1.5 font-medium" title="Bathrooms">
              <Bath className="h-4 w-4 text-gray-400" />
              <span>{property.bathrooms}</span>
            </div>
          )}
          {property.parking != null && property.parking > 0 && (
            <div className="flex items-center gap-1.5 font-medium" title="Parking">
              <Car className="h-4 w-4 text-gray-400" />
              <span>{property.parking}</span>
            </div>
          )}
          {property.landSize != null && property.landSize > 0 && (
            <div className="flex items-center gap-1.5 font-medium ml-auto" title="Land Size">
              <Maximize className="h-4 w-4 text-gray-400" />
              <span>{property.landSize}m²</span>
            </div>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
