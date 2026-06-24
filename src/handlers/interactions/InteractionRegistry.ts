import { Interaction } from 'discord.js';

export type HandlerFn = (
  interaction: Interaction,
  action: string,
  parts: string[],
  userId: string
) => Promise<void>;

interface HandlerEntry {
  prefixes: string[];
  fn: HandlerFn;
  public?: boolean;
}

export class InteractionRegistry {
  private routes: HandlerEntry[] = [];
  private fallbackFn?: HandlerFn;

  on(prefixes: string[], fn: HandlerFn, public_ = false): this {
    this.routes.push({ prefixes, fn, public: public_ });
    return this;
  }

  onFallback(fn: HandlerFn): this {
    this.fallbackFn = fn;
    return this;
  }

  async dispatch(interaction: Interaction, action: string, parts: string[], userId: string): Promise<boolean> {
    // 1. Exact match
    for (const r of this.routes) {
      if (r.prefixes.includes(action)) {
        await r.fn(interaction, action, parts, userId);
        return true;
      }
    }
    // 2. Compound prefix match: e.g. customId='dongphu_spring_123' parses action='dongphu'
    //    but registered prefix is 'dongphu_spring'. Match when a registered prefix starts
    //    with action + '_' and pass the original action + full parts to the handler.
    const customId = (interaction as any).customId as string;
    for (const r of this.routes) {
      for (const prefix of r.prefixes) {
        if (prefix.startsWith(action + '_') && customId.startsWith(prefix + '_')) {
          const fullParts = customId.split('_');
          await r.fn(interaction, action, fullParts, userId);
          return true;
        }
      }
    }
    if (this.fallbackFn) {
      await this.fallbackFn(interaction, action, parts, userId);
      return true;
    }
    return false;
  }

  isPublic(action: string): boolean {
    for (const r of this.routes) {
      if (r.public) {
        for (const prefix of r.prefixes) {
          if (prefix === action) return true;
        }
      }
    }
    return false;
  }
}

export const registry = new InteractionRegistry();
