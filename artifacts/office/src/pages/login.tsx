import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Loader2, Info } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLogin } from '@workspace/api-client-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [errorMsg, setErrorMsg] = useState('');

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    setErrorMsg('');
    login.mutate({ data: values }, {
      onSuccess: () => {
        setLocation('/');
      },
      onError: (err: any) => {
        setErrorMsg(err?.message || 'Failed to sign in. Please check your credentials.');
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      {/* Brand Side */}
      <div className="hidden md:flex flex-col justify-between w-1/2 p-12 bg-sidebar text-sidebar-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-sidebar-accent opacity-50 z-0"></div>
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

        <div className="relative z-10 flex items-center gap-3">
           <img
             src={`${import.meta.env.BASE_URL}quickprop-office-logo.svg`}
             alt=""
             className="h-10 w-10 rounded object-cover shadow-lg shadow-primary/20"
           />
          <span className="text-2xl font-bold tracking-tight">QuickProp Office</span>
        </div>

        <div className="relative z-10 max-w-md mt-auto">
          <h1 className="text-4xl font-bold mb-6 leading-tight">Command Centre for the Modern Estate Agency.</h1>
          <p className="text-lg text-sidebar-foreground/80 mb-8 leading-relaxed">
            Manage your entire portfolio, pipeline, and team from a single, high-performance dashboard designed for speed.
          </p>
          <div className="flex items-center gap-4 text-sm font-medium text-sidebar-foreground/60">
            <span>Built for Zimbabwe</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            <span>Real-time Sync</span>
          </div>
        </div>
      </div>

      {/* Login Side */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center md:text-left space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="text-muted-foreground">Sign in to your QuickProp account</p>
          </div>

          <Alert className="bg-primary/5 border-primary/20 text-primary-foreground/90">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-primary text-sm font-medium ml-2">
              Demo Access: Any email + <code className="bg-primary/10 px-1 py-0.5 rounded text-primary">demo1234</code>
            </AlertDescription>
          </Alert>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="name@agency.co.zw" {...field} className="h-12 bg-card" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Button variant="link" className="px-0 h-auto text-xs text-muted-foreground hover:text-primary" tabIndex={-1}>
                        Forgot password?
                      </Button>
                    </div>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="h-12 bg-card" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={login.isPending}>
                {login.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Don't have an account? <Button variant="link" className="px-1 text-primary">Contact Sales</Button>
          </p>
        </div>
      </div>
    </div>
  );
}