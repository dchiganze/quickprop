import React, { useState, useMemo } from 'react';
import { BookOpen, Building2, User, Users, ChevronRight, ChevronDown, Home } from 'lucide-react';
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

const PUBLIC_STATUSES = ['public', 'under_offer', 'coming_soon'];

export function BrochureCatalogDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<BrochureMode>('my');

  // Custom mode state
  const [selectedPropIds, setSelectedPropIds] = useState<Set<number>>(new Set());
  const [expandedAgents, setExpandedAgents] = useState<Set<number>>(new Set());

  const { data: currentUser } = useGetCurrentUser();
  const { data: users } = useListUsers({ query: { enabled: open } });
  const { data: allPropsData } = useListProperties(undefined, { query: { enabled: open } });

  const agents = useMemo(
    () => (users ?? []).filter(u => u.role === 'agent' || u.role === 'admin'),
    [users],
  );
  const publicProps = useMemo(
    () => (allPropsData ?? []).filter(p => PUBLIC_STATUSES.includes(p.status)),
    [allPropsData],
  );

  // Props per agent map
  const propsByAgent = useMemo(() => {
    const map = new Map<number, typeof publicProps>();
    agents.forEach(a => {
      map.set(a.id, publicProps.filter(p => p.agentId === a.id));
    });
    return map;
  }, [agents, publicProps]);

  const previewCount = useMemo(() => {
    if (mode === 'my') return publicProps.filter(p => p.agentId === currentUser?.id).length;
    if (mode === 'company') return publicProps.length;
    return selectedPropIds.size;
  }, [mode, publicProps, currentUser, selectedPropIds]);

  // Agent checkbox state helpers
  const agentCheckState = (agentId: number): boolean | 'indeterminate' => {
    const props = propsByAgent.get(agentId) ?? [];
    if (props.length === 0) return false;
    const selectedCount = props.filter(p => selectedPropIds.has(p.id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === props.length) return true;
    return 'indeterminate';
  };

  const toggleAgent = (agentId: number) => {
    const props = propsByAgent.get(agentId) ?? [];
    const state = agentCheckState(agentId);
    setSelectedPropIds(prev => {
      const next = new Set(prev);
      if (state === true) {
        // deselect all
        props.forEach(p => next.delete(p.id));
      } else {
        // select all
        props.forEach(p => next.add(p.id));
      }
      return next;
    });
  };

  const toggleProp = (propId: number) => {
    setSelectedPropIds(prev => {
      const next = new Set(prev);
      next.has(propId) ? next.delete(propId) : next.add(propId);
      return next;
    });
  };

  const toggleExpand = (agentId: number) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      next.has(agentId) ? next.delete(agentId) : next.add(agentId);
      return next;
    });
  };

  const selectAllAgents = () => {
    setSelectedPropIds(new Set(publicProps.map(p => p.id)));
  };

  const clearAll = () => {
    setSelectedPropIds(new Set());
  };

  const handleGenerate = () => {
    const base = window.location.href.replace(/\/office.*/, '/office');
    let url = `${base}/brochure-catalog?mode=${mode}`;
    if (mode === 'custom' && selectedPropIds.size > 0) {
      url += `&props=${[...selectedPropIds].join(',')}`;
    }
    window.open(url, '_blank');
    setOpen(false);
  };

  const canGenerate =
    (mode === 'my' && previewCount > 0) ||
    (mode === 'company' && previewCount > 0) ||
    (mode === 'custom' && selectedPropIds.size > 0);

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

      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Generate Brochure Catalogue
          </DialogTitle>
        </DialogHeader>

        {/* Mode selector */}
        <div className="space-y-2 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Choose what to include</p>

          <button
            onClick={() => setMode('my')}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
              mode === 'my' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30 hover:bg-muted/40'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${mode === 'my' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">My Listings</p>
              <p className="text-xs text-muted-foreground">Your published properties only</p>
            </div>
            {mode === 'my' && <Badge variant="secondary" className="text-xs">{previewCount} props</Badge>}
          </button>

          <button
            onClick={() => setMode('company')}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
              mode === 'company' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30 hover:bg-muted/40'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${mode === 'company' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">Company Catalogue</p>
              <p className="text-xs text-muted-foreground">All published listings across the agency</p>
            </div>
            {mode === 'company' && <Badge variant="secondary" className="text-xs">{previewCount} props</Badge>}
          </button>

          <button
            onClick={() => setMode('custom')}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
              mode === 'custom' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30 hover:bg-muted/40'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${mode === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">Custom — Pick Agents & Properties</p>
              <p className="text-xs text-muted-foreground">Choose exactly which listings to include</p>
            </div>
            {mode === 'custom' && selectedPropIds.size > 0 && (
              <Badge variant="secondary" className="text-xs">{selectedPropIds.size} props</Badge>
            )}
          </button>
        </div>

        {/* Agent + property picker */}
        {mode === 'custom' && (
          <>
            <Separator className="shrink-0" />

            {/* Select all / clear */}
            {agents.length > 0 && (
              <div className="flex gap-2 text-xs shrink-0">
                <button className="text-primary hover:underline" onClick={selectAllAgents}>
                  Select all properties
                </button>
                <span className="text-muted-foreground">·</span>
                <button className="text-muted-foreground hover:text-foreground hover:underline" onClick={clearAll}>
                  Clear all
                </button>
              </div>
            )}

            <div className="overflow-y-auto flex-1 space-y-1 pr-1 min-h-0">
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No agents found</p>
              ) : agents.map(agent => {
                const agentProps = propsByAgent.get(agent.id) ?? [];
                const checkState = agentCheckState(agent.id);
                const isExpanded = expandedAgents.has(agent.id);
                const initials = agent.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';

                return (
                  <div key={agent.id} className="rounded-lg border border-border overflow-hidden">
                    {/* Agent header row */}
                    <div className="flex items-center gap-3 p-2.5 bg-muted/30">
                      <Checkbox
                        checked={checkState}
                        onCheckedChange={() => toggleAgent(agent.id)}
                      />
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.email}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {agentProps.filter(p => selectedPropIds.has(p.id)).length}/{agentProps.length}
                      </Badge>
                      {agentProps.length > 0 && (
                        <button
                          onClick={() => toggleExpand(agent.id)}
                          className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          }
                        </button>
                      )}
                    </div>

                    {/* Property rows */}
                    {isExpanded && agentProps.length > 0 && (
                      <div className="divide-y divide-border">
                        {agentProps.map(prop => (
                          <label
                            key={prop.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selectedPropIds.has(prop.id)}
                              onCheckedChange={() => toggleProp(prop.id)}
                            />
                            <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{prop.title}</p>
                              <p className="text-xs text-muted-foreground">{prop.suburb} · {prop.reference}</p>
                            </div>
                            <span className="text-xs text-primary font-semibold shrink-0">
                              {prop.currency} {prop.price >= 1_000_000
                                ? `${(prop.price / 1_000_000).toFixed(1)}M`
                                : prop.price.toLocaleString()}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    {isExpanded && agentProps.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">No published listings</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <Separator className="shrink-0" />

        <Button className="w-full shrink-0" onClick={handleGenerate} disabled={!canGenerate}>
          <BookOpen className="w-4 h-4 mr-2" />
          {canGenerate
            ? `Generate Brochure · ${previewCount} ${previewCount === 1 ? 'property' : 'properties'}`
            : mode === 'custom' ? 'Select at least one property' : 'No published listings'}
          {canGenerate && <ChevronRight className="w-4 h-4 ml-auto" />}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
