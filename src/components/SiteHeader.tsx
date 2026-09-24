import { Link } from "@tanstack/react-router";
import { PenLine } from "lucide-react";

import { Button } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { openCookiePreferences } from "@/components/ConsentBanner";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <PenLine className="size-4" />
      </span>
      <span className="text-lg">HandText</span>
    </Link>
  );
}

export function SiteHeader() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/handwriting-generator" className="hover:text-foreground">
            Tools
          </Link>
          <a href="/#how-it-works" className="hover:text-foreground">
            How it works
          </a>
          <Link to="/faq" className="hover:text-foreground">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {!loading && user ? (
            <Link to="/dashboard">
              <Button size="sm">Open dashboard</Button>
            </Link>
          ) : (
            <>
              <Link to="/auth" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface text-sm text-muted-foreground">
      <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Brand & Identity */}
          <div className="space-y-4">
            <Logo />
            <p className="text-xs leading-relaxed text-muted-foreground">
              HandText is an online AI Handwriting Generator that converts typed text, assignments,
              notes, and mathematical formulas into realistic handwritten pages.
            </p>
            <p className="text-xs text-muted-foreground">
              © {currentYear} HandText. All rights reserved.
            </p>
          </div>

          {/* Column 2: Tools */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">Tools</p>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/handwriting-generator" className="hover:text-foreground">
                  Handwriting Generator Online
                </Link>
              </li>
              <li>
                <Link to="/text-to-handwriting" className="hover:text-foreground">
                  Text to Handwriting
                </Link>
              </li>
              <li>
                <Link to="/handwritten-assignment-generator" className="hover:text-foreground">
                  Assignment Generator
                </Link>
              </li>
              <li>
                <Link to="/handwritten-notes-generator" className="hover:text-foreground">
                  Handwritten Notes
                </Link>
              </li>
              <li>
                <Link to="/handwritten-math-generator" className="hover:text-foreground">
                  Handwritten Math & LaTeX
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources & Support */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">Resources</p>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/faq" className="hover:text-foreground">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <a href="/#how-it-works" className="hover:text-foreground">
                  How it Works
                </a>
              </li>
              <li>
                <Link to="/auth" className="hover:text-foreground">
                  Get Started Free
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-foreground">
                  User Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal & Privacy */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">Legal & Privacy</p>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/privacy" className="hover:text-foreground">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-foreground">
                  Terms of Service
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={openCookiePreferences}
                  className="cursor-pointer text-left text-xs hover:text-foreground"
                >
                  Cookie & Analytics Preferences
                </button>
              </li>
              <li>
                <a href="mailto:privacy@handtext.internal" className="hover:text-foreground">
                  Contact Privacy Team
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
