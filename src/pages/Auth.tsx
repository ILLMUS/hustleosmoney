import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type AuthView = 'signin' | 'signup' | 'forgot' | 'update-password';

export default function Auth() {
  const { user, signIn, signUp, resetPassword, updatePassword } = useAuth();
  const [view, setView] = useState<AuthView>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Listen for Supabase password recovery event on component mount
  useEffect(() => {
    // Check if the URL already has recovery tokens when first loaded
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setView('update-password');
    }

    // Also listen for real-time auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('update-password');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (user && view !== 'update-password') return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (view === 'signup') {
      const { error } = await signUp(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Account created! Check your email to confirm.');
      }
    } 
    else if (view === 'signin') {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      }
    } 
    else if (view === 'forgot') {
      const { error } = await resetPassword(email);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password reset email sent! Check your inbox.');
        setView('signin');
      }
    } 
    else if (view === 'update-password') {
      if (password !== confirmPassword) {
        toast.error('Passwords do not match.');
        setLoading(false);
        return;
      }
      const { error } = await updatePassword(password);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully! Please sign in.');
        await supabase.auth.signOut(); // Log them out of the temporary recovery session
        setView('signin');
        setPassword('');
        setConfirmPassword('');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-heading font-bold tracking-tight">HustleOS</h1>
          <p className="text-muted-foreground">
            {view === 'signup' && 'Create your account'}
            {view === 'signin' && 'Sign in to your account'}
            {view === 'forgot' && 'Reset your password'}
            {view === 'update-password' && 'Set your new password'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email input (hidden during password update) */}
          {view !== 'update-password' && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>
          )}

          {/* Password input */}
          {view !== 'forgot' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">
                  {view === 'update-password' ? 'New Password' : 'Password'}
                </Label>
                {view === 'signin' && (
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  minLength={6}
                  required
                />
              </div>
            </div>
          )}

          {/* Confirm Password input (only for update-password view) */}
          {view === 'update-password' && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  minLength={6}
                  required
                />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
            {loading ? 'Please wait...' : 
             view === 'signup' ? 'Create Account' : 
             view === 'signin' ? 'Sign In' : 
             view === 'forgot' ? 'Send Reset Link' : 'Update Password'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="text-center space-y-2">
          {view === 'forgot' || view === 'update-password' ? (
            <button
              type="button"
              onClick={() => setView('signin')}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setView(view === 'signup' ? 'signin' : 'signup')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {view === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}