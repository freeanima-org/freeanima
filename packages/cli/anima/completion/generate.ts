import type { Command } from "commander";

export const SUPPORTED_SHELLS = ["bash", "zsh"] as const;
export type SupportedShell = (typeof SUPPORTED_SHELLS)[number];

interface CommandTree {
  path: string;
  subcommands: string[];
  children: CommandTree[];
  options: string[];
}

function optionFlags(cmd: Command): string[] {
  const out: string[] = [];
  for (const opt of cmd.options) {
    const parts = [opt.short, opt.long].filter(Boolean);
    if (parts.length === 0) continue;
    const joined = parts.join(" ");
    if (joined.includes("help") || joined.includes("version")) continue;
    out.push(joined);
  }
  return out;
}

function commandTree(cmd: Command, path = ""): CommandTree {
  const subcommands: string[] = [];
  const children: CommandTree[] = [];

  for (const arg of cmd.registeredArguments) {
    if (arg.argChoices?.length) {
      subcommands.push(...arg.argChoices);
    }
  }

  for (const sub of cmd.commands) {
    const name = sub.name();
    if (!name || name.startsWith("_")) continue;
    subcommands.push(name);
    const childPath = path ? `${path} ${name}` : name;
    children.push(commandTree(sub, childPath));
  }

  return {
    path,
    subcommands: [...new Set(subcommands)].toSorted(),
    children,
    options: [...new Set(optionFlags(cmd))].toSorted(),
  };
}

function fnName(path: string): string {
  if (!path) return "anima";
  return path.replace(/ /g, "_").replace(/-/g, "_");
}

function buildBashFunctions(node: CommandTree, out: string[]): void {
  const name = fnName(node.path);
  const depth = node.path.split(" ").filter(Boolean).length + 1;
  const actions = node.subcommands.join(" ");
  const opts = node.options.join(" ");

  if (actions || opts) {
    out.push(`_${name}() {`);
    out.push('    local cur="${COMP_WORDS[COMP_CWORD]}"');
    if (actions) {
      out.push(`    if (( COMP_CWORD == ${depth} )); then`);
      const words = [actions, opts].filter(Boolean).join(" ");
      out.push(`        COMPREPLY=( $(compgen -W "${words}" -- "\${cur}") )`);
      out.push("        return");
      out.push("    fi");
    }
    if (opts) {
      out.push(`    if (( COMP_CWORD > ${depth} )); then`);
      out.push(`        COMPREPLY=( $(compgen -W "${opts}" -- "\${cur}") )`);
      out.push("        return");
      out.push("    fi");
    }
    out.push("}");
  }

  for (const child of node.children) {
    buildBashFunctions(child, out);
  }
}

function generateBash(root: Command): string {
  const tree = commandTree(root);
  const childFunctions: string[] = [];
  for (const child of tree.children) {
    buildBashFunctions(child, childFunctions);
  }

  const rootWords = [...tree.subcommands, ...tree.options].join(" ");
  const lines = [
    "# anima bash completion — auto-generated, synced with CLI",
    '# Install: eval "$(anima completion bash)"',
    "",
    "_anima() {",
    '    local first="${COMP_WORDS[1]}"',
    '    local cur="${COMP_WORDS[COMP_CWORD]}"',
    "    if (( COMP_CWORD == 1 )); then",
    `        COMPREPLY=( $(compgen -W "${rootWords}" -- "\${cur}") )`,
    "        return",
    "    fi",
    '    case "$first" in',
  ];

  for (const child of tree.children) {
    const cname = child.path.split(" ").pop();
    if (cname === undefined) continue;
    lines.push(`        ${cname})`);
    lines.push(`            _${fnName(child.path)}`);
    lines.push("            ;;");
  }
  lines.push("    esac", "}");
  lines.push(...childFunctions);
  lines.push("", "complete -F _anima anima", "");
  return lines.join("\n");
}

function renderZshCase(node: CommandTree, depth: number): string[] {
  const indent = "    ".repeat(depth);
  const lines: string[] = [];
  const level = node.path.split(" ").filter(Boolean).length + 2;

  if (level === 2) {
    const all = [...node.subcommands, ...node.options].join(" ");
    lines.push(`${indent}if (( CURRENT == ${level} )); then`);
    if (all) {
      lines.push(`${indent}    _values "command" ${all}`);
    } else {
      lines.push(`${indent}    return 0`);
    }
    lines.push(`${indent}    return 0`, `${indent}fi`);
  }

  for (const child of node.children) {
    const cmdName = child.path.split(" ").pop();
    if (cmdName === undefined) continue;
    const childLevel = child.path.split(" ").filter(Boolean).length + 1;
    const childSubs = child.subcommands.join(" ");
    const childOpts = child.options.join(" ");

    lines.push(`${indent}if [[ "\${words[${level - 1}]}" === "${cmdName}" ]]; then`);
    if (childSubs) {
      lines.push(`${indent}    if (( CURRENT == ${childLevel} )); then`);
      const words = [childSubs, childOpts].filter(Boolean).join(" ");
      lines.push(`${indent}        _values "action" ${words}`);
      lines.push(`${indent}        return 0`, `${indent}    fi`);
    }
    if (childOpts) {
      lines.push(`${indent}    if (( CURRENT > ${childLevel} )); then`);
      lines.push(`${indent}        _arguments "*: :${childOpts}"`);
      lines.push(`${indent}        return 0`, `${indent}    fi`);
    }
    lines.push(...renderZshCase(child, depth + 1));
    lines.push(`${indent}    return 0`, `${indent}fi`);
  }

  return lines;
}

function generateZsh(root: Command): string {
  const tree = commandTree(root);
  const lines = [
    "#compdef anima",
    "# anima zsh completion — auto-generated, synced with CLI",
    "# Install: source <(anima completion zsh)",
    "",
    "_anima() {",
    ...renderZshCase(tree, 1),
    "}",
    "",
    '_anima "$@"',
    "",
  ];
  return lines.join("\n");
}

export function generateCompletion(shell: string, program: Command): string {
  if (shell === "bash") return generateBash(program);
  if (shell === "zsh") return generateZsh(program);
  throw new Error(`Unsupported shell: '${shell}', options: ${SUPPORTED_SHELLS.join(", ")}`);
}
