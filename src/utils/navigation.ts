import { ContainerBuilder, ActionRowBuilder } from 'discord.js';
import { header, body, separator, primaryBtn, row, V2_COLORS } from './v2Components';

export interface Tab {
  id: string;
  label: string;
  emoji: string;
  builder: () => ContainerBuilder | Promise<ContainerBuilder>;
}

export class TabbedView {
  private tabs: Tab[] = [];
  private currentTab = 0;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  addTab(tab: Tab): this {
    this.tabs.push(tab);
    return this;
  }

  async render(): Promise<{ components: ContainerBuilder[]; rows: ActionRowBuilder[] }> {
    const tab = this.tabs[this.currentTab];
    const mainContent = await tab.builder();
    const tabButtons = this.tabs.map((t, i) =>
      primaryBtn(`${t.emoji} ${t.label}`, `navtab_${t.id}_${i}_${this.userId}`)
    );
    const navRow = row(...tabButtons);
    return { components: [mainContent], rows: [navRow] };
  }

  setCurrentTab(index: number): void {
    this.currentTab = Math.max(0, Math.min(index, this.tabs.length - 1));
  }

  findTabById(id: string): number {
    return this.tabs.findIndex(t => t.id === id);
  }
}

export class PaginationView {
  private items: any[];
  private pageSize: number;
  private currentPage: number;
  private userId: string;
  private renderFn: (items: any[], page: number) => ContainerBuilder;

  constructor(userId: string, items: any[], pageSize: number, renderFn: (items: any[], page: number) => ContainerBuilder) {
    this.userId = userId;
    this.items = items;
    this.pageSize = pageSize;
    this.renderFn = renderFn;
    this.currentPage = 0;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.items.length / this.pageSize));
  }

  render(): { components: ContainerBuilder[]; rows: ActionRowBuilder[] } {
    const start = this.currentPage * this.pageSize;
    const pageItems = this.items.slice(start, start + this.pageSize);
    const content = this.renderFn(pageItems, this.currentPage);
    const navButtons = [];
    if (this.currentPage > 0) navButtons.push(primaryBtn('◀️ Trước', `page_prev_${this.userId}`));
    navButtons.push(primaryBtn(`${this.currentPage + 1}/${this.totalPages}`, 'noop'));
    if (this.currentPage < this.totalPages - 1) navButtons.push(primaryBtn('Sau ▶️', `page_next_${this.userId}`));
    return { components: [content], rows: [row(...navButtons)] };
  }

  nextPage(): void { if (this.currentPage < this.totalPages - 1) this.currentPage++; }
  prevPage(): void { if (this.currentPage > 0) this.currentPage--; }
}
