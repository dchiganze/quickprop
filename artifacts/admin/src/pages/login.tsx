import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ShieldCheck, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
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
  useCompletePasswordSetup,
  useLogin,
  useRequestAdminPasswordReset,
  useRequestPasswordSetupCode,
} from '@workspace/api-client-react';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const requestPasswordReset = useRequestAdminPasswordReset();
  const requestPasswordSetupCode = useRequestPasswordSetupCode();
  const completePasswordSetup = useCompletePasswordSetup();
  const completePasswordReset = useCompleteAdminPasswordReset();
  const completeAgentSetup = useCompleteAgentSetup();
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const initialResetToken = new URLSearchParams(window.location.search).get('resetToken') || '';
  const initialSetupToken = new URLSearchParams(window.location.search).get('setupToken') || '';
  const [view, setView] = useState<'login' | 'request' | 'complete' | 'setup-request' | 'setup-code'>(initialResetToken || initialSetupToken ? 'complete' : 'login');
  const [resetEmail, setResetEmail] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      onError: (e: any) => setErr(e?.message || 'Sign-in failed. Check your credentials, or set up your password if this is your first time.'),
    });
  };

  const startPasswordReset = () => {
    setErr('');
    setNotice('');
    setResetEmail(form.getValues('email'));
    setView('request');
  };

  const startPasswordSetup = () => {
    setErr('');
    setNotice('');
    setResetEmail(form.getValues('email'));
    setSetupCode('');
    setNewPassword('');
    setConfirmPassword('');
    setView('setup-request');
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

  const requestSetupCode = () => {
    setErr('');
    setNotice('');
    requestPasswordSetupCode.mutate(
      { data: { email: resetEmail.trim().toLowerCase() } },
      {
        onSuccess: () => {
          setView('setup-code');
          setNotice("If this account needs a password, an eight-digit code has been sent to its email address.");
        },
        onError: (e: any) => setErr(e?.message || 'Could not request a code. Please try again.'),
      },
    );
  };

  const submitSetupRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    requestSetupCode();
  };

  const submitSetupCode = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErr('');
    setNotice('');
    if (!/^\d{8}$/.test(setupCode)) {
      setErr('Enter the eight-digit code from your email.');
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
    completePasswordSetup.mutate(
      { data: { email: resetEmail.trim().toLowerCase(), code: setupCode, newPassword } },
      {
        onSuccess: () => {
          setView('login');
          setSetupCode('');
          setNewPassword('');
          setConfirmPassword('');
          setNotice('Password created. Sign in with your email and new password.');
          setLocation('/login');
        },
        onError: (e: any) => setErr(e?.message || 'The code may be invalid or expired. Request a new one and try again.'),
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
              {view === 'login'
                ? 'Admin sign in'
                : view === 'request'
                  ? 'Reset your password'
                  : view === 'setup-request'
                    ? 'Set up your password'
                    : view === 'setup-code'
                      ? 'Verify your email'
                      : 'Choose a new password'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {view === 'login'
                ? 'Restricted to authorised administrators only.'
                : view === 'request'
                  ? 'Enter your administrator email and we’ll send a secure, one-time link if the account is eligible.'
                  : view === 'setup-request'
                    ? 'Enter the email address added by your administrator. We’ll send a one-time code if the account needs a password.'
                    : view === 'setup-code'
                      ? `Enter the eight-digit code sent to ${resetEmail}.`
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
            <>
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
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showLoginPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          {...field}
                          className="h-11 bg-card pr-11"
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((visible) => !visible)}
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showLoginPassword}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full h-11 font-semibold" disabled={login.isPending}>
                  {login.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Sign in</span><ArrowRight className="w-4 h-4 ml-2" /></>}
                </Button>
                </form>
              </Form>
              <p className="text-center text-sm text-muted-foreground">
                First time signing in?{' '}
                <button type="button" onClick={startPasswordSetup} className="font-medium text-primary hover:underline">
                  Set up your password
                </button>
              </p>
            </>
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
          ) : view === 'setup-request' ? (
            <form onSubmit={submitSetupRequest} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="setup-email" className="text-sm font-medium leading-none">Email</label>
                <Input
                  id="setup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="h-11 bg-card"
                />
              </div>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={requestPasswordSetupCode.isPending}>
                {requestPasswordSetupCode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send email code'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={returnToSignIn}>
                Back to sign in
              </Button>
            </form>
          ) : view === 'setup-code' ? (
            <form onSubmit={submitSetupCode} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="setup-code" className="text-sm font-medium leading-none">Eight-digit code</label>
                <Input
                  id="setup-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  required
                  value={setupCode}
                  onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="h-11 bg-card"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="setup-new-password" className="text-sm font-medium leading-none">New password</label>
                <div className="relative">
                  <Input id="setup-new-password" type={showNewPassword ? 'text' : 'password'} autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 bg-card pr-11" />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((visible) => !visible)}
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    aria-pressed={showNewPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="setup-confirm-password" className="text-sm font-medium leading-none">Confirm new password</label>
                <div className="relative">
                  <Input id="setup-confirm-password" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 bg-card pr-11" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                    aria-pressed={showConfirmPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                At least 10 characters, with at least one letter, one number, and one special character.
              </p>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={completePasswordSetup.isPending}>
                {completePasswordSetup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create password'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={requestSetupCode} disabled={requestPasswordSetupCode.isPending}>
                Send a new code
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={returnToSignIn}>
                Back to sign in
              </Button>
            </form>
          ) : (
            <form onSubmit={submitNewPassword} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium leading-none">New password</label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="h-11 bg-card pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((visible) => !visible)}
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    aria-pressed={showNewPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium leading-none">Confirm new password</label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-11 bg-card pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                    aria-pressed={showConfirmPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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
