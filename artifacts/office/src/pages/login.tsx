import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  useCompletePasswordSetup,
  useLogin,
  useRequestAdminPasswordReset,
  useRequestPasswordSetupCode,
} from '@workspace/api-client-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const requestPasswordReset = useRequestAdminPasswordReset();
  const requestPasswordSetupCode = useRequestPasswordSetupCode();
  const completePasswordSetup = useCompletePasswordSetup();
  const [errorMsg, setErrorMsg] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<'email' | 'code'>('email');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupNotice, setSetupNotice] = useState('');

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    setErrorMsg('');
    setResetNotice('');
    login.mutate({ data: values }, {
      onSuccess: () => {
        setLocation('/');
      },
      onError: (err: any) => {
        setErrorMsg(err?.message || 'Sign-in failed. Check your credentials, or set up your password if this is your first time.');
      }
    });
  };

  const sendResetLink = () => {
    setErrorMsg('');
    setResetNotice('');
    const email = form.getValues('email').trim();
    if (!email) {
      form.setError('email', { type: 'manual', message: 'Enter your administrator email first.' });
      return;
    }
    requestPasswordReset.mutate(
      { data: { email } },
      {
        onSuccess: () => setResetNotice(
          "If this email is eligible, QuickProp will send a password reset link. Check your spam folder if it doesn't arrive.",
        ),
        onError: (error: any) => setErrorMsg(error?.message || 'Could not request a password reset. Please try again.'),
      },
    );
  };

  const openPasswordSetup = () => {
    setSetupEmail(form.getValues('email').trim());
    setSetupStep('email');
    setSetupCode('');
    setSetupPassword('');
    setSetupPasswordConfirm('');
    setSetupError('');
    setSetupNotice('');
    setSetupOpen(true);
  };

  const requestSetupCode = () => {
    setSetupError('');
    requestPasswordSetupCode.mutate(
      { data: { email: setupEmail.trim().toLowerCase() } },
      {
        onSuccess: () => {
          setSetupStep('code');
          setSetupNotice("If this account needs a password, an eight-digit code has been sent to its email address.");
        },
        onError: (error: any) => setSetupError(error?.message || 'Could not request a code. Please try again.'),
      },
    );
  };

  const submitPasswordSetup = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSetupError('');
    if (!/^\d{8}$/.test(setupCode)) {
      setSetupError('Enter the eight-digit code from your email.');
      return;
    }
    if (
      setupPassword.length < 10
      || !/[A-Za-z]/.test(setupPassword)
      || !/[0-9]/.test(setupPassword)
      || !/[^A-Za-z0-9\s]/.test(setupPassword)
    ) {
      setSetupError('Use at least 10 characters, including a letter, a number, and a special character.');
      return;
    }
    if (setupPassword !== setupPasswordConfirm) {
      setSetupError('The passwords do not match.');
      return;
    }
    completePasswordSetup.mutate(
      {
        data: {
          email: setupEmail.trim().toLowerCase(),
          code: setupCode,
          newPassword: setupPassword,
        },
      },
      {
        onSuccess: () => {
          setSetupOpen(false);
          setSetupCode('');
          setSetupPassword('');
          setSetupPasswordConfirm('');
          setResetNotice('Password created. Sign in with your email and new password.');
        },
        onError: (error: any) => setSetupError(error?.message || 'The code may be invalid or expired. Request a new one and try again.'),
      },
    );
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

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {resetNotice && (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900" data-testid="alert-reset-link-requested">
              <AlertDescription>{resetNotice}</AlertDescription>
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
                        <Button
                          type="button"
                          variant="link"
                          className="px-0 h-auto text-xs text-muted-foreground hover:text-primary"
                          onClick={sendResetLink}
                          disabled={requestPasswordReset.isPending}
                          data-testid="button-request-password-reset"
                        >
                          {requestPasswordReset.isPending ? 'Sending…' : 'Forgot password?'}
                      </Button>
                    </div>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" placeholder="••••••••" {...field} className="h-12 bg-card" />
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

          <p className="text-center text-sm text-muted-foreground">
            First time signing in?{' '}
            <Button type="button" variant="link" className="px-1" onClick={openPasswordSetup} data-testid="button-first-time-password-setup">
              Set up your password
            </Button>
          </p>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Don't have an account? <Button variant="link" className="px-1 text-primary">Contact Sales</Button>
          </p>
        </div>
      </div>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{setupStep === 'email' ? 'Set up your password' : 'Enter your email code'}</DialogTitle>
            <DialogDescription>
              {setupStep === 'email'
                ? 'Enter the email address added by your administrator. We will send a one-time code if this account needs a password.'
                : `Enter the eight-digit code sent to ${setupEmail}.`}
            </DialogDescription>
          </DialogHeader>
          {setupError && <Alert variant="destructive"><AlertDescription>{setupError}</AlertDescription></Alert>}
          {setupNotice && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900"><AlertDescription>{setupNotice}</AlertDescription></Alert>}
          {setupStep === 'email' ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                requestSetupCode();
              }}
              className="space-y-4"
            >
              <label className="block space-y-2">
                <span className="text-sm font-medium">Email address</span>
                <Input
                  type="email"
                  autoComplete="email"
                  value={setupEmail}
                  onChange={(event) => setSetupEmail(event.target.value)}
                  required
                />
              </label>
              <Button type="submit" className="w-full" disabled={requestPasswordSetupCode.isPending || !setupEmail.trim()}>
                {requestPasswordSetupCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send email code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitPasswordSetup} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Eight-digit code</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  value={setupCode}
                  onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">New password</span>
                <Input type="password" autoComplete="new-password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} required />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Confirm password</span>
                <Input type="password" autoComplete="new-password" value={setupPasswordConfirm} onChange={(event) => setSetupPasswordConfirm(event.target.value)} required />
              </label>
              <p className="text-xs text-muted-foreground">At least 10 characters, with a letter, number, and special character.</p>
              <Button type="submit" className="w-full" disabled={completePasswordSetup.isPending}>
                {completePasswordSetup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create password'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={requestSetupCode} disabled={requestPasswordSetupCode.isPending}>
                Send a new code
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}