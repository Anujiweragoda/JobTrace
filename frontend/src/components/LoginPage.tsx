import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, options?: {
            theme?: "outline";
            size?: "large" | "medium" | "small";
            text?: string;
            shape?: "rectangular" | "pill";
            width?: string;
            locale?: string;
          }) => void;
        };
      };
    };
  }
}

export type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  onGoogleLogin: (credential: string) => Promise<void>;
  onSignup?: (username: string, password: string, email?: string) => Promise<void>;
  loading?: boolean;
  error?: string;
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function LoginPage({ onLogin, onGoogleLogin, onSignup, loading = false, error = "" }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [signupMode, setSignupMode] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (signupMode && onSignup) {
      await onSignup(username, password, email || undefined);
    } else {
      await onLogin(username, password);
    }
  }

  

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const scriptUrl = "https://accounts.google.com/gsi/client?hl=en";
    let cancelled = false;
    let script = document.getElementById("google-gsi-script") as HTMLScriptElement | null;

    const initialize = () => {
      if (cancelled || !window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          await onGoogleLogin(response.credential);
        },
      });

      const btnContainer = document.getElementById("google-signin-button");
      if (btnContainer) {
        btnContainer.replaceChildren();
        window.google.accounts.id.renderButton(btnContainer, {
          theme: "outline",
          size: "large",
          width: "368",
          text: "signin_with",
          locale: "en",
          shape: "rectangular",
        });
      }
    };

    if (script && script.src !== scriptUrl) {
      script.remove();
      script = null;
    }

    if (window.google?.accounts?.id) {
      initialize();
    } else if (script) {
      script.addEventListener("load", initialize, { once: true });
    } else {
      script = document.createElement("script");
      script.id = "google-gsi-script";
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", initialize, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [onGoogleLogin]);

  return (
    <div className="auth-screen">
      <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-three" aria-hidden="true" />
      <div className="auth-card">
        <h1>JobTrace</h1>
        <p className="auth-subtitle">Sign in to manage your job applications</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {signupMode && (
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (signupMode ? "Signing up..." : "Signing in...") : signupMode ? "Sign up" : "Login"}
            </button>

            {GOOGLE_CLIENT_ID && (
              <div id="google-signin-button" className="google-button" aria-label="Sign in with Google" />
            )}
          </div>

          <div style={{ marginTop: 12, textAlign: "center" }}>
            <button
              type="button"
              className="btn btn-link"
              onClick={() => setSignupMode((s) => !s)}
            >
              {signupMode ? "Have an account? Log in" : "Create an account"}
            </button>
          </div>

          
        </form>
      </div>
    </div>
  );
}
