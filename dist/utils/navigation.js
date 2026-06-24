"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationView = exports.TabbedView = void 0;
const v2Components_1 = require("./v2Components");
class TabbedView {
    tabs = [];
    currentTab = 0;
    userId;
    constructor(userId) {
        this.userId = userId;
    }
    addTab(tab) {
        this.tabs.push(tab);
        return this;
    }
    async render() {
        const tab = this.tabs[this.currentTab];
        const mainContent = await tab.builder();
        const tabButtons = this.tabs.map((t, i) => (0, v2Components_1.primaryBtn)(`${t.emoji} ${t.label}`, `navtab_${t.id}_${i}_${this.userId}`));
        const navRow = (0, v2Components_1.row)(...tabButtons);
        return { components: [mainContent], rows: [navRow] };
    }
    setCurrentTab(index) {
        this.currentTab = Math.max(0, Math.min(index, this.tabs.length - 1));
    }
    findTabById(id) {
        return this.tabs.findIndex(t => t.id === id);
    }
}
exports.TabbedView = TabbedView;
class PaginationView {
    items;
    pageSize;
    currentPage;
    userId;
    renderFn;
    constructor(userId, items, pageSize, renderFn) {
        this.userId = userId;
        this.items = items;
        this.pageSize = pageSize;
        this.renderFn = renderFn;
        this.currentPage = 0;
    }
    get totalPages() {
        return Math.max(1, Math.ceil(this.items.length / this.pageSize));
    }
    render() {
        const start = this.currentPage * this.pageSize;
        const pageItems = this.items.slice(start, start + this.pageSize);
        const content = this.renderFn(pageItems, this.currentPage);
        const navButtons = [];
        if (this.currentPage > 0)
            navButtons.push((0, v2Components_1.primaryBtn)('◀️ Trước', `page_prev_${this.userId}`));
        navButtons.push((0, v2Components_1.primaryBtn)(`${this.currentPage + 1}/${this.totalPages}`, 'noop'));
        if (this.currentPage < this.totalPages - 1)
            navButtons.push((0, v2Components_1.primaryBtn)('Sau ▶️', `page_next_${this.userId}`));
        return { components: [content], rows: [(0, v2Components_1.row)(...navButtons)] };
    }
    nextPage() { if (this.currentPage < this.totalPages - 1)
        this.currentPage++; }
    prevPage() { if (this.currentPage > 0)
        this.currentPage--; }
}
exports.PaginationView = PaginationView;
