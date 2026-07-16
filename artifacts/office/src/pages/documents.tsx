import React, { useState } from 'react';
import { useListDocuments, Document } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FileText, Download, Upload } from 'lucide-react';
import { format } from 'date-fns';

export default function Documents() {
  const [search, setSearch] = useState('');
  const { data: documents, isLoading } = useListDocuments({ q: search || undefined });

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents Register</h1>
          <p className="text-muted-foreground mt-1">Central repository for agency contracts, mandates, and forms.</p>
        </div>
        <Button className="shadow-sm">
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <div className="bg-card p-4 rounded-lg border border-border shadow-sm flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search documents..." 
            className="pl-9 bg-muted/50 border-muted-foreground/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-5">Name</div>
          <div className="col-span-3">Category</div>
          <div className="col-span-2">Date Added</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        
        <div className="divide-y">
          {isLoading ? (
            Array.from({length: 5}).map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 p-4">
                <Skeleton className="h-5 col-span-5" />
                <Skeleton className="h-5 col-span-3" />
                <Skeleton className="h-5 col-span-2" />
                <Skeleton className="h-8 col-span-2" />
              </div>
            ))
          ) : documents?.length === 0 ? (
             <div className="p-12 text-center text-muted-foreground">
               <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
               <p>No documents found.</p>
             </div>
          ) : (
            documents?.map(doc => (
              <div key={doc.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors">
                <div className="col-span-5 flex items-center gap-3">
                  <div className="p-2 rounded bg-primary/10 text-primary">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-foreground">{doc.name}</span>
                </div>
                <div className="col-span-3 capitalize text-sm">{doc.category.replace('_', ' ')}</div>
                <div className="col-span-2 text-sm text-muted-foreground">
                  {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button variant="ghost" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    {doc.sizeKb ? `${Math.round(doc.sizeKb/1024)}MB` : 'Download'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}