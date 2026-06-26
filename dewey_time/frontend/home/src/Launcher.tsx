import { useMemo, useState, type ReactNode } from "react";
import { useFrappeGetCall, useFrappeAuth } from "frappe-react-sdk";
import { format } from "date-fns";
import { Search, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@lolbikb/dewey-ui";
import type { LauncherData, LauncherApp } from "./types";

const METHOD = "dewey_time.attendance_engine.launcher.get_launcher";
const DI_LOGO = "/assets/dewey_time/images/DI-logo.svg";
// The /home is the COMPANY portal (Dewey International), not a product. "Dewey
// Time" is one app tile. Wordmark split so "International" reads as a sub-label.
const COMPANY_LEAD = "Dewey";
const COMPANY_REST = "International";

function greetingPart(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function Launcher() {
  const { data, error, isLoading } = useFrappeGetCall<{ message: LauncherData }>(
    METHOD,
    undefined,
    METHOD,
  );
  const launcher = data?.message;
  const user = launcher?.user;
  const [query, setQuery] = useState("");

  const apps = useMemo(() => launcher?.apps ?? [], [launcher]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? apps.filter((a) => a.title.toLowerCase().includes(q)) : apps;
  }, [apps, query]);

  const now = new Date();
  const firstName = (user?.full_name ?? "").trim().split(/\s+/)[0] || "there";

  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground">
      <div className="di-home-backdrop" aria-hidden="true" />

      <div className="relative z-[1] mx-auto flex h-screen max-w-[1200px] flex-col px-5 pb-4 pt-5 md:px-7">
        {/* identity + account */}
        <header className="mb-3.5 flex flex-none items-center justify-between">
          <a href="/home" className="flex items-center gap-2.5" aria-label="Dewey International home">
            <img src={DI_LOGO} alt="" className="size-7 rounded-md" />
            <span className="text-sm tracking-tight">
              <span className="font-semibold">{COMPANY_LEAD}</span>{" "}
              <span className="text-muted-foreground">{COMPANY_REST}</span>
            </span>
          </a>
          <AccountMenu user={user} />
        </header>

        {error ? (
          <ErrorPanel />
        ) : isLoading ? (
          <PanelMessage>Loading your apps…</PanelMessage>
        ) : (
          <>
            {/* greeting */}
            <section className="mb-4 flex-none">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {format(now, "EEEE, MMMM d")}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                Good {greetingPart(now.getHours())}, {firstName}
              </h1>
              <div className="mt-2.5 h-[3px] w-[38px] rounded bg-primary" />
            </section>

            {/* apps header + compact filter */}
            <div className="mb-2.5 flex flex-none items-center justify-between gap-4">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                Your apps
              </span>
              <div className="relative w-[230px] max-w-[48%]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search apps…"
                  aria-label="Search apps"
                  className="h-[34px] w-full rounded-[9px] border border-border bg-card pl-8 pr-2.5 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* the main event: scrollable app list */}
            <AppPanel apps={filtered} total={apps.length} />
          </>
        )}

        <footer className="mt-auto flex flex-none items-center justify-between pt-4 text-xs text-muted-foreground">
          <span>{user ? `Signed in as ${user.full_name}` : ""}</span>
          <span>&copy; {now.getFullYear()} Dewey International</span>
        </footer>
      </div>
    </div>
  );
}

function AppPanel({ apps, total }: { apps: LauncherApp[]; total: number }) {
  if (total === 0) {
    return <PanelMessage>No apps assigned yet — contact your administrator.</PanelMessage>;
  }
  if (apps.length === 0) {
    return <PanelMessage>No apps match your search.</PanelMessage>;
  }
  return (
    <nav
      className="app-panel app-grid min-h-0 overflow-y-auto rounded-2xl border border-border bg-card"
      aria-label="Your apps"
    >
      {apps.map((a) => (
        <AppRow key={a.name} app={a} />
      ))}
    </nav>
  );
}

function PanelMessage({ children }: { children: ReactNode }) {
  return (
    <div className="app-panel flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-border bg-card px-6 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function AppRow({ app }: { app: LauncherApp }) {
  return (
    <a
      href={app.route}
      className="app-row group relative flex items-center gap-[18px] overflow-hidden px-[30px] py-6 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
    >
      <span className="grid size-[50px] flex-none place-items-center rounded-[14px] border border-border bg-muted/40">
        <img
          src={app.logo}
          alt=""
          className="size-6"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2.5">
          <span className="text-[16.5px] font-semibold tracking-tight">{app.title}</span>
          {app.admin && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/25 bg-brand-accent/[0.07] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-accent">
              <span className="size-[5px] rounded-full bg-brand-accent" />
              Admin
            </span>
          )}
        </span>
        {app.description && (
          <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
            {app.description}
          </span>
        )}
      </span>
      <ChevronRight className="size-[18px] flex-none text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </a>
  );
}

function AccountMenu({ user }: { user?: LauncherData["user"] }) {
  const { logout } = useFrappeAuth();
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      window.location.href = "/login";
    }
  };

  if (!user) {
    return (
      <div className="size-10 rounded-full border border-border bg-muted/40" aria-hidden="true" />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`${user.full_name} — account menu`}
        >
          <UserAvatar user={user} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-semibold text-foreground">{user.full_name}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            window.location.href = "/app/user-profile";
          }}
        >
          Profile
        </DropdownMenuItem>
        {user.can_manage_tiles && (
          <DropdownMenuItem
            onSelect={() => {
              window.location.href = "/home/admin";
            }}
          >
            Manage tiles
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={handleLogout}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserAvatar({ user }: { user: LauncherData["user"] }) {
  const [imgError, setImgError] = useState(false);
  const initials = (
    <div className="grid size-10 place-items-center rounded-full border border-border bg-muted text-[12px] font-semibold text-muted-foreground">
      {user.initials}
    </div>
  );
  if (!user.image_url || imgError) return initials;
  return (
    <img
      src={user.image_url}
      alt=""
      className="size-10 rounded-full border border-border object-cover"
      onError={() => setImgError(true)}
    />
  );
}

function ErrorPanel() {
  return (
    <div className="app-panel flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 text-center">
      <p className="text-sm text-muted-foreground">Couldn&rsquo;t load your apps.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
          onClick={() => location.reload()}
        >
          Retry
        </button>
        <a
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
          href="/desk"
        >
          Go to Desk
        </a>
        <a
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
          href="/api/method/logout"
        >
          Log out
        </a>
      </div>
    </div>
  );
}
