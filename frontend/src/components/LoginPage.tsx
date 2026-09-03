import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          prompt: () => void;
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
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [email, setEmail] = useState("");
  const [signupMode, setSignupMode] = useState(false);
  const [gsiLoaded, setGsiLoaded] = useState(false);

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

    const script = document.getElementById("google-gsi-script") as HTMLScriptElement | null;
    const initialize = () => {
      window.google?.accounts?.id?.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          await onGoogleLogin(response.credential);
        },
      });
      // render the Google-branded button into the container if present
      const btnContainer = document.getElementById("google-signin-button");
      if (btnContainer && window.google?.accounts?.id?.renderButton) {
        try {
          window.google.accounts.id.renderButton(btnContainer, { theme: "outline", size: "large" });
        } catch (e) {
          // ignore render errors
        }
      }
    };

    if (script) {
      // If script already present, try to initialize (may already be ready)
      initialize();
      setGsiLoaded(!!window.google?.accounts?.id);
      return;
    }

    const googleScript = document.createElement("script");
    googleScript.id = "google-gsi-script";
    googleScript.src = "https://accounts.google.com/gsi/client";
    googleScript.async = true;
    googleScript.defer = true;
    googleScript.onload = () => {
      initialize();
      setGsiLoaded(!!window.google?.accounts?.id);
    };
    document.body.appendChild(googleScript);
  }, [onGoogleLogin, GOOGLE_CLIENT_ID]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const t = setInterval(() => {
      setGsiLoaded(!!window.google?.accounts?.id);
    }, 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="auth-screen">
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
              <button
                type="button"
                className="btn btn-secondary google-button"
                onClick={() => window.google?.accounts?.id?.prompt?.()}
              >
                Continue with Google
              </button>
            )}
              {GOOGLE_CLIENT_ID && (
                <div id="google-signin-button" style={{ display: "inline-block", marginLeft: 8 }} />
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

        {import.meta.env.DEV && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
            <div>Google Client ID: {GOOGLE_CLIENT_ID ? "present" : "missing"}</div>
            <div>window.google.accounts.id: {gsiLoaded ? "loaded" : "not loaded"}</div>
          </div>
        )}


        <p className="auth-note">Demo account: admin / admin123</p>
      </div>
    </div>
  );
}
