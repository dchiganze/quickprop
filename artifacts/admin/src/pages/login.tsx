import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ShieldCheck, ArrowRight, Loader2, Info } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLogin } from '@workspace/api-client-react';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [err, setErr] = useState('');

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (v: z.infer<typeof schema>) => {
    setErr('');
    login.mutate({ data: v }, {
      onSuccess: () => setLocation('/'),
      onError: (e: any) => setErr(e?.message || 'Invalid credentials'),
    });
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      {/* Brand panel */}
      <div className="hidden md:flex flex-col justify-between w-5/12 p-12 bg-sidebar text-sidebar-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-sidebar-accent/30 z-0" />
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/20 rounded-full filter blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-96 h-96 bg-blue-400/10 rounded-full filter blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center shadow-lg shadow-sidebar-primary/40">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-sidebar-accent-foreground">QuickProp</p>
            <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">Admin Portal</p>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold leading-tight text-sidebar-accent-foreground mb-4">
            Platform Control Centre
          </h1>
          <p className="text-sidebar-foreground/70 leading-relaxed mb-8">
            Full operational oversight of QuickProp — properties, agencies, agents, buyers, leads, and platform health — all in one place.
          </p>
          <div className="flex items-center gap-4 text-xs font-medium text-sidebar-foreground/40">
            <span>Super Admin</span>
            <span className="w-1 h-1 bg-sidebar-primary rounded-full" />
            <span>Ops Admin</span>
            <span className="w-1 h-1 bg-sidebar-primary rounded-full" />
            <span>Support</span>
          </div>
        </div>
      </div>

      {/* Login panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-7">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground">Admin sign in</h2>
            <p className="text-sm text-muted-foreground">Restricted to authorised administrators only.</p>
          </div>

          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-primary text-sm ml-2">
              Demo: any email + <code className="bg-primary/10 px-1 py-0.5 rounded">demo1234</code>
            </AlertDescription>
          </Alert>

          {err && (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="admin@quickprop.co.zw" {...field} className="h-11 bg-card" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} className="h-11 bg-card" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full h-11 font-semibold" disabled={login.isPending}>
                {login.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Sign in</span><ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
