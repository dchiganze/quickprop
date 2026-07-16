import React, { useState } from 'react';
import { BookOpen, Building2, User, Users, ChevronRight, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useListUsers, useGetCurrentUser, useListProperties } from '@workspace/api-client-react';

type BrochureMode = 'my' | 'company' | 'custom';

export function BrochureCatalogDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<BrochureMode>('my');
  const [selectedAgents, setSelectedAgents] = useState<Set<number>>(new Set());

  const { data: currentUser } = useGetCurrentUser();
  const { data: users } = useListUsers({ query: { enabled: open } });
  const { data: allProps } = useListProperties(undefined, { query: { enabled: open } });

  const agents = (users ?? []).filter(u => u.role === 'agent' || u.role === 'admin');
  const PUBLIC_STATUSES = ['public', 'under_offer', 'coming_soon'];
  const publicProps = (allProps ?? []).filter(p => PUBLIC_STATUSES.includes(p.status));

  const previewCount = (() => {
    if (mode === 'my') return publicProps.filter(p => p.agentId === currentUser?.id).length;
    if (mode === 'company') return publicProps.length;
    return publicProps.filter(p => p.agentId != null && selectedAgents.has(p.agentId)).length;
  })();

  const toggleAgent = (id: number) => {
    setSelectedAgents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleGenerate = () => {
    const base = window.location.href.replace(/\/office.*/, '/office');
    let url = `${base}/brochure-catalog?mode=${mode}`;
    if (mode === 'custom' && selectedAgents.size > 0) {
      url += `&agents=${[...selectedAgents].join(',')}`;
    }
    window.open(url, '_blank');
    setOpen(false);
  };

  const canGenerate =
    (mode === 'my' && previewCount > 0) ||
    (mode === 'company' && previewCount > 0) ||
    (mode === 'custom' && selectedAgents.size > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 border-primary/40 text-primary hover:bg-primary/5 hover:text-primary font-semibold"
        >
          <BookOpen className="w-4 h-4" />
          Brochure
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Generate Brochure Catalogue
          </DialogTitle>
        </DialogHeader>

        {/* Mode selector */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Choose what to include</p>

          <button
            onClick={() => setMode('my')}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
              mode === 'my'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/30 hover:bg-muted/40'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${mode === 'my' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">My Listings</p>
              <p className="text-xs text-muted-foreground">Your published properties only</p>
            </div>
            {mode === 'my' && (
              <Badge variant="secondary" className="text-xs">{previewCount} props</Badge>
            )}
          </button>

          <button
            onClick={() => setMode('company')}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
              mode === 'company'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/30 hover:bg-muted/40'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${mode === 'company' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">Company Catalogue</p>
              <p className="text-xs text-muted-foreground">All published listings across the agency</p>
            </div>
            {mode === 'company' && (
              <Badge variant="secondary" className="text-xs">{previewCount} props</Badge>
            )}
          </button>

          <button
            onClick={() => setMode('custom')}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
              mode === 'custom'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/30 hover:bg-muted/40'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${mode === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">Custom — Pick Agents</p>
              <p className="text-xs text-muted-foreground">Select which agents to include</p>
            </div>
            {mode === 'custom' && selectedAgents.size > 0 && (
              <Badge variant="secondary" className="text-xs">{previewCount} props</Badge>
            )}
          </button>
        </div>

        {/* Agent picker — only shown in custom mode */}
        {mode === 'custom' && (
          <>
            <Separator />
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No agents found</p>
              ) : agents.map(agent => {
                const agentPropCount = publicProps.filter(p => p.agentId === agent.id).length;
                const initials = agent.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';
                return (
                  <label
                    key={agent.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedAgents.has(agent.id)}
                      onCheckedChange={() => toggleAgent(agent.id)}
                    />
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{agentPropCount}</Badge>
                  </label>
                );
              })}
            </div>
            {agents.length > 0 && (
              <div className="flex gap-2 text-xs">
                <button
                  className="text-primary hover:underline"
                  onClick={() => setSelectedAgents(new Set(agents.map(a => a.id)))}
                >
                  Select all
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  className="text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => setSelectedAgents(new Set())}
                >
                  Clear
                </button>
              </div>
            )}
          </>
        )}

        <Separator />

        <Button
          className="w-full"
          onClick={handleGenerate}
          disabled={!canGenerate}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          {canGenerate
            ? `Generate Brochure · ${previewCount} ${previewCount === 1 ? 'property' : 'properties'}`
            : mode === 'custom' ? 'Select at least one agent' : 'No published listings'}
          {canGenerate && <ChevronRight className="w-4 h-4 ml-auto" />}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
