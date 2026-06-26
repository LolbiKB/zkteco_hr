export interface LauncherApp {
  name: string;
  title: string;
  route: string;
  logo: string;
  admin: boolean;
  /** Optional one-line subtitle. Forward-compatible: rendered when present
   *  (populated once a `description` field is added to Launcher Tile). */
  description?: string;
}
export interface LauncherData {
  user: { full_name: string; initials: string; image_url?: string | null; can_manage_tiles: boolean };
  apps: LauncherApp[];
}
