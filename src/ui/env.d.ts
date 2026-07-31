declare module "*.css";

interface SkillSessionProfilesDesktopApi {
  call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
  getContext(): Promise<{ cwd: string }>;
  chooseDirectory(): Promise<string | null>;
  saveTextFile(defaultName: string, content: string): Promise<boolean>;
}

interface Window {
  skillSessionProfiles?: SkillSessionProfilesDesktopApi;
}
