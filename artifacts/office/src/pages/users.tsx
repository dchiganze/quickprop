import React, { useState } from 'react';
import { useListUsers, useListBranches } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Building2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function Users() {
  const { data: users, isLoading: loadingUsers } = useListUsers();
  const { data: branches, isLoading: loadingBranches } = useListBranches();

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team & Branches</h1>
          <p className="text-muted-foreground mt-1">Manage agency staff and office locations.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Branch
          </Button>
          <Button className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6">
          <TabsTrigger value="users" className="px-6">Team Members</TabsTrigger>
          <TabsTrigger value="branches" className="px-6">Branches</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-4">User</div>
              <div className="col-span-3">Role</div>
              <div className="col-span-3">Branch</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <div className="divide-y">
              {loadingUsers ? (
                Array.from({length: 4}).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center">
                    <Skeleton className="h-10 col-span-4" />
                    <Skeleton className="h-5 col-span-3" />
                    <Skeleton className="h-5 col-span-3" />
                    <Skeleton className="h-6 w-16 ml-auto col-span-2" />
                  </div>
                ))
              ) : (
                users?.map(user => (
                  <div key={user.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors">
                    <div className="col-span-4 flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatarUrl || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-foreground">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                    <div className="col-span-3 capitalize text-sm">{user.role.replace('_', ' ')}</div>
                    <div className="col-span-3 text-sm text-muted-foreground">
                      {branches?.find(b => b.id === user.branchId)?.name || 'Head Office'}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className={user.status === 'active' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200' : ''}>
                        {user.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="branches">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loadingBranches ? (
                Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
              ) : (
                branches?.map(branch => (
                  <Card key={branch.id} className="hover-elevate">
                    <CardHeader className="pb-3 border-b">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary" />
                        {branch.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2 text-sm text-muted-foreground">
                      {branch.address && <div>{branch.address}</div>}
                      {branch.phone && <div>Tel: {branch.phone}</div>}
                      <div className="mt-4 flex -space-x-2">
                         {users?.filter(u => u.branchId === branch.id).slice(0,5).map(u => (
                           <Avatar key={u.id} className="w-8 h-8 border-2 border-background">
                             <AvatarImage src={u.avatarUrl || ''} />
                             <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{u.name.charAt(0)}</AvatarFallback>
                           </Avatar>
                         ))}
                         <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium z-10 text-muted-foreground">
                           {users?.filter(u => u.branchId === branch.id).length || 0}
                         </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}