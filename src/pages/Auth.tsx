import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';

type AuthView = 'signin' | 'signup' | 'forgot';

export default function Auth() {
  const { user, signIn, signUp, resetPassword } = useAuth();
  const [view, setView] = useState<AuthView>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

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
    } else if (view === 'signin') {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      }
    } else if (view === 'forgot') {
      if (!resetPassword) {
        toast.error('Password reset is not configured in AuthContext.');
        setLoading(false);
        return;
      }
      const { error } = await resetPassword(email);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password reset email sent! Check your inbox.');
        setView('signin');
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
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {view !== 'forgot' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
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

          <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
            {loading ? 'Please wait...' : view === 'signup' ? 'Create Account' : view === 'signin' ? 'Sign In' : 'Send Reset Link'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="text-center space-y-2">
          {view === 'forgot' ? (
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