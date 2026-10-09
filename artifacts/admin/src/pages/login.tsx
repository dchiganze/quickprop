import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useCompleteAgentSetup,
  useCompleteAdminPasswordReset,
  useLogin,
  useRequestAdminPasswordReset,
} from '@workspace/api-client-react';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const requestPasswordReset = useRequestAdminPasswordReset();
  const completePasswordReset = useCompleteAdminPasswordReset();
  const completeAgentSetup = useCompleteAgentSetup();
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const initialResetToken = new URLSearchParams(window.location.search).get('resetToken') || '';
  const initialSetupToken = new URLSearchParams(window.location.search).get('setupToken') || '';
  const [view, setView] = useState<'login' | 'request' | 'complete'>(initialResetToken || initialSetupToken ? 'complete' : 'login');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const resetToken = new URLSearchParams(window.location.search).get('resetToken') || '';
  const setupToken = new URLSearchParams(window.location.search).get('setupToken') || '';
  const isAgentSetup = Boolean(setupToken);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (v: z.infer<typeof schema>) => {
    setErr('');
    setNotice('');
    login.mutate({ data: v }, {
      onSuccess: () => setLocation('/'),
      onError: (e: any) => setErr(e?.message || 'Invalid credentials'),
    });
  };

  const startPasswordReset = () => {
    setErr('');
    setNotice('');
    setResetEmail(form.getValues('email'));
    setView('request');
  };

  const returnToSignIn = () => {
    setErr('');
    setNotice('');
    setView('login');
    setLocation('/login');
  };

  const submitResetRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErr('');
    setNotice('');
    requestPasswordReset.mutate(
      { data: { email: resetEmail.trim() } },
      {
        onSuccess: () => setNotice(
          "If this email is eligible, we'll send a one-time password setup link. Check your spam folder if it doesn't arrive.",
        ),
        onError: (e: any) => setErr(e?.message || 'Could not request a reset link. Please try again.'),
      },
    );
  };

  const submitNewPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErr('');
    setNotice('');
    if (!resetToken) {
      setErr('This reset link is incomplete. Request a new one to continue.');
      return;
    }
    if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9\s]/.test(newPassword)) {
      setErr('Use at least 10 characters, including a letter, a number, and a special character.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('The passwords do not match.');
      return;
    }
    const token = setupToken || resetToken;
    if (!token) {
      setErr('This link is incomplete. Ask for a new setup or reset link to continue.');
      return;
    }
    const onSuccess = () => {
      setView('login');
      setNewPassword('');
      setConfirmPassword('');
      setErr('');
      setNotice(isAgentSetup
        ? 'Your QuickProp Agent account is ready. Sign in through the QuickProp Agent app.'
        : 'Your password has been reset. Sign in with the new password.');
      setLocation('/login');
    };
    const onError = (e: any) => setErr(e?.message || 'This link is invalid or expired. Request a new one.');
    if (isAgentSetup) {
      completeAgentSetup.mutate({ data: { token, newPassword } }, { onSuccess, onError });
    } else {
      completePasswordReset.mutate({ data: { token, newPassword } }, { onSuccess, onError });
    }
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
            <h2 className="text-2xl font-bold text-foreground">
              {view === 'login' ? 'Admin sign in' : view === 'request' ? 'Reset your password' : 'Choose a new password'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {view === 'login'
                ? 'Restricted to authorised administrators only.'
                : view === 'request'
                  ? 'Enter your administrator email and we’ll send a secure, one-time link if the account is eligible.'
                  : isAgentSetup
                    ? 'Choose a password for your QuickProp Agent account.'
                    : 'Choose a password for your QuickProp administrator account.'}
            </p>
          </div>

          {err && (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}

          {notice && (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {view === 'login' ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="username" placeholder="name@company.com" {...field} className="h-11 bg-card" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <button
                        type="button"
                        onClick={startPasswordReset}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" placeholder="••••••••" {...field} className="h-11 bg-card" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full h-11 font-semibold" disabled={login.isPending}>
                  {login.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Sign in</span><ArrowRight className="w-4 h-4 ml-2" /></>}
                </Button>
              </form>
            </Form>
          ) : view === 'request' ? (
            <form onSubmit={submitResetRequest} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="reset-email" className="text-sm font-medium leading-none">Email</label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="h-11 bg-card"
                />
              </div>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={requestPasswordReset.isPending}>
                {requestPasswordReset.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset link'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={returnToSignIn}>
                Back to sign in
              </Button>
            </form>
          ) : (
            <form onSubmit={submitNewPassword} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium leading-none">New password</label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-11 bg-card"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium leading-none">Confirm new password</label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 bg-card"
                />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                At least 10 characters, with at least one letter, one number, and one special character.
              </p>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={completePasswordReset.isPending || completeAgentSetup.isPending}>
                {completePasswordReset.isPending || completeAgentSetup.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : isAgentSetup ? 'Set password' : 'Reset password'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={returnToSignIn}>
                Back to sign in
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
