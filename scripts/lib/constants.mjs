// Shared constants. Keep AGENTS / FLAT_AGENTS in step with the plugin's
// `AgentType` + `AGENT_TYPES[].skillFormat` (src/types/ai-skills.ts).

export const REPO = 'PaperBell-Org/paperbell-skills-market';

export const SCHEMA_VERSION = 1;

export const AGENTS = Object.freeze([
  'claude-code',
  'github-copilot',
  'cursor',
  'windsurf',
  'cline',
  'openai-codex',
  'gemini-cli',
]);

/** Agents whose skills are a single `.md` file — they can only take 1-file skills. */
export const FLAT_AGENTS = Object.freeze(['cursor', 'windsurf', 'cline']);

/** Agents that install a skill as a directory (SKILL.md + resources). */
export const DIRECTORY_AGENTS = Object.freeze(AGENTS.filter((a) => !FLAT_AGENTS.includes(a)));

export const TIERS = Object.freeze(['core', 'community']);

/** Hard cap per packaged file. Skills are text; anything bigger belongs elsewhere. */
export const MAX_FILE_BYTES = 1024 * 1024;

/** Skill / bundle ids: lowercase kebab-case, as Claude Code and the plugin expect. */
export const ID_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export const SKILL_YAML_KEYS = Object.freeze([
  'id',
  'version',
  'title',
  'description',
  'tier',
  'agents',
  'requires',
  'shared',
  'minPluginVersion',
  'free',
  'tags',
  'readme',
]);

export const BUNDLE_YAML_KEYS = Object.freeze(['id', 'version', 'title', 'description', 'skills']);
