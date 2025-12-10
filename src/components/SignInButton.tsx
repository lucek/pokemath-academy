import type { Database } from '../db/database.types';
import { createBrowserClient } from '@supabase/ssr';
import { useState } from 'react';

interface SignInButtonProps {
  readonly onError?: (error: AuthError) => void;
}

interface AuthError {
  readonly code: string;
  readonly message: string;
}

interface MockAuthPayload {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly token_type: string;
  readonly user?: {
    readonly id: string;
    readonly email: string;
  };
}

const isMockAuthEnabled = (): boolean => {
  if (import.meta.env.E2E_AUTH_MOCK === 'true' || import.meta.env.MODE === 'e2e') {
    return true;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  return document.cookie.split(';').some((cookie) => cookie.trim().startsWith('e2e-auth-mock='));
};

const ensureMockAuthCookie = (): void => {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = 'e2e-auth-mock=true; path=/; max-age=3600; SameSite=Lax';
};

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const Spinner = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

export default function SignInButton({ onError }: Readonly<SignInButtonProps>) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const shouldUseMockAuth = isMockAuthEnabled();

      if (shouldUseMockAuth) {
        ensureMockAuthCookie();
        const tokenResponse = await fetch('/auth/v1/token', { method: 'POST' });
        if (!tokenResponse.ok) {
          throw new Error('Mocked OAuth request failed');
        }
        const tokenPayload = (await tokenResponse.json()) as MockAuthPayload | null;
        if (!tokenPayload?.user?.email) {
          throw new Error('Mocked OAuth payload is missing user data');
        }

        await fetch('/auth/v1/user').catch(() => undefined);
        globalThis.sessionStorage.setItem(
          'pokemath-e2e-mock-user',
          JSON.stringify(tokenPayload.user),
        );
        globalThis.location.assign('/dashboard');
        return;
      }

      // Create browser-side Supabase client
      const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_KEY ?? import.meta.env.SUPABASE_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          'Supabase configuration is missing. Check PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY.',
        );
      }

      const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${globalThis.location.origin}/api/auth/callback`,
        },
      });

      if (error) {
        const authError: AuthError = {
          code: error.name || 'auth_error',
          message: error.message || 'Failed to sign in with Google',
        };
        onError?.(authError);
      }
    } catch (err) {
      const authError: AuthError = {
        code: 'unexpected_error',
        message: err instanceof Error ? err.message : 'An unexpected error occurred during sign in',
      };
      setErrorMessage(authError.message);
      onError?.(authError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        data-test-id="login-google"
        onClick={handleSignIn}
        disabled={isLoading}
        className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-xl px-8 py-4 text-lg font-bold transition-all duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          backgroundColor: isLoading ? '#d4a017' : '#f1c40f',
          color: '#0a1628',
          boxShadow: '0 4px 20px rgba(241, 196, 15, 0.3)',
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            e.currentTarget.style.backgroundColor = '#f7dc6f';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(241, 196, 15, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading) {
            e.currentTarget.style.backgroundColor = '#f1c40f';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(241, 196, 15, 0.3)';
          }
        }}
      >
        {/* Shine effect on hover */}
        <span
          className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
            transform: 'translateX(-100%)',
            animation: 'shine 1.5s ease-in-out infinite',
          }}
        />

        {/* Content */}
        <span className="relative z-10 flex items-center gap-3">
          {isLoading ? (
            <>
              <Spinner className="h-6 w-6 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <GoogleIcon className="h-6 w-6 transition-transform group-hover:rotate-12" />
              <span>Sign in with Google</span>
            </>
          )}
        </span>

        <style>{`
          @keyframes shine {
            0% {
              transform: translateX(-100%);
            }
            50%, 100% {
              transform: translateX(200%);
            }
          }
        `}</style>
      </button>

      {errorMessage ? (
        <p data-test-id="login-error" role="alert" className="text-sm font-semibold text-red-200">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
